import { generateFromImage } from "./geminiService.js";

// Must match the frontend's category ids exactly (src/data/categories.js)
// so Gemini can never invent a category the UI doesn't know how to render.
export const ALLOWED_CATEGORIES = [
  "food", "transport", "shopping", "entertainment",
  "bills", "education", "health", "travel", "other",
];

const SYSTEM_INSTRUCTION = `You are a receipt analysis engine for Moneo, a personal finance app used primarily in Korea.

You will be shown a photo of a receipt. Extract structured data from it.

The receipt may be in Korean or English, and may come from a Korean convenience store (CU, GS25, 7-Eleven, E-Mart, Olive Young), a Starbucks Korea location, a restaurant, or a transportation receipt. Understand Korean store names, Korean numbers, and Korean date formats.

Normalize all monetary amounts to a plain integer number of Korean won (KRW), stripping the currency symbol/word and any thousands separators. For example, all of "₩17,450", "17,450원", and "KRW 17,450" must become the number 17450.

You MUST choose "category" from EXACTLY this list, with no exceptions and no invented categories: ${ALLOWED_CATEGORIES.join(", ")}.

Respond with ONLY a raw JSON object (no markdown fences, no explanation, no extra text) in exactly this shape:
{
  "merchant": string,
  "date": "YYYY-MM-DD",
  "total": number,
  "currency": "KRW",
  "category": one of [${ALLOWED_CATEGORIES.join(", ")}],
  "payment_method": string,
  "items": [ { "name": string, "quantity": number, "price": number } ],
  "confidence": number
}

Rules:
- "confidence" is your own honest 0-100 estimate of how certain you are about the extracted total and merchant, based on image clarity and receipt legibility. Do not default to a high number — score honestly. A blurry, faded, or partially cut-off receipt should score well below 90.
- If the date is not visible on the receipt, use today's date and lower your confidence accordingly.
- If individual items are not legible or not present, return an empty items array rather than guessing item names.
- "total" must reflect the final amount actually paid, not a subtotal.
- Never fabricate a merchant name — if genuinely unreadable, use "Unknown Merchant" and lower confidence.`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonLoose(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export function normalizeAmount(value) {
  if (typeof value === "number") return Math.round(value);
  if (typeof value !== "string") return 0;
  const digitsOnly = value.replace(/[^\d]/g, "");
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

export async function analyzeReceipt({ imageBase64, mimeType }) {
  const raw = await generateFromImage({
    systemInstruction: SYSTEM_INSTRUCTION,
    imageBase64,
    mimeType,
    prompt: "Analyze this receipt and return the JSON as instructed.",
    maxOutputTokens: 700,
  });

  let parsed;
  try {
    parsed = parseJsonLoose(raw);
  } catch (e) {
    const err = new Error("RECEIPT_PARSE_FAILED");
    err.code = "RECEIPT_PARSE_FAILED";
    err.raw = raw;
    throw err;
  }

  const category = ALLOWED_CATEGORIES.includes(parsed.category) ? parsed.category : "other";
  const items = Array.isArray(parsed.items)
    ? parsed.items.map((it) => ({
        name: String(it.name || "").slice(0, 80),
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        price: normalizeAmount(it.price),
      }))
    : [];

  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));

  return {
    merchant: String(parsed.merchant || "Unknown Merchant").slice(0, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayISO(),
    total: normalizeAmount(parsed.total),
    currency: "KRW",
    category,
    payment_method: String(parsed.payment_method || "").slice(0, 40) || "Unknown",
    items,
    confidence,
  };
}

export function confidenceLabel(confidence) {
  if (confidence >= 90) return "high";
  if (confidence >= 70) return "review";
  return "low";
}
