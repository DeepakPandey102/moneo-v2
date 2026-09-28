// Service layer for "Ask Anything" — the general-purpose chat feature.
// Threads and messages live in Supabase (real, synced, private per-user
// via Row Level Security). The actual AI replies come from the backend,
// same security model as everywhere else: the Gemini key never touches
// the browser.

import { supabase } from "../utils/supabaseClient";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// How many of the most recent messages get sent as raw context on every
// reply. Anything older than this is represented only by the thread's
// memory_summary — this is what keeps a long-running conversation cheap
// and fast instead of resending the whole history every message.
const RECENT_WINDOW = 12;
// Once a thread crosses this many total messages since the last summary,
// fold the older ones into memory_summary.
const SUMMARIZE_EVERY = 16;

// ---------- Threads ----------

export async function listThreads(userId) {
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createThread(userId) {
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, title: "New Chat" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameThread(threadId, title) {
  const { error } = await supabase.from("chat_threads").update({ title }).eq("id", threadId);
  if (error) throw error;
}

export async function deleteThread(threadId) {
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId);
  if (error) throw error;
}

// Returns { summary, summarizedCount }. summarizedCount = how many of the
// thread's oldest messages are already folded into the summary. Uses
// select("*") so it still works if the summarized_count column hasn't been
// added yet (see backend/supabase_migration_001.sql) — it just reads as 0.
async function getThreadMemory(threadId) {
  const { data, error } = await supabase.from("chat_threads").select("*").eq("id", threadId).single();
  if (error) throw error;
  return {
    summary: data?.memory_summary || "",
    summarizedCount: Number(data?.summarized_count) || 0,
    hasCountColumn: data ? "summarized_count" in data : false,
  };
}

async function saveThreadMemory(threadId, summary, summarizedCount, hasCountColumn) {
  const patch = hasCountColumn
    ? { memory_summary: summary, summarized_count: summarizedCount }
    : { memory_summary: summary };
  const { error } = await supabase.from("chat_threads").update(patch).eq("id", threadId);
  if (error) throw error;
}

// ---------- Messages ----------

export async function listMessages(threadId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function saveMessage(threadId, role, content) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ thread_id: threadId, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(messageId) {
  const { error } = await supabase.from("chat_messages").delete().eq("id", messageId);
  if (error) throw error;
}

// ---------- Backend AI calls ----------

async function postToBackend(path, body) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    const err = new Error("BACKEND_UNREACHABLE");
    err.code = "BACKEND_UNREACHABLE";
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || "Request failed");
    err.code = json.error || "UNKNOWN";
    throw err;
  }
  return json;
}

export function friendlyChatError(err, lang) {
  if (err.code === "BACKEND_UNREACHABLE") {
    return lang === "ko" ? "Moneo AI에 연결할 수 없어요. 인터넷 연결을 확인해주세요." : "Couldn't reach Moneo AI. Check your connection.";
  }
  if (err.code === "gemini_not_configured") {
    return lang === "ko" ? "AI를 잠시 사용할 수 없어요." : "AI is temporarily unavailable.";
  }
  if (err.code === "rate_limited") {
    return lang === "ko" ? "요청이 너무 많아요. 1분 후 다시 시도해주세요." : "Too many requests — please try again in a minute.";
  }
  return lang === "ko" ? "메시지를 보내지 못했어요. 다시 시도해주세요." : "Couldn't send that message. Please try again.";
}

// The main entry point: send a user message in a thread, get the AI's
// reply, persist both, and transparently handle memory summarization
// when the thread has grown long enough to need it.
export async function sendMessage({ threadId, message, lang, skipUserSave = false }) {
  if (!skipUserSave) {
    await saveMessage(threadId, "user", message);
  }

  const allMessages = await listMessages(threadId);
  const { summary: memorySummary } = await getThreadMemory(threadId);

  // The user message being answered is always the LAST message in the thread
  // (just saved, or — on regenerate/retry — already saved earlier). It's sent
  // separately as `message`, so drop it from the history in BOTH cases.
  // (Previously the regenerate path kept it, so the AI saw the question twice.)
  const history = allMessages.slice();
  const last = history[history.length - 1];
  if (last && last.role === "user" && last.content === message) history.pop();
  const recent = history.slice(-RECENT_WINDOW).map((m) => ({ role: m.role, content: m.content }));

  const { reply } = await postToBackend("/api/chat/reply", {
    message,
    recentMessages: recent,
    memorySummary,
    language: lang,
  });

  const saved = await saveMessage(threadId, "assistant", reply);

  // Fire-and-forget memory compression once the thread is long enough —
  // doesn't block the reply the user is waiting for.
  maybeSummarize(threadId, lang).catch((err) => console.error("Memory summarization failed:", err));

  return saved;
}

// Folds messages that have scrolled out of the recent window into the
// running summary — but only the ones NOT already summarized. The old version
// re-sent every older message on every reply once a thread passed 16
// messages, so each reply got slower and costlier and the summary kept
// re-absorbing the same messages.
const summarizingThreads = new Set();

async function maybeSummarize(threadId, lang) {
  if (summarizingThreads.has(threadId)) return; // one at a time per thread
  summarizingThreads.add(threadId);
  try {
    const allMessages = await listMessages(threadId);
    if (allMessages.length < SUMMARIZE_EVERY) return;

    const { summary: previousSummary, summarizedCount, hasCountColumn } = await getThreadMemory(threadId);
    const olderEnd = allMessages.length - RECENT_WINDOW;
    // Without the tracking column we can't tell what's already summarized,
    // so only summarize in batches (every SUMMARIZE_EVERY - RECENT_WINDOW messages).
    const start = hasCountColumn ? Math.min(summarizedCount, olderEnd) : Math.max(0, olderEnd - (SUMMARIZE_EVERY - RECENT_WINDOW));
    if (!hasCountColumn && (olderEnd % (SUMMARIZE_EVERY - RECENT_WINDOW)) !== 0) return;
    const toFold = allMessages.slice(start, olderEnd);
    if (toFold.length === 0) return;

    const { summary } = await postToBackend("/api/chat/summarize", {
      messagesToSummarize: toFold.map((m) => ({ role: m.role, content: m.content })),
      previousSummary,
      language: lang,
    });
    await saveThreadMemory(threadId, summary, olderEnd, hasCountColumn);
  } finally {
    summarizingThreads.delete(threadId);
  }
}

export async function generateTitleForThread({ threadId, firstMessage, lang }) {
  try {
    const { title } = await postToBackend("/api/chat/title", { firstMessage, language: lang });
    if (title) await renameThread(threadId, title);
    return title;
  } catch {
    return null; // non-critical — thread just keeps its default title
  }
}
