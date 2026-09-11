import { generateText } from "./geminiService.js";

// This is deliberately NOT scoped to finance — "Ask Anything" is a
// general-purpose assistant, separate from the finance-only Moneo AI
// Assistant elsewhere in the app. It still lives inside Moneo (so it's
// branded and friendly), but it can talk about anything.
const CHAT_SYSTEM = `You are the AI assistant inside Moneo 2.0's "Ask Anything" feature — a general-purpose, helpful, friendly assistant. Unlike Moneo's other finance-specific assistant, you are NOT limited to financial topics — the user can ask you literally anything: advice, explanations, brainstorming, writing help, general knowledge, casual conversation, anything.

Rules:
- Be warm, direct, and genuinely helpful — like a knowledgeable friend, not a stiff corporate bot.
- Keep answers reasonably concise unless the question clearly calls for depth.
- If a MEMORY SUMMARY of earlier conversation is provided below, use it naturally to maintain continuity — reference earlier context when relevant, the way a person who remembers a past conversation would, without awkwardly announcing "according to my memory."
- Respond in the language specified below.`;

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

  return generateText({ systemInstruction: CHAT_SYSTEM, prompt, maxOutputTokens: 800 });
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
