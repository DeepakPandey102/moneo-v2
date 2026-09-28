import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Lock, Eye, EyeOff, User, ArrowLeft, MailCheck, ShieldCheck, Sparkles,
  ScanLine, Globe, ChevronDown, Check, Wallet, Target, PiggyBank, UserPlus, Camera, Menu, X,
  MessageCircle, BellRing, Languages, Phone, ArrowRight,
} from "lucide-react";
import { TEAM, formatKoreanPhone, phoneHref } from "../data/team";
import { GitHubIcon, InstagramIcon } from "../components/icons/BrandIcons";
import { useApp } from "../context/AppContext";
import Logo from "../components/Logo";
import GoogleButton from "../components/GoogleButton";
import { useGoogleOneTap } from "../utils/useGoogleOneTap";
import heroImage from "../assets/seoul-night.jpg";

// One page for log in, sign up and "forgot password".
// mode: "login" | "signup" | "forgot"
export default function AuthPage({ initialMode = "login" }) {
  const { login, register, requestPasswordReset, t, lang, setLanguage } = useApp();
  const navigate = useNavigate();
  const L = (en, ko) => (lang === "ko" ? ko : en);

  const [mode, setMode] = useState(initialMode);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState(""); // set after a confirmation or reset email is sent
  const [langOpen, setLangOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  // The landing page is split into "pages" you switch between by clicking,
  // instead of one very long page you have to scroll through.
  const [view, setView] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const formRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => { setMode(initialMode); setError(""); setSentTo(""); }, [initialMode]);

  useGoogleOneTap({ enabled: mode !== "forgot", onError: setError });

  function switchMode(next) {
    setError("");
    setSentTo("");
    setShowPw(false);
    if (next === "login") navigate("/login");
    else if (next === "signup") navigate("/register");
    else setMode(next);
  }

  function goTo(next) {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // kept for the section buttons below
  const scrollTo = goTo;

  function getStarted() {
    switchMode("signup");
    goTo("home");
  }

  const NAV = [
    { id: "home", label: L("Home", "홈") },
    { id: "features", label: L("Features", "기능") },
    { id: "how", label: L("How it works", "사용 방법") },
    { id: "goals", label: L("Goals", "목표") },
    { id: "about", label: L("About us", "소개") },
    { id: "faq", label: "FAQ" },
    { id: "contact", label: L("Contact", "문의") },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    // Read straight from the form: browser autofill can fill fields without
    // firing React's onChange.
    const fd = new FormData(formRef.current);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    setSubmitting(true);
    try {
      if (mode === "login") {
        if (!email || !password) { setError(L("Please enter your email and password.", "이메일과 비밀번호를 입력해주세요.")); return; }
        const result = await login(email, password);
        if (!result.ok) { setError(t(result.error)); return; }
        navigate("/app/dashboard");
      } else if (mode === "signup") {
        const name = String(fd.get("name") || "").trim();
        const confirm = String(fd.get("confirmPassword") || "");
        const result = await register(name, email, password, confirm);
        if (!result.ok) { setError(t(result.error)); return; }
        if (result.needsConfirmation) setSentTo(email);
        else navigate("/app/dashboard?welcome=1");
      } else if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        if (!result.ok) { setError(t(result.error)); return; }
        setSentTo(email);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const heading = {
    login: [L("Welcome back", "다시 오신 걸 환영해요"), L("Log in to see this month's overview.", "로그인하고 이번 달 현황을 확인하세요.")],
    signup: [L("Create your account", "계정 만들기"), L("Start tracking in under a minute — it's free.", "1분이면 시작할 수 있어요 — 무료예요.")],
    forgot: [L("Forgot your password?", "비밀번호를 잊으셨나요?"), L("Enter the email you signed up with and we'll send you a reset link.", "가입한 이메일을 입력하면 재설정 링크를 보내드려요.")],
  }[mode];

  return (
    <div className="mo-landing" ref={topRef}>
      {/* ---------- Hero: photo, nav, headline, auth card ---------- */}
      <section className={"mo-hero" + (view !== "home" ? " is-page" : "")}>
        <img className="mo-hero-bg" src={heroImage} alt="" />
        <div className="mo-hero-scrim" />

        <nav className="mo-landing-nav">
          <button type="button" className="mo-logo-btn" onClick={() => goTo("home")} aria-label={L("Moneo home", "Moneo 홈")}>
            <Logo size={30} textSize={24} />
          </button>
          <div className="mo-landing-links">
            {NAV.map((n) => (
              <button key={n.id} type="button" className={view === n.id ? "active" : ""} onClick={() => goTo(n.id)} aria-current={view === n.id ? "page" : undefined}>
                {n.label}
              </button>
            ))}
          </div>
          <div className="mo-landing-actions">
            <div className="mo-lang">
              <button type="button" className="mo-lang-btn" onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen}>
                <Globe size={15} /> {lang === "ko" ? "한국어" : "EN"} <ChevronDown size={14} />
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div className="mo-lang-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <button type="button" onClick={() => { setLanguage("en"); setLangOpen(false); }}>English {lang === "en" && <Check size={14} />}</button>
                    <button type="button" onClick={() => { setLanguage("ko"); setLangOpen(false); }}>한국어 {lang === "ko" && <Check size={14} />}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button type="button" className="mo-btn-outline" onClick={getStarted}>{L("Get started", "시작하기")}</button>
            <button type="button" className="mo-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label={L("Menu", "메뉴")}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          <AnimatePresence>
            {menuOpen && (
              <motion.div className="mo-mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {NAV.map((n) => (
                  <button key={n.id} type="button" className={view === n.id ? "active" : ""} onClick={() => goTo(n.id)}>{n.label}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <AnimatePresence mode="wait">
        {view === "home" ? (
        <motion.div key="home" className="mo-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
        <div className="mo-hero-body">
          <div className="mo-hero-copy">
            <motion.div className="mo-badge" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="mo-badge-dot" /> {L("Smart Finance for a Brighter Tomorrow", "더 밝은 내일을 위한 스마트 금융")}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
              {L("Smart personal finance,", "똑똑한 개인 금융,")}<br />
              <span className="mo-gradient-text">{L("made in Korea.", "한국에서 만들었어요.")}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}>
              {L(
                "Track spending, scan receipts, set budgets, and ask Moneo AI whether you can afford it — in English or Korean.",
                "지출을 기록하고, 영수증을 스캔하고, 예산을 세우고, 살 수 있을지 Moneo AI에게 물어보세요 — 한국어와 영어 모두 가능해요."
              )}
            </motion.p>

            <motion.div className="mo-hero-features" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.35 }}>
              <span><span className="mo-feat-icon cyan"><Sparkles size={16} /></span>{L("AI Assistant", "AI 어시스턴트")}</span>
              <span><span className="mo-feat-icon blue"><ScanLine size={16} /></span>{L("Receipt Scan", "영수증 스캔")}</span>
              <span><span className="mo-feat-icon purple"><ShieldCheck size={16} /></span>{L("Security", "보안")}</span>
            </motion.div>

            <div className="mo-float-row">
              <motion.div className="mo-float-card mo-float-a" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}>
                <div className="mo-ring">
                  <svg viewBox="0 0 44 44" aria-hidden="true">
                    <defs>
                      <linearGradient id="moRingGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#34D399" />
                      </linearGradient>
                    </defs>
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                    <circle className="mo-ring-fill" cx="22" cy="22" r="18" fill="none" stroke="url(#moRingGrad)" strokeWidth="5" strokeLinecap="round" strokeDasharray="113" strokeDashoffset="43" />
                  </svg>
                </div>
                <div className="mo-float-text">
                  <span className="mo-float-label">{L("Food budget", "식비 예산")}</span>
                  <span className="mo-float-big">62%</span>
                </div>
                <div className="mo-float-amount">
                  <span>₩186,000</span>
                  <div className="mo-mini-bar"><div className="mo-mini-bar-fill" style={{ width: "62%" }} /></div>
                </div>
              </motion.div>
              <motion.div className="mo-float-card mo-float-b" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}>
                <div className="mo-receipt-icon"><ScanLine size={22} /><span className="mo-scan-line" /></div>
                <div className="mo-float-text">
                  <span className="mo-float-title">{L("AI receipt scanned", "AI 영수증 인식 완료")}</span>
                  <span className="mo-float-label">GS25 · ₩15,000</span>
                </div>
                <span className="mo-check"><Check size={14} strokeWidth={3} /></span>
              </motion.div>
            </div>
          </div>

          {/* ---------- Auth card ---------- */}
          <motion.div className="mo-auth-card" initial={{ opacity: 0, y: 26, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
            <div className="mo-auth-brand"><Logo size={32} textSize={24} /></div>

            <AnimatePresence mode="wait">
              {sentTo ? (
                <motion.div key="sent" className="mo-auth-sent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="mo-sent-icon"><MailCheck size={28} /></div>
                  <h2 className="mo-auth-title">{L("Check your email", "이메일을 확인해주세요")}</h2>
                  <p className="mo-auth-sub">
                    {mode === "forgot"
                      ? L(`If an account exists for ${sentTo}, we sent a link to reset your password. Open it in this same browser.`, `${sentTo} 계정이 있다면 비밀번호 재설정 링크를 보냈어요. 같은 브라우저에서 열어주세요.`)
                      : L(`We sent a confirmation link to ${sentTo}. Click it, then come back to log in.`, `${sentTo}로 인증 링크를 보냈어요. 링크를 클릭한 뒤 다시 로그인해주세요.`)}
                  </p>
                  <button type="button" className="mo-btn-gradient" onClick={() => switchMode("login")}>{L("Back to log in", "로그인으로 돌아가기")}</button>
                  {mode === "forgot" && (
                    <button type="button" className="mo-link-btn center" onClick={() => setSentTo("")}>{L("Didn't get it? Send again", "메일이 안 왔나요? 다시 보내기")}</button>
                  )}
                </motion.div>
              ) : (
                <motion.div key={mode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  {mode === "forgot" && (
                    <button type="button" className="mo-back-btn" onClick={() => switchMode("login")}>
                      <ArrowLeft size={15} /> {L("Back to log in", "로그인으로 돌아가기")}
                    </button>
                  )}
                  <h2 className="mo-auth-title">{heading[0]}</h2>
                  <p className="mo-auth-sub">{heading[1]}</p>

                  <form ref={formRef} onSubmit={handleSubmit} className="mo-auth-form" noValidate>
                    {mode === "signup" && (
                      <label className="mo-field">
                        <User size={16} />
                        <input name="name" type="text" autoComplete="name" placeholder={t("fullName")} aria-label={t("fullName")} />
                      </label>
                    )}
                    <label className="mo-field">
                      <Mail size={16} />
                      <input name="email" type="email" autoComplete="email" placeholder={t("email")} aria-label={t("email")} />
                    </label>
                    {mode !== "forgot" && (
                      <label className="mo-field">
                        <Lock size={16} />
                        <input name="password" type={showPw ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={t("password")} aria-label={t("password")} />
                        <button type="button" className="mo-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? L("Hide password", "비밀번호 숨기기") : L("Show password", "비밀번호 보기")}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </label>
                    )}
                    {mode === "signup" && (
                      <>
                        <label className="mo-field">
                          <Lock size={16} />
                          <input name="confirmPassword" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder={t("confirmPassword")} aria-label={t("confirmPassword")} />
                        </label>
                        <p className="mo-hint">{t("passwordHint")}</p>
                      </>
                    )}
                    {mode === "login" && (
                      <div className="mo-forgot-row">
                        <button type="button" className="mo-link-btn" onClick={() => switchMode("forgot")}>{L("Forgot password?", "비밀번호를 잊으셨나요?")}</button>
                      </div>
                    )}

                    {error && <div className="mo-error" role="alert">{error}</div>}

                    <button type="submit" className="mo-btn-gradient" disabled={submitting}>
                      {submitting
                        ? L("Please wait…", "잠시만요…")
                        : mode === "login" ? t("login") : mode === "signup" ? L("Create account", "계정 만들기") : L("Send reset link", "재설정 링크 보내기")}
                    </button>
                  </form>

                  {mode !== "forgot" && (
                    <>
                      <div className="mo-divider"><span>{L("or", "또는")}</span></div>
                      <GoogleButton label={L("Continue with Google", "Google로 계속하기")} onError={setError} />
                      <p className="mo-auth-switch">
                        {mode === "login"
                          ? <>{L("Don't have an account?", "계정이 없으신가요?")} <button type="button" onClick={() => switchMode("signup")}>{L("Sign up free", "무료로 가입하기")}</button></>
                          : <>{L("Already have an account?", "이미 계정이 있으신가요?")} <button type="button" onClick={() => switchMode("login")}>{t("login")}</button></>}
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mo-secure"><ShieldCheck size={14} /> {L("Protected by Supabase row-level security", "Supabase 행 수준 보안으로 보호돼요")}</p>
          </motion.div>
        </div>

        <div className="mo-explore">
          <span>{L("Explore", "둘러보기")}</span>
          {NAV.filter((n) => n.id !== "home").map((n) => (
            <button key={n.id} type="button" onClick={() => goTo(n.id)}>{n.label} <ArrowRight size={13} /></button>
          ))}
        </div>
        </motion.div>
        ) : (
        <motion.div key={view} className="mo-view" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
      {view === "features" && (
      <section id="features" className="mo-section">
        <span className="mo-eyebrow">{L("Features", "기능")}</span>
        <h2 className="mo-section-title">{L("Everything your wallet needs", "지갑에 필요한 모든 것")}</h2>
        <div className="mo-feature-grid">
          {[
            { icon: Sparkles, c: "cyan", t: L("Moneo AI assistant", "Moneo AI 어시스턴트"), d: L("Ask “Can I afford ₩500,000?” and get an answer based on your real budgets and goals.", "“50만원 써도 돼?”라고 물어보면 실제 예산과 목표를 바탕으로 답해줘요.") },
            { icon: ScanLine, c: "blue", t: L("Receipt scanning", "영수증 스캔"), d: L("Snap a receipt from CU, GS25, Starbucks and more — the amount, store and category fill in for you.", "CU, GS25, 스타벅스 등 영수증을 찍으면 금액, 가게, 카테고리가 자동으로 입력돼요.") },
            { icon: Wallet, c: "purple", t: L("Budgets that warn early", "미리 알려주는 예산"), d: L("See at a glance when a category is close to its limit, before the month is over.", "한 달이 끝나기 전에 한도에 가까워진 카테고리를 한눈에 확인하세요.") },
          ].map((f, i) => (
            <motion.div key={i} className="mo-feature-card" {...reveal(i)}>
              <span className={"mo-feat-icon lg " + f.c}><f.icon size={20} /></span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>
      )}
      {view === "how" && (
      <section id="how" className="mo-section">
        <span className="mo-eyebrow">{L("How it works", "사용 방법")}</span>
        <h2 className="mo-section-title">{L("From a receipt to a smarter decision in four steps", "영수증에서 현명한 결정까지, 네 단계")}</h2>
        <div className="mo-how">
          {[
            { icon: UserPlus, t: L("Create your account", "계정 만들기"), d: L("Sign up with email or continue with Google. From the first second, your data is private to you.", "이메일로 가입하거나 Google로 계속하세요. 처음부터 내 데이터는 나만 볼 수 있어요."), chip: L("Email · Google", "이메일 · Google") },
            { icon: Camera, t: L("Record your spending", "지출 기록하기"), d: L("Add a transaction in seconds, or snap a receipt. Moneo AI reads the store, date, items and total — you check it before anything is saved.", "몇 초 만에 거래를 추가하거나 영수증을 찍으세요. Moneo AI가 가게, 날짜, 품목, 금액을 읽고 — 저장 전에 직접 확인해요."), chip: L("AI receipt scan", "AI 영수증 인식") },
            { icon: Target, t: L("Set budgets & goals", "예산과 목표 설정"), d: L("Give each category a monthly limit and save toward goals like a Jeju trip. Moneo warns you at 80% and when you go over.", "카테고리별 월 한도를 정하고 제주도 여행 같은 목표를 향해 저축하세요. 80%에 도달하거나 초과하면 알려드려요."), chip: L("Alerts at 80%", "80% 알림") },
            { icon: MessageCircle, t: L("Get answers & insights", "답변과 인사이트 받기"), d: L("Your dashboard shows where your money goes. Ask “Can I afford ₩50,000 today?” and Moneo answers from your own numbers.", "대시보드에서 돈의 흐름을 확인하세요. “오늘 5만원 써도 돼?”라고 물으면 내 데이터로 답해줘요."), chip: L("English · 한국어", "English · 한국어") },
          ].map((s, i) => (
            <motion.div key={i} className="mo-how-step" {...reveal(i)}>
              <div className="mo-how-top">
                <span className="mo-how-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="mo-how-icon"><s.icon size={20} /></span>
              </div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              <span className="mo-how-chip">{s.chip}</span>
            </motion.div>
          ))}
        </div>
      </section>
      )}
      {view === "goals" && (
      <section id="goals" className="mo-section">
        <div className="mo-goals-band">
          <motion.div {...reveal(0)}>
            <span className="mo-eyebrow">{L("Our goal", "우리의 목표")}</span>
            <h2 className="mo-section-title left">{L("Make every won count", "1원도 헛되지 않게")}</h2>
            <p className="mo-section-text">
              {L(
                "Most people don't overspend on purpose. It happens ₩5,000 at a time — a convenience-store snack, a late taxi, a delivery order — and by the end of the month the money is gone without a trace. Moneo's goal is to make your money visible and easy to control, so you can stop guessing and start saving for what you actually want.",
                "대부분은 일부러 과소비하지 않아요. 편의점 간식, 늦은 밤 택시, 배달 주문처럼 5천원씩 새어나가고, 월말이 되면 어디에 썼는지 모른 채 돈이 사라지죠. Moneo의 목표는 돈의 흐름을 보이게 하고 쉽게 관리하도록 도와, 추측을 멈추고 정말 원하는 것을 위해 저축하게 하는 것입니다."
              )}
            </p>
            <button type="button" className="mo-btn-gradient inline" onClick={getStarted}>{L("Start saving", "저축 시작하기")} <ArrowRight size={16} /></button>
          </motion.div>
          <motion.div className="mo-goal-demo" {...reveal(1)}>
            <div className="mo-goal-demo-title">{L("Your savings goals", "나의 저축 목표")}</div>
            {[{ n: L("Jeju trip", "제주도 여행"), p: 64, icon: Target }, { n: L("New laptop", "새 노트북"), p: 43, icon: PiggyBank }, { n: L("Emergency fund", "비상금"), p: 81, icon: ShieldCheck }].map((g, i) => (
              <div key={i} className="mo-goal-row">
                <span className="mo-feat-icon blue"><g.icon size={16} /></span>
                <div className="mo-goal-info">
                  <div className="mo-goal-top"><span>{g.n}</span><span>{g.p}%</span></div>
                  <div className="mo-mini-bar"><motion.div className="mo-mini-bar-fill" initial={{ width: 0 }} whileInView={{ width: g.p + "%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.2 + i * 0.15 }} /></div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="mo-reasons">
          {[
            { icon: Eye, t: L("Know where it goes", "어디에 쓰는지 알기"), d: L("Every expense is sorted into a category, and you can compare this month with last month at a glance.", "모든 지출이 카테고리로 정리되고, 이번 달과 지난달을 한눈에 비교할 수 있어요.") },
            { icon: BellRing, t: L("Stop overspending early", "과소비를 미리 막기"), d: L("Budget alerts arrive at 80% and at the limit — while there's still time to adjust.", "예산의 80%와 한도에 도달하면 알려줘요 — 아직 조절할 수 있을 때요.") },
            { icon: PiggyBank, t: L("Save for what matters", "중요한 것을 위해 저축"), d: L("Turn a wish into a target with a date, and watch your progress grow with every deposit.", "바람을 날짜가 있는 목표로 바꾸고, 저축할 때마다 진행률이 오르는 걸 확인하세요.") },
            { icon: Languages, t: L("Made for life in Korea", "한국 생활에 맞춤"), d: L("Won amounts, Korean receipts from CU, GS25 and more, and a full English · 한국어 app — great for students and international residents.", "원화 금액, CU·GS25 등 한국 영수증, 영어·한국어 완벽 지원 — 학생과 외국인 거주자에게 딱 맞아요.") },
          ].map((r, i) => (
            <motion.div key={i} className="mo-reason" {...reveal(i)}>
              <span className="mo-feat-icon cyan"><r.icon size={18} /></span>
              <div><h3>{r.t}</h3><p>{r.d}</p></div>
            </motion.div>
          ))}
        </div>
      </section>
      )}
      {view === "about" && (
      <section id="about" className="mo-section mo-about-page">
        <div className="mo-about-inner">
          <motion.div className="mo-about-intro" {...reveal(0)}>
            <span className="mo-eyebrow">{L("About us", "소개")}</span>
            <h2 className="mo-section-title">{L("Built by three students in Korea", "한국의 세 학생이 만들었어요")}</h2>
            <p>
              {L(
                "Moneo began as our capstone project with a simple question: why is it so hard to know where our money goes each month? We combined thoughtful design, a secure cloud database and Google's Gemini AI into one assistant that understands Korean receipts and speaks both English and Korean. Every feature was designed, built and tested by our team of three.",
                "Moneo는 “왜 매달 돈이 어디로 가는지 알기 어려울까?”라는 질문에서 시작한 캡스톤 프로젝트입니다. 세심한 디자인, 안전한 클라우드 데이터베이스, Google Gemini AI를 결합해 한국 영수증을 이해하고 영어와 한국어로 대화하는 비서를 만들었습니다. 모든 기능은 세 명의 팀원이 직접 설계하고, 개발하고, 테스트했습니다."
              )}
            </p>
          </motion.div>
          <div className="mo-team">
            {TEAM.map((m, i) => (
              <motion.article key={m.id} className="mo-team-card" {...reveal(i)}>
                <div className="mo-team-avatar"><span>{m.initials}</span></div>
                <h3>{m.name}</h3>
                <span className="mo-team-role">{m.role[lang] || m.role.en}</span>
                <p>{m.bio[lang] || m.bio.en}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
      )}
      {view === "faq" && (
      <section id="faq" className="mo-section mo-faq-wrap">
        <span className="mo-eyebrow">FAQ</span>
        <h2 className="mo-section-title">{L("Frequently asked questions", "자주 묻는 질문")}</h2>
        <div className="mo-faq">
          {FAQ(L).map((f, i) => (
            <motion.div key={i} className={"mo-faq-item" + (openFaq === i ? " open" : "")} {...reveal(i % 4)}>
              <button type="button" className="mo-faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} aria-expanded={openFaq === i}>
                <span>{f.q}</span>
                <ChevronDown size={18} className="mo-faq-chev" />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === i && (
                  <motion.div className="mo-faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <p>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>
      )}
      {view === "contact" && (
      <section id="contact" className="mo-section">
        <span className="mo-eyebrow">{L("Contact us", "문의하기")}</span>
        <h2 className="mo-section-title">{L("Talk to the team", "팀에게 연락하세요")}</h2>
        <p className="mo-section-lead">{L("Questions, feedback or ideas for Moneo? Reach any of us directly — we'd love to hear from you.", "Moneo에 대한 질문, 피드백, 아이디어가 있나요? 팀원에게 직접 연락해주세요.")}</p>
        <div className="mo-contact-grid">
          {TEAM.map((m, i) => (
            <motion.div key={m.id} className="mo-contact-card" {...reveal(i)}>
              <div className="mo-contact-head">
                <div className="mo-team-avatar sm"><span>{m.initials}</span></div>
                <div>
                  <h3>{m.name}</h3>
                  <span className="mo-team-role">{m.role[lang] || m.role.en}</span>
                </div>
              </div>
              <div className="mo-contact-links">
                {m.github && (
                  <a className="mo-contact-link github" href={`https://github.com/${m.github}`} target="_blank" rel="noopener noreferrer">
                    <span className="mo-contact-icon gh"><GitHubIcon size={18} /></span>
                    <span><small>GitHub</small>github.com/{m.github}</span>
                  </a>
                )}
                {m.phone && (
                  <a className="mo-contact-link" href={phoneHref(m.phone)}>
                    <span className="mo-contact-icon phone"><Phone size={17} /></span>
                    <span><small>{L("Phone", "전화")}</small>{formatKoreanPhone(m.phone)}</span>
                  </a>
                )}
                {m.email && (
                  <a className="mo-contact-link" href={`mailto:${m.email}`}>
                    <span className="mo-contact-icon mail"><Mail size={17} /></span>
                    <span><small>{L("Email", "이메일")}</small>{m.email}</span>
                  </a>
                )}
                {m.instagram && (
                  <a className="mo-contact-link" href={`https://instagram.com/${m.instagram}`} target="_blank" rel="noopener noreferrer">
                    <span className="mo-contact-icon ig"><InstagramIcon size={20} /></span>
                    <span><small>Instagram</small>@{m.instagram}</span>
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div className="mo-cta" {...reveal(0)}>
          <div>
            <h3>{L("Ready to make every won count?", "1원까지 현명하게 쓸 준비됐나요?")}</h3>
            <p>{L("Create your free account in under a minute.", "1분이면 무료 계정을 만들 수 있어요.")}</p>
          </div>
          <button type="button" className="mo-btn-gradient inline" onClick={getStarted}>{L("Get started free", "무료로 시작하기")} <ArrowRight size={16} /></button>
        </motion.div>
      </section>
      )}
      <footer className="mo-footer mo-footer-compact">
        <div className="mo-footer-top">
          <div className="mo-footer-brand">
            <Logo size={26} textSize={20} />
            <p>{L("Smart personal finance, made in Korea.", "똑똑한 개인 금융, 한국에서 만들었어요.")}</p>
          </div>
          <div className="mo-footer-cols">
            <div>
              <b>{L("Product", "제품")}</b>
              <button type="button" onClick={() => scrollTo("features")}>{L("Features", "기능")}</button>
              <button type="button" onClick={() => scrollTo("how")}>{L("How it works", "사용 방법")}</button>
              <button type="button" onClick={() => scrollTo("goals")}>{L("Goals", "목표")}</button>
            </div>
            <div>
              <b>{L("Team", "팀")}</b>
              <button type="button" onClick={() => scrollTo("about")}>{L("About us", "소개")}</button>
              <button type="button" onClick={() => scrollTo("faq")}>FAQ</button>
              <button type="button" onClick={() => scrollTo("contact")}>{L("Contact", "문의")}</button>
            </div>
          </div>
        </div>
        <div className="mo-footer-bottom">
          <span>© 2026 Moneo · Deepak Pandey, Renuka Thapa Magar, Rohit Rawal</span>
          <span className="mo-footer-small">{t("disclaimer")}</span>
        </div>
      </footer>

        </motion.div>
        )}
        </AnimatePresence>
      </section>

    </div>
  );
}

// Scroll-reveal animation shared by the sections above.
function reveal(i = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] },
  };
}

// Answers describe what the app really does — keep them in sync with features.
function FAQ(L) {
  return [
    { q: L("Is Moneo free to use?", "Moneo는 무료인가요?"), a: L("Yes. Moneo is a student capstone project and is completely free — no ads and no paid plans.", "네. Moneo는 학생 캡스톤 프로젝트로 완전히 무료예요 — 광고도, 유료 요금제도 없어요.") },
    { q: L("Does Moneo connect to my bank account?", "은행 계좌와 연결되나요?"), a: L("No. You add transactions yourself or scan receipts, so you never share bank or card passwords with us.", "아니요. 거래를 직접 추가하거나 영수증을 스캔하는 방식이라 은행이나 카드 비밀번호를 공유할 필요가 없어요.") },
    { q: L("Is my financial data safe?", "제 금융 데이터는 안전한가요?"), a: L("Your data is stored in Supabase with Row Level Security, which means the database itself only returns your rows to your logged-in account. All traffic uses HTTPS, and our AI key stays on our server, never in your browser.", "데이터는 행 수준 보안(RLS)이 적용된 Supabase에 저장돼요. 데이터베이스가 로그인한 본인에게만 본인의 데이터를 돌려줘요. 모든 통신은 HTTPS로 암호화되고, AI 키는 브라우저가 아닌 서버에만 있어요.") },
    { q: L("What does the AI see?", "AI는 어떤 정보를 보나요?"), a: L("Only what an AI feature needs, only when you use it: the receipt photo you scan, or a short summary of your budgets and recent spending when you ask a question. Receipt photos are processed in memory and never stored.", "AI 기능을 사용할 때 필요한 정보만 봐요: 스캔한 영수증 사진, 또는 질문할 때 예산과 최근 지출의 요약. 영수증 사진은 메모리에서만 처리되고 저장되지 않아요.") },
    { q: L("How accurate is receipt scanning?", "영수증 인식은 얼마나 정확한가요?"), a: L("Clear photos of printed receipts are usually read correctly, and Moneo shows a confidence score for every scan. You always review — and can edit — the result before it's saved.", "선명한 인쇄 영수증은 대부분 정확하게 인식되고, 스캔마다 신뢰도가 표시돼요. 저장 전에 항상 결과를 확인하고 수정할 수 있어요.") },
    { q: L("Can I use Moneo in Korean?", "한국어로 사용할 수 있나요?"), a: L("Yes. Switch between English and 한국어 at any time — the AI assistant answers in the language you choose.", "네. 언제든 영어와 한국어를 전환할 수 있고, AI 어시스턴트도 선택한 언어로 답해요.") },
    { q: L("Do I need to install an app?", "앱을 설치해야 하나요?"), a: L("No. Moneo runs in any modern browser on your phone, tablet or laptop.", "아니요. 휴대폰, 태블릿, 노트북의 최신 브라우저에서 바로 사용할 수 있어요.") },
    { q: L("I forgot my password. What now?", "비밀번호를 잊어버렸어요."), a: L("Click “Forgot password?” on the login card. We'll email you a reset link — open it in the same browser and choose a new password.", "로그인 화면의 “비밀번호를 잊으셨나요?”를 누르세요. 재설정 링크를 이메일로 보내드려요 — 같은 브라우저에서 열고 새 비밀번호를 정하세요.") },
    { q: L("Can I delete my data?", "데이터를 삭제할 수 있나요?"), a: L("Yes. You can clear all your data at any time in Settings. To delete your account completely, contact us and we'll remove it.", "네. 설정에서 언제든 모든 데이터를 지울 수 있어요. 계정 자체를 삭제하려면 저희에게 연락주시면 삭제해드려요.") },
  ];
}
