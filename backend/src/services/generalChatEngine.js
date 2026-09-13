import { generateText } from "./geminiService.js";

// This is deliberately NOT scoped to finance — "Ask Anything" is a
// general-purpose assistant, separate from the finance-only Moneo AI
// Assistant elsewhere in the app. It still lives inside Moneo (so it's
// branded and friendly), but it can talk about anything.
//
// It's also wired up with live Google Search grounding (see
// geminiService.generateText's useSearch option) — this is what lets it
// answer "what's today's date" or ask about recent news correctly instead
// of guessing from stale training data.
function buildChatSystem() {
  const now = new Date();
  const todayLine = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `You are the AI assistant inside Moneo 2.0's "Ask Anything" feature — a general-purpose, helpful, friendly assistant. Unlike Moneo's other finance-specific assistant, you are NOT limited to financial topics — the user can ask you literally anything: advice, explanations, brainstorming, writing help, general knowledge, casual conversation, anything.

Today's date is ${todayLine}. Trust this over any date you might otherwise assume.

You have live Google Search available and grounded results may be attached to your context — use them for anything current, time-sensitive, or recent (news, prices, scores, "what's the latest on X," current events, or anything you're not fully certain is still accurate). Don't say you can't browse the internet or don't have real-time access — you do. If search results are provided, base your answer on them and don't contradict them.

Rules:
- Be warm, direct, and genuinely helpful — like a knowledgeable friend, not a stiff corporate bot.
- Keep answers reasonably concise unless the question clearly calls for depth.
- If a MEMORY SUMMARY of earlier conversation is provided below, use it naturally to maintain continuity — reference earlier context when relevant, the way a person who remembers a past conversation would, without awkwardly announcing "according to my memory."
- Respond in the language specified below.`;
}

// Used to compress older messages into a compact running summary once a
// thread gets long, so the model can "remember" earlier context without
// the app having to resend the entire conversation history every time —
// this is what makes long-term memory affordable and fast.
const SUMMARIZE_SYSTEM = `You compress conversation history into a compact memory summary for an AI assistant to use later.

Rules:
- Preserve concrete facts, names, preferences, ongoing topics, and anything the user would expect the assistant to still "remember" later.
- Merge the new messages into the EXISTING summary provided (if any) — don't just append, actually integrate and condense.
- Write in plain, dense prose — no bullet points, no headers. Aim for well under 200 words regardless of how much conversation you're compressing.
- Write it as neutral background notes (e.g. "User is a university student interested in X; previously discussed Y"), not as a transcript or as if speaking to the user.`;

export async function getChatReply({ message, recentMessages, memorySummary, language }) {
  const languageLine = language === "ko" ? "Respond in natural Korean." : "Respond in natural English.";

  const historyText = recentMessages && recentMessages.length
    ? recentMessages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")
    : "(no earlier messages in this thread yet)";

  const memoryBlock = memorySummary && memorySummary.trim()
    ? `MEMORY SUMMARY (earlier context from this conversation):\n${memorySummary}\n\n`
    : "";

  const prompt = `${languageLine}\n\n${memoryBlock}Recent conversation:\n${historyText}\n\nUser: ${message}`;

  // useSearch: true lets Gemini decide, per-message, whether to ground its
  // answer in live Google Search results — it only actually searches when
  // it judges the question needs current information, so plain chit-chat
  // isn't slowed down by it.
  const result = await generateText({
    systemInstruction: buildChatSystem(),
    prompt,
    maxOutputTokens: 800,
    useSearch: true,
  });

  const { text, sources } = typeof result === "string" ? { text: result, sources: [] } : result;

  // No dedicated "sources" column in chat_messages, so when Gemini actually
  // grounded the answer in search results, fold a compact links list into
  // the saved markdown itself — it renders as normal clickable links in
  // the chat bubble.
  if (sources && sources.length) {
    const unique = sources.filter((s, i) => s.uri && sources.findIndex((x) => x.uri === s.uri) === i).slice(0, 5);
    if (unique.length) {
      const list = unique.map((s) => `- [${s.title || s.uri}](${s.uri})`).join("\n");
      return `${text}\n\n---\n**Sources:**\n${list}`;
    }
  }
  return text;
}

const TITLE_SYSTEM = `You generate short chat thread titles, like ChatGPT does. Given a user's first message, write a punchy 3-6 word title summarizing the topic. No quotes, no punctuation at the end, no "Title:" prefix — just the title text itself, in the same language as the message.`;

export async function generateThreadTitle({ firstMessage, language }) {
  const languageLine = language === "ko" ? "Write the title in Korean." : "Write the title in English.";
  const prompt = `${languageLine}\n\nUser's first message: "${firstMessage}"\n\nTitle:`;
  const raw = await generateText({ systemInstruction: TITLE_SYSTEM, prompt, maxOutputTokens: 20 });
  // Strip stray quotes the model sometimes adds despite instructions.
  return raw.replace(/^["'"]|["'"]$/g, "").trim().slice(0, 60);
}

export async function summarizeForMemory({ messagesToSummarize, previousSummary, language }) {
  const languageLine = language === "ko" ? "Write the summary in Korean." : "Write the summary in English.";
  const transcript = messagesToSummarize.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const prompt = `${languageLine}\n\nEXISTING SUMMARY (may be empty):\n${previousSummary || "(none yet)"}\n\nNEW MESSAGES TO FOLD IN:\n${transcript}\n\nWrite the updated combined summary.`;

  return generateText({ systemInstruction: SUMMARIZE_SYSTEM, prompt, maxOutputTokens: 300 });
}
