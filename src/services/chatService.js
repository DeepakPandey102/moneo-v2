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
  return data;
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

async function getThreadMemory(threadId) {
  const { data, error } = await supabase.from("chat_threads").select("memory_summary").eq("id", threadId).single();
  if (error) throw error;
  return data?.memory_summary || "";
}

async function saveThreadMemory(threadId, summary) {
  const { error } = await supabase.from("chat_threads").update({ memory_summary: summary }).eq("id", threadId);
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
  return data;
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
    return lang === "ko" ? "백엔드 서버에 연결할 수 없어요." : "Can't reach the backend server.";
  }
  if (err.code === "gemini_not_configured") {
    return lang === "ko" ? "AI가 아직 설정되지 않았어요." : "AI isn't set up yet.";
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
  const memorySummary = await getThreadMemory(threadId);
  const recent = allMessages.slice(-RECENT_WINDOW).map((m) => ({ role: m.role, content: m.content }));

  const { reply } = await postToBackend("/api/chat/reply", {
    message,
    recentMessages: skipUserSave ? recent : recent.slice(0, -1), // exclude the message we just sent — it's passed separately
    memorySummary,
    language: lang,
  });

  const saved = await saveMessage(threadId, "assistant", reply);

  // Fire-and-forget memory compression once the thread is long enough —
  // doesn't block the reply the user is waiting for.
  maybeSummarize(threadId, lang).catch((err) => console.error("Memory summarization failed:", err));

  return saved;
}

async function maybeSummarize(threadId, lang) {
  const allMessages = await listMessages(threadId);
  if (allMessages.length < SUMMARIZE_EVERY) return;

  const older = allMessages.slice(0, -RECENT_WINDOW);
  if (older.length === 0) return;

  const previousSummary = await getThreadMemory(threadId);
  const { summary } = await postToBackend("/api/chat/summarize", {
    messagesToSummarize: older.map((m) => ({ role: m.role, content: m.content })),
    previousSummary,
    language: lang,
  });
  await saveThreadMemory(threadId, summary);
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
