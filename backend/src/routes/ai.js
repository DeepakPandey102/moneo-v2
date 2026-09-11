import express from "express";
import { chat, proactiveInsight } from "../services/assistantEngine.js";
import { isConfigured } from "../services/geminiService.js";

const router = express.Router();

function friendlyError(err) {
  if (err.code === "GEMINI_NOT_CONFIGURED") {
    return { status: 503, body: { error: "gemini_not_configured", message: "The AI assistant isn't set up yet. Add GEMINI_API_KEY in backend/.env and restart the server." } };
  }
  if (err.code === "GEMINI_EMPTY_RESPONSE") {
    return { status: 502, body: { error: "empty_response", message: "The AI didn't return a usable answer. Please try again." } };
  }
  return { status: 502, body: { error: "gemini_request_failed", message: "Couldn't reach the AI service. Check your internet connection and try again." } };
}

router.post("/chat", async (req, res) => {
  const { question, financialContext, language } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "invalid_request", message: "A 'question' string is required." });
  }
  if (!financialContext) {
    return res.status(400).json({ error: "invalid_request", message: "'financialContext' is required." });
  }
  try {
    const answer = await chat({ question, financialContext, language: language === "ko" ? "ko" : "en" });
    res.json({ answer });
  } catch (err) {
    console.error("[ai/chat] error:", err.message);
    const { status, body } = friendlyError(err);
    res.status(status).json(body);
  }
});

router.post("/insight", async (req, res) => {
  const { financialContext, language } = req.body || {};
  if (!financialContext) {
    return res.status(400).json({ error: "invalid_request", message: "'financialContext' is required." });
  }
  try {
    const insight = await proactiveInsight({ financialContext, language: language === "ko" ? "ko" : "en" });
    res.json({ insight });
  } catch (err) {
    console.error("[ai/insight] error:", err.message);
    const { status, body } = friendlyError(err);
    res.status(status).json(body);
  }
});

router.get("/status", (req, res) => {
  res.json({ configured: isConfigured() });
});

export default router;
