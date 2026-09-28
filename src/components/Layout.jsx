import React, { useState, useEffect, useMemo, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home, ArrowLeftRight, Wallet, Target, Bot, ReceiptText, StickyNote, BarChart3,
  Settings, Sparkles, Search, Bell, ChevronDown, LogOut, Globe, MoreHorizontal, AlertTriangle, CheckCircle2,
  ArrowRight, ShieldCheck,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { budgetStatus } from "../utils/calculations";
import { warmUpBackend } from "../services/assistantService";
import { categoryLabel } from "../data/categories";
import Logo from "./Logo";
import Toast from "./Toast";

// Question-like searches go to the AI assistant, everything else searches transactions.
const QUESTION_START = /^(can|how|what|why|should|is|am|do|does|when|where|which|who|얼마|왜|어떻게|뭐|언제|어디|할 수|해도)/i;

export default function Layout() {
  const { user, data, lang, t, logout, setLanguage } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const L = (en, ko) => (lang === "ko" ? ko : en);

  const NAV = [
    { to: "/app/dashboard", label: L("Home", "홈"), icon: Home },
    { to: "/app/transactions", label: t("transactions"), icon: ArrowLeftRight },
    { to: "/app/budgets", label: t("budgets"), icon: Wallet },
    { to: "/app/goals", label: t("goals"), icon: Target },
    { to: "/app/assistant", label: L("AI Assistant", "AI 어시스턴트"), icon: Bot },
    { to: "/app/ask", label: t("askAnything"), icon: Sparkles },
    { to: "/app/receipts", label: L("Receipts", "영수증"), icon: ReceiptText, matchSearch: "source=ai" },
    { to: "/app/notes", label: t("notes"), icon: StickyNote },
    { to: "/app/analytics", label: t("analytics"), icon: BarChart3 },
    { to: "/app/settings", label: t("settings"), icon: Settings },
  ];
  const MOBILE_PRIMARY = ["/app/dashboard", "/app/transactions", "/app/assistant", "/app/budgets"];

  const [query, setQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const bellRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => { setMoreOpen(false); setBellOpen(false); setUserOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { warmUpBackend(); }, []);

  // Close dropdowns when clicking elsewhere.
  useEffect(() => {
    function onDown(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Notifications = budgets that are over or close to their limit this month.
  const alerts = useMemo(() => {
    if (!data) return [];
    return budgetStatus(data.budgets, data.transactions)
      .filter((b) => b.status !== "ok")
      .sort((a, b) => b.pct - a.pct);
  }, [data]);

  function isActive(item) {
    if (item.matchSearch) return location.pathname === "/app/transactions" && location.search.includes(item.matchSearch);
    if (item.to === "/app/transactions") return location.pathname === item.to && !location.search.includes("source=ai");
    return location.pathname.startsWith(item.to);
  }

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setQuery("");
    if (q.endsWith("?") || QUESTION_START.test(q)) navigate(`/app/assistant?q=${encodeURIComponent(q)}`);
    else navigate(`/app/transactions?q=${encodeURIComponent(q)}`);
  }

  const initial = user?.name?.[0]?.toUpperCase() || "U";
  const Avatar = ({ size = 32 }) => user?.avatarUrl
    ? <img className="mo-avatar" src={user.avatarUrl} alt="" width={size} height={size} referrerPolicy="no-referrer" />
    : <span className="mo-avatar" style={{ width: size, height: size }}>{initial}</span>;

  const moreItems = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to));

  return (
    <div className="mo-shell">
      <aside className="mo-sidebar">
        <div className="mo-sidebar-brand"><Logo size={30} textSize={22} /></div>
        <nav className="mo-sidebar-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={() => "mo-side-link" + (isActive(item) ? " active" : "")}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mo-sidebar-ai">
          <h4>Moneo AI</h4>
          <p>{L("Ask anything about your money", "돈에 관한 무엇이든 물어보세요")}</p>
          <NavLink to="/app/ask" className="mo-start-chat">{L("Start Chat", "채팅 시작")} <ArrowRight size={14} /></NavLink>
          <svg className="mo-robot" width="70" height="78" viewBox="0 0 70 78" aria-hidden="true">
            <defs>
              <linearGradient id="botBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8EDFF" /><stop offset="1" stopColor="#B9C3F2" /></linearGradient>
              <linearGradient id="botVisor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1B2366" /><stop offset="1" stopColor="#3B2A8A" /></linearGradient>
            </defs>
            <line x1="35" y1="6" x2="35" y2="16" stroke="#B9C3F2" strokeWidth="3" strokeLinecap="round" />
            <circle cx="35" cy="6" r="4.5" fill="#A855F7" />
            <rect x="8" y="16" width="54" height="40" rx="18" fill="url(#botBody)" />
            <rect x="15" y="23" width="40" height="25" rx="12" fill="url(#botVisor)" />
            <circle cx="27" cy="35" r="4.5" fill="#22D3EE" />
            <circle cx="43" cy="35" r="4.5" fill="#22D3EE" />
            <rect x="2" y="30" width="7" height="14" rx="3.5" fill="#8E9BE0" />
            <rect x="61" y="30" width="7" height="14" rx="3.5" fill="#8E9BE0" />
            <rect x="20" y="58" width="30" height="16" rx="8" fill="url(#botBody)" />
          </svg>
        </div>
        <div className="mo-sidebar-safe">
          <ShieldCheck size={22} />
          <span><b>{L("Your data is safe with Moneo", "Moneo에서 데이터는 안전해요")}</b></span>
        </div>
      </aside>

      <div className="mo-main">
        <header className="mo-topbar">
          <div className="mo-topbar-logo"><Logo size={26} textSize={19} /></div>
          <form className="mo-search" onSubmit={handleSearch} role="search" noValidate>
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L("Search transactions, categories, or ask Moneo AI…", "거래, 카테고리를 검색하거나 Moneo AI에게 물어보세요…")}
              aria-label={L("Search or ask", "검색 또는 질문")}
            />
            <kbd>Enter</kbd>
          </form>

          <div className="mo-topbar-right">
            <div className="mo-pop-wrap" ref={bellRef}>
              <button type="button" className="mo-icon-btn" onClick={() => setBellOpen((v) => !v)} aria-label={L("Notifications", "알림")} aria-expanded={bellOpen}>
                <Bell size={18} />
                {alerts.length > 0 && <span className="mo-bell-dot" />}
              </button>
              <AnimatePresence>
                {bellOpen && (
                  <motion.div className="mo-pop mo-pop-right" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <div className="mo-pop-title">{L("Notifications", "알림")}</div>
                    {alerts.length === 0 ? (
                      <div className="mo-pop-empty"><CheckCircle2 size={16} /> {L("All budgets are on track.", "모든 예산이 잘 지켜지고 있어요.")}</div>
                    ) : alerts.map((b) => (
                      <button key={b.id} type="button" className="mo-pop-item" onClick={() => navigate("/app/budgets")}>
                        <AlertTriangle size={16} className={b.status === "over" ? "red" : "amber"} />
                        <span>
                          <b>{categoryLabel(b.category, lang)} · {b.pct}%</b>
                          <small>{b.status === "over" ? L("Over budget this month", "이번 달 예산 초과") : L("Close to the limit", "한도에 가까워요")}</small>
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mo-pop-wrap" ref={userRef}>
              <button type="button" className="mo-user-btn" onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen}>
                <Avatar />
                <span className="mo-user-name">{user?.name}</span>
                <ChevronDown size={15} />
              </button>
              <AnimatePresence>
                {userOpen && (
                  <motion.div className="mo-pop mo-pop-right" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <div className="mo-pop-user">
                      <Avatar size={40} />
                      <span><b>{user?.name}</b><small>{user?.email}</small></span>
                    </div>
                    <button type="button" className="mo-pop-item" onClick={() => navigate("/app/settings")}><Settings size={16} /> {t("settings")}</button>
                    <button type="button" className="mo-pop-item" onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}><Globe size={16} /> {lang === "ko" ? "English" : "한국어"}</button>
                    <button type="button" className="mo-pop-item danger" onClick={logout}><LogOut size={16} /> {t("logout")}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="mo-content">
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
      </div>

      {/* Mobile bottom nav + "More" sheet */}
      <nav className="bottom-nav">
        {MOBILE_PRIMARY.map((to) => NAV.find((n) => n.to === to)).map((item) => (
          <NavLink key={item.to} to={item.to} className={() => "bottom-nav-link" + (isActive(item) ? " active" : "")}>
            <item.icon size={19} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={"bottom-nav-link bottom-nav-more" + (moreOpen ? " active" : "")} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <MoreHorizontal size={19} />
          <span>{L("More", "더보기")}</span>
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div className="more-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
            <motion.div className="more-sheet" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}>
              {moreItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={() => "more-sheet-link" + (isActive(item) ? " active" : "")}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <button type="button" className="more-sheet-link more-sheet-logout" onClick={logout}>
                <LogOut size={18} />
                <span>{t("logout")}</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast />
    </div>
  );
}
