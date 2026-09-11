import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Receipt, BarChart3, Wallet, Target,
  StickyNote, MessageCircle, Settings, LogOut, Coins, Lightbulb, Sparkles,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Toast from "./Toast";

const NAV_ITEMS = [
  { to: "/app/dashboard", key: "dashboard", icon: LayoutDashboard },
  { to: "/app/transactions", key: "transactions", icon: Receipt },
  { to: "/app/analytics", key: "analytics", icon: BarChart3 },
  { to: "/app/budgets", key: "budgets", icon: Wallet },
  { to: "/app/goals", key: "goals", icon: Target },
  { to: "/app/notes", key: "notes", icon: StickyNote },
  { to: "/app/assistant", key: "assistant", icon: MessageCircle },
  { to: "/app/ask", key: "askAnything", icon: Sparkles },
  { to: "/app/settings", key: "settings", icon: Settings },
];

const TIPS_EN = [
  "Track daily expenses to see patterns in your spending habits.",
  "Scan a receipt right after you pay — it takes 10 seconds and you'll never forget a transaction.",
  "Set a budget for your top spending category first — it has the biggest impact.",
  "Ask the AI Advisor \"can I afford ___?\" before a big purchase — it checks your real numbers.",
];
const TIPS_KO = [
  "매일 지출을 기록하면 소비 패턴을 파악할 수 있어요.",
  "결제 직후 영수증을 스캔해보세요 — 10초면 충분하고, 거래를 놓치지 않아요.",
  "가장 지출이 큰 카테고리부터 예산을 설정해보세요 — 효과가 가장 커요.",
  "큰 지출 전에 AI 어드바이저에게 \"이거 감당할 수 있을까?\"라고 물어보세요.",
];

export default function Layout() {
  const { user, lang, t, logout } = useApp();
  const location = useLocation();
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS_EN.length), 12000);
    return () => clearInterval(id);
  }, []);

  const tips = lang === "ko" ? TIPS_KO : TIPS_EN;

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Coins size={22} color="#16A34A" />
          <span>Moneo 2.0</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
            >
              <item.icon size={18} />
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="pro-tip-box"
          >
            <div className="pro-tip-title"><Lightbulb size={14} /> {lang === "ko" ? "프로 팁" : "Pro Tip"}</div>
            <div className="pro-tip-text">{tips[tipIndex]}</div>
          </motion.div>
        </AnimatePresence>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
            <div>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>
            <LogOut size={16} /> {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="app-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {["dashboard", "transactions", "assistant", "askAnything", "settings"]
          .map((key) => NAV_ITEMS.find((item) => item.key === key))
          .map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) => "bottom-nav-link" + (isActive ? " active" : "")}
            >
              <item.icon size={19} />
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
      </nav>

      <Toast />
    </div>
  );
}
