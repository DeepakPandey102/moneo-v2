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
 */
export async function generateText({ systemInstruction, prompt, maxOutputTokens = 500 }) {
  const genai = getClient();
  if (!genai) {
    const err = new Error("GEMINI_NOT_CONFIGURED");
    err.code = "GEMINI_NOT_CONFIGURED";
    throw err;
  }

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
