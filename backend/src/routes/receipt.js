import express from "express";
import multer from "multer";
import { analyzeReceipt, confidenceLabel } from "../services/receiptService.js";

const router = express.Router();

// Receipts stay in memory only — this is a local demo, nothing is written
// to disk. Cap at 8MB, image types only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

router.post("/analyze", (req, res) => {
  upload.single("receipt")(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.message === "INVALID_FILE_TYPE"
        ? "Please upload an image file (JPG, PNG, etc)."
        : "The file couldn't be uploaded — it may be too large (8MB max).";
      return res.status(400).json({ error: "invalid_file", message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "no_file", message: "No receipt image was provided." });
    }

    try {
      const imageBase64 = req.file.buffer.toString("base64");
      const result = await analyzeReceipt({ imageBase64, mimeType: req.file.mimetype });
      res.json({ ...result, confidence_label: confidenceLabel(result.confidence) });
    } catch (err) {
      console.error("[receipt/analyze] error:", err.message);
      if (err.code === "GEMINI_NOT_CONFIGURED") {
        return res.status(503).json({ error: "gemini_not_configured", message: "AI receipt scanning isn't set up yet. Add GEMINI_API_KEY in backend/.env and restart the server." });
      }
      if (err.code === "RECEIPT_PARSE_FAILED") {
        return res.status(502).json({ error: "unreadable_receipt", message: "Couldn't read that receipt clearly. Try a clearer photo, or enter the expense manually." });
      }
      if (err.code === "GEMINI_EMPTY_RESPONSE") {
        return res.status(502).json({ error: "empty_response", message: "The AI didn't return a result. Please try again." });
      }
      res.status(502).json({ error: "analysis_failed", message: "Couldn't analyze this receipt right now. Check your internet connection and try again." });
    }
  });
});

export default router;
