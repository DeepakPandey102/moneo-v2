import React from "react";
import { motion } from "framer-motion";

export default function ProgressBar({ pct, color = "#16A34A", height = 8, bg = "#EEF0F4" }) {
  const clamped = Math.max(0, Math.min(100, pct));
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
