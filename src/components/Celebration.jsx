import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#34D399", "#10B981", "#FBBF24", "#A78BFA", "#F87171"];

function Piece({ i }) {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 70 + Math.random() * 50;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance - 30;
  const color = COLORS[i % COLORS.length];
  const isCircle = i % 2 === 0;
  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ x, y, opacity: 0, rotate: Math.random() * 360, scale: 0.6 }}
      transition={{ duration: 0.9 + Math.random() * 0.4, ease: "easeOut" }}
      style={{
        position: "absolute", left: "50%", top: "50%",
        width: 8, height: isCircle ? 8 : 12,
        background: color,
        borderRadius: isCircle ? "50%" : 2,
      }}
    />
  );
}

export default function Celebration({ trigger, label }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const timer = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <AnimatePresence>
      {show && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 1, height: 1 }}>
            {Array.from({ length: 18 }).map((_, i) => <Piece key={i} i={i} />)}
          </div>
          {label && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                position: "absolute", top: "42%", background: "var(--gradient-brand)", color: "#06120D",
                padding: "10px 18px", borderRadius: 30, fontSize: 13, fontWeight: 800,
                boxShadow: "0 8px 28px rgba(52,211,153,0.35)", whiteSpace: "nowrap",
              }}
            >
              {label}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
