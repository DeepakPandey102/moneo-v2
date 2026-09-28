import express from "express";
import { getChatReply, summarizeForMemory, generateThreadTitle } from "../services/generalChatEngine.js";

const router = express.Router();

function friendlyError(err) {
  if (err.code === "GEMINI_NOT_CONFIGURED") {
    return { status: 503, body: { error: "gemini_not_configured", message: "AI isn't set up yet. Add GEMINI_API_KEY in backend/.env and restart the server." } };
  }
  if (err.code === "GEMINI_EMPTY_RESPONSE") {
    return { status: 502, body: { error: "empty_response", message: "The AI didn't return a usable answer. Please try again." } };
  }
  return { status: 502, body: { error: "gemini_request_failed", message: "Couldn't reach the AI service. Check your internet connection and try again." } };
}

// POST /api/chat/reply
// body: { message, recentMessages: [{role, content}], memorySummary, language }
router.post("/reply", async (req, res) => {
  const { message, recentMessages, memorySummary, language } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "invalid_request", message: "A 'message' string is required." });
  }
  try {
    const reply = await getChatReply({
      message,
      recentMessages: Array.isArray(recentMessages) ? recentMessages : [],
      memorySummary: memorySummary || "",
      language: language === "ko" ? "ko" : "en",
    });
    res.json({ reply });
  } catch (err) {
    console.error("[chat/reply] error:", err.message);
    const { status, body } = friendlyError(err);
    res.status(status).json(body);
  }
});

// POST /api/chat/summarize
// body: { messagesToSummarize: [{role, content}], previousSummary, language }
// Called by the frontend once a thread gets long, to fold older messages
// into a compact memory summary instead of resending the full history
// forever. This keeps "Ask Anything" remembering context cheaply.
router.post("/summarize", async (req, res) => {
  const { messagesToSummarize, previousSummary, language } = req.body || {};
  if (!Array.isArray(messagesToSummarize) || messagesToSummarize.length === 0) {
    return res.status(400).json({ error: "invalid_request", message: "'messagesToSummarize' must be a non-empty array." });
  }
  try {
    const summary = await summarizeForMemory({
      messagesToSummarize,
      previousSummary: previousSummary || "",
      language: language === "ko" ? "ko" : "en",
    });
    res.json({ summary });
  } catch (err) {
    console.error("[chat/summarize] error:", err.message);
    const { status, body } = friendlyError(err);
    res.status(status).json(body);
  }
});

// POST /api/chat/title
// body: { firstMessage, language }
router.post("/title", async (req, res) => {
  const { firstMessage, language } = req.body || {};
  if (!firstMessage || typeof firstMessage !== "string") {
    return res.status(400).json({ error: "invalid_request", message: "A 'firstMessage' string is required." });
  }
  try {
    const title = await generateThreadTitle({ firstMessage, language: language === "ko" ? "ko" : "en" });
    res.json({ title: title || "New Chat" });
  } catch (err) {
    console.error("[chat/title] error:", err.message);
    // Titling failure shouldn't block the chat — just fall back quietly.
    res.json({ title: "New Chat" });
  }
});

export default router;
