import "dotenv/config";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.js";
import receiptRoutes from "./routes/receipt.js";
import chatRoutes from "./routes/chat.js";
import { isConfigured, currentModel } from "./services/geminiService.js";

const app = express();

// On Render/Railway/Vercel the app sits behind one proxy. Trust it so req.ip is
// the visitor's real IP — otherwise every user shares the proxy's IP and the
// rate limit below would be shared by everyone.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 4000;

// Only let the Moneo frontend call this server. With the old cors() (allow
// everyone), any website you visited could quietly use your Gemini key
// through your running backend. Add more origins (e.g. your Vercel URL)
// comma-separated in ALLOWED_ORIGINS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // no Origin header = curl/Postman/same-origin — allow
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
app.use(express.json({ limit: "1mb" }));

// Tiny in-memory rate limit so a runaway loop (or someone else) can't burn
// through the Gemini quota. 30 AI requests per minute per IP.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const recent = (hits.get(key) || []).filter((ts) => now - ts < 60_000);
  if (recent.length >= 30) {
    return res.status(429).json({ error: "rate_limited", message: "Too many requests — please wait a minute and try again." });
  }
  recent.push(now);
  hits.set(key, recent);
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "moneo-backend" });
});

app.get("/api/ai/status", (req, res) => {
  res.json({ configured: isConfigured(), model: currentModel() });
});

app.use("/api/ai", rateLimit, aiRoutes);
app.use("/api/receipt", rateLimit, receiptRoutes);
app.use("/api/chat", rateLimit, chatRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.path}` });
});

// Last-resort error handler — never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Moneo backend running at http://localhost:${PORT}`);
  console.log(`Gemini configured: ${isConfigured() ? "yes" : "NO — add GEMINI_API_KEY in backend/.env"}`);
});
