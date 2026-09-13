// The ONLY file in this backend that talks to Google's SDK directly.
// Every route goes through the functions here, never the SDK itself —
// that keeps the model name and API key in exactly one place, per the
// project's "do not scatter model names / never expose the key" rules.

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// The literal placeholder text shipped in .env.example. This is NOT a key
// of any kind — it's just example text so we can tell "nothing filled in
// yet" apart from "a real key is set." Never compare against any other
// specific string here.
const UNSET_PLACEHOLDER = "your_gemini_api_key_here";

function hasRealKey() {
  return Boolean(API_KEY && API_KEY.trim() && API_KEY !== UNSET_PLACEHOLDER);
}

let client = null;
function getClient() {
  if (!hasRealKey()) {
    return null; // caller must handle this — never throws here
  }
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY });
  return client;
}

export function isConfigured() {
  return hasRealKey();
}

export function currentModel() {
  return MODEL;
}

/**
 * Plain text-in, text-out call with an optional system instruction.
 * Used for chat and proactive insight.
 *
 * Pass `useSearch: true` to ground the reply in live Google Search
 * results — this is what lets the model know the current date, recent
 * news, prices, or anything else that changes after its training
 * cutoff. When grounding is used, the resolved source URLs (if any)
 * come back in `sources` alongside the text.
 */
export async function generateText({ systemInstruction, prompt, maxOutputTokens = 500, useSearch = false }) {
  const genai = getClient();
  if (!genai) {
    const err = new Error("GEMINI_NOT_CONFIGURED");
    err.code = "GEMINI_NOT_CONFIGURED";
    throw err;
  }

  // Thinking and Google Search grounding can't both eat into the same
  // token/latency budget comfortably — when search is on we still turn
  // "thinking" off (see comment below) but allow the call a little more
  // headroom since grounded answers tend to cite sources and run longer.
  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      maxOutputTokens,
      // Gemini 2.5 Flash has "thinking" on by default, and thinking tokens
      // count against maxOutputTokens — without this, the model can burn
      // the entire budget on invisible reasoning and return a response
      // truncated mid-sentence. We want fast, direct answers here, not
      // extended reasoning, so thinking is turned off.
      thinkingConfig: { thinkingBudget: 0 },
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    },
  });

  const text = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    const err = new Error("GEMINI_EMPTY_RESPONSE");
    err.code = "GEMINI_EMPTY_RESPONSE";
    throw err;
  }

  if (!useSearch) return text.trim();

  // Pull out the grounding sources Gemini actually used, if any, so the
  // frontend can show "Sources" links under the reply.
  const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .map((c) => c?.web && { title: c.web.title, uri: c.web.uri })
    .filter(Boolean);

  return { text: text.trim(), sources };
}

/**
 * Image-in, text-out call for receipt analysis.
 * imageBase64 must NOT include the "data:image/...;base64," prefix.
 */
export async function generateFromImage({ systemInstruction, imageBase64, mimeType, prompt, maxOutputTokens = 800 }) {
  const genai = getClient();
  if (!genai) {
    const err = new Error("GEMINI_NOT_CONFIGURED");
    err.code = "GEMINI_NOT_CONFIGURED";
    throw err;
  }

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    }],
    config: {
      systemInstruction,
      maxOutputTokens,
      // Same fix as generateText() — see comment there. Receipt JSON
      // extraction doesn't need extended reasoning either.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    const err = new Error("GEMINI_EMPTY_RESPONSE");
    err.code = "GEMINI_EMPTY_RESPONSE";
    throw err;
  }
  return text.trim();
}
