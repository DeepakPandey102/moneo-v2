import "dotenv/config";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.js";
import receiptRoutes from "./routes/receipt.js";
import chatRoutes from "./routes/chat.js";
import { isConfigured, currentModel } from "./services/geminiService.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors()); // local demo only — fine to allow all origins on localhost
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "moneo-backend" });
});

app.get("/api/ai/status", (req, res) => {
  res.json({ configured: isConfigured(), model: currentModel() });
});

app.use("/api/ai", aiRoutes);
app.use("/api/receipt", receiptRoutes);
app.use("/api/chat", chatRoutes);

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
