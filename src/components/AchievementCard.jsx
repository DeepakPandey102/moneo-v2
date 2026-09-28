import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export const ACHIEVEMENT_DEFS = {
  first_transaction: { en: "First Transaction Logged", ko: "첫 거래 기록", icon: "🧾" },
  goal_started: { en: "Savings Goal Started", ko: "저축 목표 시작", icon: "🎯" },
  saved_100k: { en: "₩100,000 Saved", ko: "₩100,000 저축 달성", icon: "💰" },
  budget_created: { en: "First Budget Created", ko: "첫 예산 생성", icon: "🏆" },
  streak_7: { en: "7-Day Saving Streak", ko: "7일 연속 절약", icon: "🔥" },
};

export default function AchievementCard({ achievementKey, unlocked, lang }) {
  const def = ACHIEVEMENT_DEFS[achievementKey];
  if (!def) return null;
  return (
    <motion.div
      className={"achievement-card " + (unlocked ? "unlocked" : "locked")}
      initial={false}
      animate={unlocked ? { scale: [0.85, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={unlocked ? { y: -3 } : {}}
    >
      <div className="achievement-icon">{unlocked ? def.icon : <Lock size={16} />}</div>
      <div className="achievement-label">{lang === "ko" ? def.ko : def.en}</div>
    </motion.div>
  );
}
