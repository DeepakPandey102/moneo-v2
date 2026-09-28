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
  "merchant_original": string,
  "date": "YYYY-MM-DD",
  "total": number,
  "currency": "KRW",
  "category": one of [${ALLOWED_CATEGORIES.join(", ")}],
  "payment_method": string,
  "items": [ { "name": string, "name_original": string, "quantity": number, "price": number } ],
  "confidence": number
}

Rules:
- "confidence" is your own honest 0-100 estimate of how certain you are about the extracted total and merchant, based on image clarity and receipt legibility. Do not default to a high number — score honestly. A blurry, faded, or partially cut-off receipt should score well below 90.
- If the date is not visible on the receipt, use today's date and lower your confidence accordingly.
- If individual items are not legible or not present, return an empty items array rather than guessing item names.
- "total" must reflect the final amount actually paid, not a subtotal.
- Never fabricate a merchant name — if genuinely unreadable, use "Unknown Merchant" and lower confidence.
- Language: the user message says which language the app is in. Write "merchant" and each item "name" in THAT language (translate Korean to natural English, or English to Korean). Keep brand names as brands (GS25, CU, Starbucks, Olive Young) and translate the rest, e.g. "GS25 수원영통점" → "GS25 Suwon Yeongtong Branch", "삼각김밥 참치마요" → "Tuna Mayo Triangle Kimbap". Put the exact text as printed on the receipt in "merchant_original" and "name_original". If the printed text is already in the app's language, the original is the same text.`;

// "Today" in the app's timezone, not UTC. toISOString() is UTC, so receipts
// scanned in Korea before 9am were dated yesterday when the date was missing.
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Seoul";
function todayISO() {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parseJsonLoose(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Model sometimes wraps the JSON in a sentence — grab the outermost {...}
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("not json");
  }
}

export function normalizeAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (typeof value !== "string") return 0;
  // Drop a decimal part first ("17,450.00" must be 17450, not 1745000).
  const withoutDecimals = value.replace(/[.,]\d{1,2}(?!\d)\s*$/, "");
  const digitsOnly = withoutDecimals.replace(/[^\d]/g, "");
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

export async function analyzeReceipt({ imageBase64, mimeType, language = "en" }) {
  const appLanguage = language === "ko" ? "Korean (한국어)" : "English";
  const raw = await generateFromImage({
    systemInstruction: SYSTEM_INSTRUCTION,
    imageBase64,
    mimeType,
    prompt: `Analyze this receipt and return the JSON as instructed. The app language is ${appLanguage}. Today's date is ${todayISO()}.`,
    // Room for translated + original names on long receipts (a cut-off JSON
    // reply can't be parsed and the whole scan would fail).
    maxOutputTokens: 1500,
    json: true,
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
        name: String(it.name || it.name_original || "").slice(0, 80),
        name_original: String(it.name_original || "").slice(0, 80),
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        price: normalizeAmount(it.price),
      }))
    : [];

  // Gemini is asked for 0-100, but sometimes answers on a 0-1 scale (0.96).
  // Without this, 0.96 rounded to 1% and a clear receipt showed "low confidence".
  let rawConfidence = Number(parsed.confidence) || 0;
  if (rawConfidence > 0 && rawConfidence <= 1) rawConfidence *= 100;
  const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

  return {
    merchant: String(parsed.merchant || parsed.merchant_original || "Unknown Merchant").slice(0, 120),
    merchant_original: String(parsed.merchant_original || "").slice(0, 120),
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
