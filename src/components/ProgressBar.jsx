import React from "react";
import { motion } from "framer-motion";

export default function ProgressBar({ pct, color = "#34D399", height = 8, bg = "rgba(255,255,255,0.08)" }) {
  const n = Number(pct);
  const clamped = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0; // NaN/Infinity -> 0 instead of "NaN%"
  return (
    <div style={{ background: bg, borderRadius: height, height }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ height, borderRadius: height, background: color }}
      />
    </div>
  );
}
