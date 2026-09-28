import React, { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { motion, animate } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Wallet, CreditCard, PiggyBank, ArrowUp, ArrowDown, Calendar, ChevronDown, ChevronRight,
  Send, Sparkles, Flame, Plus, ScanLine, Bot, Target, ShieldCheck, Laptop, ArrowRight, BarChart3,
} from "lucide-react";
import Logo from "../components/Logo";
import bannerImage from "../assets/seoul-banner.jpg";
import towerImage from "../assets/seoul-tower.jpg";
import { useApp } from "../context/AppContext";
import CategoryIcon from "../components/CategoryIcon";
import { categoryById, categoryLabel } from "../data/categories";
import { getProactiveInsight, getAssistantResponse } from "../services/assistantService";
import { savingStreak, currency, goalProgress } from "../utils/calculations";
import { parseLocalDate } from "../utils/dates";

// ---------- helpers (all relative to the month picked in the header) ----------

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const sum = (list) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);

function inMonth(tx, y, m) {
  const d = parseLocalDate(tx.date);
  return d.getFullYear() === y && d.getMonth() === m;
}
function beforeMonthEnd(tx, y, m) {
  return parseLocalDate(tx.date) < new Date(y, m + 1, 1);
}
function pctChange(now, before) {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 100);
}
function shortWon(v) {
  const n = Math.abs(v);
  if (n >= 1000000) return `₩${(v / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 1000) return `₩${Math.round(v / 1000)}K`;
  return `₩${v}`;
}

function useCountUp(value, duration = 1.1) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration, ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
      onComplete: () => { from.current = value; },
    });
    return () => { controls.stop(); from.current = value; };
  }, [value, duration]);
  return display;
}

const CARD_ANIM = (i) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay: 0.06 * i, ease: [0.2, 0.8, 0.2, 1] },
});

function StatTile({ i, label, value, change, goodWhenUp, icon: Icon, tone, lang, sub }) {
  const animated = useCountUp(value);
  const up = change !== null && change >= 0;
  const good = change === null ? null : (up === goodWhenUp);
  return (
    <motion.div className={"mo-stat " + tone} {...CARD_ANIM(i)}>
      <div className="mo-stat-top">
        <span className="mo-stat-label">{label}</span>
        <span className={"mo-stat-icon " + tone}><Icon size={18} /></span>
      </div>
      <div className="mo-stat-value">{currency(animated, lang)}</div>
      <div className="mo-stat-sub">
        {change === null ? (
          <span className="muted">{sub}</span>
        ) : (
          <>
            <span className={good ? "good" : "bad"}>{up ? <ArrowUp size={13} /> : <ArrowDown size={13} />}{Math.abs(change)}%</span>
            <span className="muted">{lang === "ko" ? "지난달 대비" : "vs last month"}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ---------- page ----------

export default function Dashboard() {
  const { data, lang, t, user, assistantMode, unlockAchievement } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const L = (en, ko) => (lang === "ko" ? ko : en);
  const { transactions, budgets, goals = [] } = data;

  const now = new Date();
  const [sel, setSel] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [monthMenu, setMonthMenu] = useState(false);
  const [range, setRange] = useState("month"); // month | 6m

  // Months that have data (plus the current one), newest first.
  const monthOptions = useMemo(() => {
    const keys = new Set([monthKey(now.getFullYear(), now.getMonth())]);
    transactions.forEach((tx) => { const d = parseLocalDate(tx.date); if (!isNaN(d)) keys.add(monthKey(d.getFullYear(), d.getMonth())); });
    return [...keys].sort().reverse().slice(0, 12).map((k) => { const [y, m] = k.split("-").map(Number); return { y, m: m - 1 }; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const monthLabel = (y, m, style = "short") =>
    new Date(y, m, 1).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: style, year: "numeric" });

  const stats = useMemo(() => {
    const { y, m } = sel;
    const py = m === 0 ? y - 1 : y;
    const pm = m === 0 ? 11 : m - 1;
    const cur = transactions.filter((tx) => inMonth(tx, y, m));
    const prev = transactions.filter((tx) => inMonth(tx, py, pm));
    const exp = (list) => sum(list.filter((tx) => tx.type === "expense"));
    const inc = (list) => sum(list.filter((tx) => tx.type === "income"));

    const balanceAt = (yy, mm) => {
      const upTo = transactions.filter((tx) => beforeMonthEnd(tx, yy, mm));
      return inc(upTo) - exp(upTo);
    };
    const balance = balanceAt(y, m);
    const prevBalance = balanceAt(py, pm);

    const totalLimit = budgets.reduce((s, b) => s + (Number(b.limit) || 0), 0);
    const budgetCats = new Set(budgets.map((b) => b.category));
    const spentInBudgets = (list) => exp(list.filter((tx) => budgetCats.has(tx.category)));
    const remaining = totalLimit - spentInBudgets(cur);
    const prevRemaining = totalLimit - spentInBudgets(prev);

    const byCat = {};
    cur.filter((tx) => tx.type === "expense").forEach((tx) => { byCat[tx.category] = (byCat[tx.category] || 0) + Number(tx.amount); });
    const spent = exp(cur);
    const categories = Object.entries(byCat)
      .map(([id, value]) => ({ id, value, name: categoryLabel(id, lang), color: categoryById(id).color, pct: spent ? Math.round((value / spent) * 100) : 0 }))
      .sort((a, b) => b.value - a.value);

    // Daily cumulative series for the month (stops at today for the current month)
    const days = new Date(y, m + 1, 0).getDate();
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    const lastDay = isCurrent ? now.getDate() : days;
    let ci = 0, cs = 0;
    const daily = [];
    for (let d = 1; d <= lastDay; d++) {
      cur.forEach((tx) => {
        if (parseLocalDate(tx.date).getDate() !== d) return;
        if (tx.type === "income") ci += Number(tx.amount); else cs += Number(tx.amount);
      });
      daily.push({ label: lang === "ko" ? `${m + 1}/${d}` : `${new Date(y, m, 1).toLocaleString("en-US", { month: "short" })} ${d}`, income: ci, spending: cs });
    }

    const six = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1);
      const list = transactions.filter((tx) => inMonth(tx, d.getFullYear(), d.getMonth()));
      six.push({ label: d.toLocaleString(lang === "ko" ? "ko-KR" : "en-US", { month: "short" }), income: inc(list), spending: exp(list) });
    }

    return {
      balance, balanceChange: pctChange(balance, prevBalance),
      spent, spentChange: pctChange(spent, exp(prev)), income: inc(cur),
      remaining, remainingChange: totalLimit ? pctChange(remaining, prevRemaining) : null, totalLimit,
      categories, daily, six,
    };
  }, [transactions, budgets, sel, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const recent = useMemo(
    () => [...transactions]
      .sort((a, b) => (parseLocalDate(b.date) - parseLocalDate(a.date)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 5),
    [transactions]
  );

  const streak = savingStreak(transactions, budgets);
  useEffect(() => { if (streak >= 7) unlockAchievement("streak_7"); }, [streak]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- inline AI chat ----------
  const firstName = (user?.name || "").split(" ")[0];
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [insightReady, setInsightReady] = useState(false);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setInsightReady(false);
    getProactiveInsight(data, lang, assistantMode).then((text) => {
      if (cancelled) return;
      setChat([{ from: "ai", text: `${L("Hi", "안녕하세요")} ${firstName}! ${text}` }]);
      setInsightReady(true);
    });
    return () => { cancelled = true; };
  }, [transactions.length, budgets.length, stats.spent, lang, assistantMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll only the chat box — scrollIntoView would drag the whole page down to this card.
  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

  async function ask(question) {
    const q = (question ?? chatInput).trim();
    if (!q || thinking) return;
    setChatInput("");
    setChat((c) => [...c, { from: "user", text: q }].slice(-6));
    setThinking(true);
    try {
      const answer = await getAssistantResponse(q, data, lang, assistantMode);
      setChat((c) => [...c, { from: "ai", text: answer }].slice(-6));
    } catch {
      setChat((c) => [...c, { from: "ai", text: L("Something went wrong. Please try again.", "문제가 생겼어요. 다시 시도해주세요.") }]);
    } finally {
      setThinking(false);
    }
  }

  function chatKeyDown(e) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return; // Korean IME
    e.preventDefault();
    ask();
  }

  const hour = now.getHours();
  const greet = hour < 12 ? L("Good morning", "좋은 아침이에요") : hour < 18 ? L("Good afternoon", "좋은 오후예요") : L("Good evening", "좋은 저녁이에요");
  const showWelcome = params.get("welcome") === "1";
  const hasData = transactions.length > 0;
  const chartData = range === "month" ? stats.daily : stats.six;

  return (
    <div className="mo-page mo-dash">
      {showWelcome && (
        <motion.div className="mo-welcome" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          🎉 {t("welcomeMessage")}, {user?.name}!
        </motion.div>
      )}

      <div className="mo-dash-head">
        <motion.div {...CARD_ANIM(0)}>
          <h1>{greet}, <span className="mo-gradient-text">{firstName}</span> <span className="mo-wave">👋</span></h1>
          <p>{L("Here's your financial overview for", "재정 현황이에요 ·")} {monthLabel(sel.y, sel.m, "long")}.</p>
        </motion.div>
        <div className="mo-dash-head-right">
          {streak > 0 && (
            <span className="mo-streak"><Flame size={15} /> {streak}{L("-day streak", "일 연속")}</span>
          )}
          <div className="mo-pop-wrap">
            <button type="button" className="mo-month-btn" onClick={() => setMonthMenu((v) => !v)} aria-expanded={monthMenu}>
              <Calendar size={15} /> {monthLabel(sel.y, sel.m)} <ChevronDown size={14} />
            </button>
            {monthMenu && (
              <div className="mo-pop mo-pop-right">
                {monthOptions.map(({ y, m }) => (
                  <button key={monthKey(y, m)} type="button" className={"mo-pop-item" + (y === sel.y && m === sel.m ? " selected" : "")} onClick={() => { setSel({ y, m }); setMonthMenu(false); }}>
                    {monthLabel(y, m, "long")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasData && (
        <motion.div className="mo-empty-hero" {...CARD_ANIM(1)}>
          <div>
            <h2>{L("Your financial journey starts here", "재정 관리를 여기서 시작해요")}</h2>
            <p>{L("Add your first transaction or scan a receipt — your dashboard fills in automatically.", "첫 거래를 추가하거나 영수증을 스캔하면 대시보드가 자동으로 채워져요.")}</p>
          </div>
          <div className="mo-empty-actions">
            <button type="button" className="mo-btn-gradient inline" onClick={() => navigate("/app/transactions?action=add")}><Plus size={16} /> {t("addTransaction")}</button>
            <button type="button" className="mo-btn-ghost" onClick={() => navigate("/app/transactions?action=scan")}><ScanLine size={16} /> {L("Scan receipt", "영수증 스캔")}</button>
          </div>
        </motion.div>
      )}

      <div className="mo-dash-layout">
        <div className="mo-dash-main">
          <div className="mo-stats">
            <StatTile i={1} tone="purple" icon={Wallet} lang={lang} label={L("Total Balance", "총 잔액")} value={stats.balance} change={stats.balanceChange} goodWhenUp sub={L("All-time income minus spending", "전체 수입 - 지출")} />
            <StatTile i={2} tone="red" icon={CreditCard} lang={lang} label={L("Total Spent", "총 지출")} value={stats.spent} change={stats.spentChange} goodWhenUp={false} sub={L("No data for last month", "지난달 데이터 없음")} />
            {stats.totalLimit > 0 ? (
              <StatTile i={3} tone="green" icon={PiggyBank} lang={lang} label={L("Remaining Budget", "남은 예산")} value={stats.remaining} change={stats.remainingChange} goodWhenUp sub="" />
            ) : (
              <motion.div className="mo-stat green" {...CARD_ANIM(3)}>
                <div className="mo-stat-top"><span className="mo-stat-label">{L("Remaining Budget", "남은 예산")}</span><span className="mo-stat-icon green"><PiggyBank size={18} /></span></div>
                <div className="mo-stat-value small">{L("No budgets yet", "예산 없음")}</div>
                <div className="mo-stat-sub"><Link to="/app/budgets">{t("createBudget")} →</Link></div>
              </motion.div>
            )}
          </div>

          <div className="mo-dash-row">
            <motion.section className="mo-card" {...CARD_ANIM(4)}>
              <div className="mo-card-head">
                <h3>{L("Spending Overview", "지출 개요")}</h3>
                <div className="mo-seg">
                  <button type="button" className={range === "month" ? "on" : ""} onClick={() => setRange("month")}>{L("This month", "이번 달")}</button>
                  <button type="button" className={range === "6m" ? "on" : ""} onClick={() => setRange("6m")}>{L("6 months", "6개월")}</button>
                </div>
                <div className="mo-legend">
                  <span><i style={{ background: "#22D3EE" }} />{t("income")}</span>
                  <span><i style={{ background: "#A855F7" }} />{L("Spending", "지출")}</span>
                </div>
              </div>
              <div className="mo-chart">
                {chartData.every((d) => !d.income && !d.spending) ? (
                  <div className="mo-chart-empty">{t("noTransactionsYet")}</div>
                ) : (
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22D3EE" stopOpacity={0.35} /><stop offset="1" stopColor="#22D3EE" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A855F7" stopOpacity={0.4} /><stop offset="1" stopColor="#A855F7" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A93B5" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: "#8A93B5" }} axisLine={false} tickLine={false} width={52} tickFormatter={shortWon} />
                      <Tooltip contentStyle={{ background: "#141A33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} labelStyle={{ color: "#C9D0EA" }} formatter={(v, name) => [currency(v, lang), name === "income" ? t("income") : L("Spending", "지출")]} />
                      <Area type="monotone" dataKey="income" stroke="#22D3EE" strokeWidth={2.5} fill="url(#gIncome)" animationDuration={1400} />
                      <Area type="monotone" dataKey="spending" stroke="#A855F7" strokeWidth={2.5} fill="url(#gSpend)" animationDuration={1600} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.section>

            <motion.section className="mo-card" {...CARD_ANIM(5)}>
              <div className="mo-card-head">
                <h3>{L("Categories", "카테고리")}</h3>
                <Link to="/app/analytics" className="mo-card-link">{L("See all", "전체 보기")}</Link>
              </div>
              {stats.categories.length === 0 ? (
                <div className="mo-chart-empty">{t("noTransactionsYet")}</div>
              ) : (
                <div className="mo-donut-wrap">
                  <div className="mo-donut">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={stats.categories} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} animationDuration={1200}>
                          {stats.categories.map((c) => <Cell key={c.id} fill={c.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mo-donut-center">
                      <b>{currency(stats.spent, lang)}</b>
                      <span>{L("spent", "지출")}</span>
                    </div>
                  </div>
                  <ul className="mo-cat-list">
                    {stats.categories.slice(0, 5).map((c) => (
                      <li key={c.id}><i style={{ background: c.color }} /><span>{c.name}</span><b>{c.pct}%</b></li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.section>
          </div>

          <div className="mo-dash-row even">
            <motion.section className="mo-card" {...CARD_ANIM(6)}>
              <div className="mo-card-head">
                <h3>{t("recentTransactions")}</h3>
                <Link to="/app/transactions" className="mo-card-link">{L("See all", "전체 보기")}</Link>
              </div>
              {recent.length === 0 ? (
                <div className="mo-chart-empty">{t("noTransactionsYet")}</div>
              ) : (
                <ul className="mo-tx-list">
                  {recent.map((tx) => (
                    <li key={tx.id}>
                      <button type="button" onClick={() => navigate(`/app/transactions?q=${encodeURIComponent(tx.merchant || "")}`)}>
                        <CategoryIcon categoryId={tx.type === "income" ? "other" : tx.category} withBg />
                        <span className="mo-tx-main">
                          <b><span>{tx.merchant || categoryLabel(tx.category, lang)}</span>{tx.source === "ai_receipt" && <em>AI</em>}</b>
                          {tx.merchantOriginal && <span className="mo-tx-original">{tx.merchantOriginal}</span>}
                          <small>{parseLocalDate(tx.date).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", year: "numeric" })} · {tx.type === "income" ? t("income_") : categoryLabel(tx.category, lang)}</small>
                        </span>
                        <span className={"mo-tx-amt " + (tx.type === "income" ? "in" : "out")}>{tx.type === "income" ? "+ " : "- "}{currency(tx.amount, lang)}</span>
                        <ChevronRight size={16} className="mo-tx-chev" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            <motion.section className="mo-card" {...CARD_ANIM(7)}>
              <div className="mo-card-head">
                <h3>{t("goals")}</h3>
                <Link to="/app/goals" className="mo-card-link">{L("See all", "전체 보기")}</Link>
              </div>
              {goals.length === 0 ? (
                <div className="mo-chart-empty">
                  <div>
                    <p style={{ margin: "0 0 12px" }}>{L("Save toward something you care about.", "소중한 무언가를 위해 저축해보세요.")}</p>
                    <button type="button" className="mo-btn-ghost" onClick={() => navigate("/app/goals")}><Target size={16} /> {L("Create a goal", "목표 만들기")}</button>
                  </div>
                </div>
              ) : (
                <div className="mo-goals-list">
                  {goals.slice(0, 1).map((g) => {
                    const pct = Math.round(goalProgress(g) * 100);
                    return (
                      <button key={g.id} type="button" className="mo-goal-hero" onClick={() => navigate("/app/goals")}>
                        <span className="mo-goal-ring">
                          <svg viewBox="0 0 64 64" aria-hidden="true">
                            <defs><linearGradient id="goalRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#4F7BFF" /></linearGradient></defs>
                            <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                            <motion.circle cx="32" cy="32" r="27" fill="none" stroke="url(#goalRing)" strokeWidth="7" strokeLinecap="round" strokeDasharray="169.6" initial={{ strokeDashoffset: 169.6 }} animate={{ strokeDashoffset: 169.6 * (1 - pct / 100) }} transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }} />
                          </svg>
                          <b>{pct}%</b>
                        </span>
                        <span className="mo-goal-hero-info">
                          <b>{g.name}</b>
                          <small>{currency(g.current, lang)} / {currency(g.target, lang)}</small>
                          <span className="mo-goal-bar"><motion.i initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 1.2, delay: 0.6 }} /></span>
                        </span>
                        <ChevronRight size={16} className="mo-tx-chev" />
                      </button>
                    );
                  })}
                  {goals.slice(1, 3).map((g, i) => {
                    const pct = Math.round(goalProgress(g) * 100);
                    const GoalIcon = [ShieldCheck, Laptop][i] || Target;
                    return (
                      <button key={g.id} type="button" className="mo-goal-item" onClick={() => navigate("/app/goals")}>
                        <span className="mo-goal-icon"><GoalIcon size={18} /></span>
                        <span className="mo-goal-hero-info">
                          <span className="mo-goal-item-top"><b>{g.name}</b><em>{pct}%</em></span>
                          <small>{currency(g.current, lang)} / {currency(g.target, lang)}</small>
                          <span className="mo-goal-bar"><motion.i initial={{ width: 0 }} animate={{ width: pct + "%" }} transition={{ duration: 1.2, delay: 0.7 + i * 0.1 }} /></span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.section>
          </div>

          <motion.section className="mo-banner" {...CARD_ANIM(8)}>
            <img src={bannerImage} alt="" />
            <div className="mo-banner-body">
              <span className="mo-banner-icon"><Sparkles size={20} /></span>
              <div>
                <h3>{L("Smarter money decisions, with AI", "AI와 함께하는 더 현명한 소비")}</h3>
                <p>{L("Get personalized insights, budgeting tips, and answers to any money question.", "맞춤 인사이트, 예산 팁, 그리고 어떤 돈 질문에도 답을 받아보세요.")}</p>
              </div>
              <button type="button" className="mo-btn-gradient inline" onClick={() => navigate("/app/ask")}>{L("Try Moneo AI", "Moneo AI 사용하기")} <ArrowRight size={16} /></button>
            </div>
          </motion.section>
        </div>

        <aside className="mo-dash-side">
          <motion.section className="mo-card mo-scan-card" {...CARD_ANIM(3)}>
            <div className="mo-scan-art" aria-hidden="true">
              <svg viewBox="0 0 120 120" width="104" height="104">
                <defs>
                  <linearGradient id="phoneG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F7BFF" /><stop offset="1" stopColor="#A855F7" /></linearGradient>
                </defs>
                <ellipse cx="60" cy="108" rx="34" ry="6" fill="rgba(79,123,255,0.25)" />
                <rect x="30" y="10" width="52" height="92" rx="10" fill="url(#phoneG)" />
                <rect x="35" y="18" width="42" height="76" rx="6" fill="#0E1430" />
                <rect x="56" y="36" width="40" height="54" rx="4" fill="#F4F6FF" />
                <rect x="61" y="44" width="24" height="3" rx="1.5" fill="#A5B0D6" />
                <rect x="61" y="51" width="30" height="3" rx="1.5" fill="#CBD2EA" />
                <rect x="61" y="58" width="20" height="3" rx="1.5" fill="#CBD2EA" />
                <rect x="61" y="70" width="30" height="4" rx="2" fill="#4F7BFF" />
                <rect className="mo-scan-beam" x="52" y="40" width="48" height="2.5" rx="1" fill="#22D3EE" />
              </svg>
            </div>
            <h3>{L("Scan your receipts", "영수증을 스캔하세요")}</h3>
            <p>{L("Turn your receipts into organized transactions with AI.", "AI로 영수증을 정리된 거래 내역으로 바꿔보세요.")}</p>
            <button type="button" className="mo-btn-gradient" onClick={() => navigate("/app/transactions?action=scan")}>
              <ScanLine size={16} /> {L("Scan Receipt", "영수증 스캔")}
            </button>
          </motion.section>

          <motion.section className="mo-card mo-ai-card" {...CARD_ANIM(5)}>
            <div className="mo-card-head">
              <h3><span className="mo-ai-badge"><Bot size={15} /></span>{L("Moneo AI Assistant", "Moneo AI 어시스턴트")}</h3>
            </div>
            <div className="mo-ai-messages" ref={chatBoxRef}>
              {!insightReady && (
                <div className="mo-ai-msg ai"><span className="mo-typing"><i /><i /><i /></span></div>
              )}
              {chat.map((m, i) => (
                <motion.div key={i} className={"mo-ai-msg " + m.from} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  {m.from === "ai" && <Sparkles size={13} className="mo-ai-spark" />}
                  <span>{m.text}</span>
                </motion.div>
              ))}
              {thinking && <div className="mo-ai-msg ai"><span className="mo-typing"><i /><i /><i /></span></div>}
            </div>
            {chat.length <= 1 && (
              <div className="mo-ai-chips">
                <button type="button" onClick={() => ask(L("Can I afford ₩100,000 right now?", "지금 10만원 써도 괜찮아?"))}>{L("Can I afford this purchase?", "이거 사도 될까?")}</button>
                <button type="button" onClick={() => ask(L("How much did I spend this month?", "이번 달 얼마 썼어?"))}>{L("Show my spending summary", "지출 요약 보여줘")}</button>
                <button type="button" onClick={() => navigate("/app/budgets")}>{L("Set a monthly budget", "월 예산 설정하기")}</button>
              </div>
            )}
            <div className="mo-ai-input">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={chatKeyDown} placeholder={L("Type your question…", "질문을 입력하세요…")} aria-label={L("Ask Moneo AI", "Moneo AI에게 질문")} />
              <button type="button" onClick={() => ask()} disabled={thinking || !chatInput.trim()} aria-label={L("Send", "보내기")}><Send size={16} /></button>
            </div>
          </motion.section>

          <motion.section className="mo-card" {...CARD_ANIM(6)}>
            <div className="mo-card-head">
              <h3><BarChart3 size={16} className="mo-head-icon" />{L("This Month's Summary", "이번 달 요약")}</h3>
            </div>
            <ul className="mo-summary">
              <li><i style={{ background: "#22D3EE" }} /><span>{t("income")}</span><b className="in">{currency(stats.income, lang)}</b></li>
              <li><i style={{ background: "#A855F7" }} /><span>{L("Spending", "지출")}</span><b className="out">{currency(stats.spent, lang)}</b></li>
              <li><i style={{ background: "#4F7BFF" }} /><span>{L("Savings", "저축")}</span><b className={stats.income - stats.spent >= 0 ? "save" : "out"}>{currency(stats.income - stats.spent, lang)}</b></li>
            </ul>
          </motion.section>

          <motion.section className="mo-dream" {...CARD_ANIM(7)}>
            <img src={towerImage} alt="" />
            <div className="mo-dream-body">
              <p>{L("Small steps", "작은 걸음이")}<br />{L("build big dreams.", "큰 꿈을 만들어요.")}</p>
              <Logo size={16} textSize={13} />
            </div>
          </motion.section>
        </aside>
      </div>
    </div>
  );
}
