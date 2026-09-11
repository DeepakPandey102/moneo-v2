import React, { useEffect, useState } from "react";
import { motion, animate } from "framer-motion";

function useCountUp(target) {
  const match = String(target).match(/^([^\d-]*)([\d,.-]+)(.*)$/);
  const prefix = match ? match[1] : "";
  const numeric = match ? Number(match[2].replace(/,/g, "")) : 0;
  const suffix = match ? match[3] : "";
  const [display, setDisplay] = useState(prefix + "0" + suffix);

  useEffect(() => {
    const controls = animate(0, numeric, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate(v) {
        setDisplay(prefix + Math.round(v).toLocaleString() + suffix);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeric, prefix, suffix]);

  return display;
}

export default function StatCard({ label, value, icon: Icon, color = "#16A34A", accentBar, sub, subColor }) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -3, boxShadow: "0 8px 20px rgba(20,23,31,0.09)" }}
      className="stat-card"
      style={accentBar ? { borderLeft: `4px solid ${accentBar}` } : undefined}
    >
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {Icon && (
          <div className="stat-card-icon" style={{ background: color + "1A" }}>
            <Icon size={16} color={color} />
          </div>
        )}
      </div>
      <div className="stat-card-value">{animated}</div>
      {sub && <div className="stat-card-sub" style={subColor ? { color: subColor } : undefined}>{sub}</div>}
    </motion.div>
  );
}
