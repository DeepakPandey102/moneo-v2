import React, { useMemo, useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, PiggyBank, Target, Sparkles, ArrowRight, Flame, Plus, Camera } from "lucide-react";
import { useApp } from "../context/AppContext";
import StatCard from "../components/StatCard";
import ProgressBar from "../components/ProgressBar";
import CategoryIcon from "../components/CategoryIcon";
import { categoryLabel } from "../data/categories";
import { getProactiveInsight } from "../services/assistantService";
import {
  totalIncome, totalExpenses, savings, spendingByCategory,
  budgetStatus, monthComparison, savingStreak, last6MonthsSeries, overallBudgetStatus, currency,
} from "../utils/calculations";

function monthYearLabel(lang) {
  const now = new Date();
  return now.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "long", year: "numeric" });
}

const COLORS = ["#DC2626", "#F97316", "#EAB308", "#16A34A", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#9CA3AF"];

export default function Dashboard() {
  const { data, lang, t, user, assistantMode, unlockAchievement } = useApp();
  const [params] = useSearchParams();
  const showWelcome = params.get("welcome") === "1";

  const { transactions, budgets, goals } = data;
  const hasAnyData = transactions.length > 0;

  const income = totalIncome(transactions);
  const expenses = totalExpenses(transactions);
  const saved = savings(transactions);
  const catSpend = spendingByCategory(transactions);
  const statuses = budgetStatus(budgets, transactions);
  const { lastMonthExpenses, thisMonthExpenses } = monthComparison(transactions);
  const streak = savingStreak(transactions, budgets);
  const trend = useMemo(() => last6MonthsSeries(transactions), [transactions]);
  const budgetOverall = overallBudgetStatus(budgets, transactions);

  const incomeChangePct = lastMonthExpenses > 0 ? null : null; // reserved for future month-over-month income comparison
  const expenseChangePct = lastMonthExpenses > 0 ? Math.round(((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100) : null;
  const savingsRatePct = income > 0 ? Math.round((saved / income) * 100) : 0;

  const pieData = Object.entries(catSpend).map(([id, value]) => ({ name: categoryLabel(id, lang), value, id }));

  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  // Real proactive AI insight — fetched fresh whenever the underlying data,
  // language, or assistant mode changes. Not persisted; cheap to regenerate
  // per session, and always reflects the current state.
  const [aiInsight, setAiInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setInsightLoading(true);
    getProactiveInsight(data, lang, assistantMode).then((text) => {
      if (!cancelled) {
        setAiInsight(text);
        setInsightLoading(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, budgets.length, lang, assistantMode]);

  useEffect(() => {
    if (streak >= 7) unlockAchievement("streak_7");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  const budgetStatusText = budgetOverall.label === "none"
    ? (lang === "ko" ? "예산이 설정되지 않았어요" : "No budgets set")
    : budgetOverall.label === "over"
    ? (lang === "ko" ? "예산 초과" : "Over budget")
    : budgetOverall.label === "close"
    ? (lang === "ko" ? "예산 한도에 근접" : "Close to limit")
    : (lang === "ko" ? "예산 범위 내" : "Within budget limits");

  return (
    <div className="page">
      {showWelcome && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="welcome-banner">
          {t("welcomeMessage")}, {user?.name} 👋
        </motion.div>
      )}

      <div className="page-header">
        <div>
          <h1>{t("dashboard")}</h1>
          <p className="dashboard-subtitle">
            {lang === "ko" ? `${monthYearLabel(lang)} 재정 개요` : `Your financial overview for ${monthYearLabel(lang)}`}
          </p>
        </div>
        {streak > 0 && (
          <motion.div className="streak-badge" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} style={{ display: "inline-flex" }}>
              <Flame size={15} color="#E0A83B" fill="#E0A83B" />
            </motion.span>
            {streak} {t("days")} {t("streak")}
          </motion.div>
        )}
      </div>

      {!hasAnyData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="empty-hero">
          <div className="empty-hero-icon">💸</div>
          <div className="empty-hero-title">{lang === "ko" ? "Moneo에 오신 것을 환영해요" : "Welcome to Moneo"}</div>
          <div className="empty-hero-sub">{lang === "ko" ? "당신의 재정 여정이 여기서 시작돼요." : "Your financial journey starts here."}</div>
          <div className="empty-hero-actions">
            <Link to="/app/transactions" className="btn-primary"><Plus size={15} /> {t("addTransaction")}</Link>
            <Link to="/app/transactions" className="btn-secondary"><Camera size={15} style={{ marginRight: 6 }} />{lang === "ko" ? "영수증 스캔" : "Scan Receipt"}</Link>
          </div>
        </motion.div>
      )}

      <div className="stat-grid">
        <StatCard
          label={t("income")} value={currency(income, lang)} icon={TrendingUp} color="#16A34A" accentBar="#16A34A"
          sub={expenseChangePct === null ? undefined : undefined}
        />
        <StatCard
          label={t("expenses")} value={currency(expenses, lang)} icon={TrendingDown} color="#DC2626" accentBar="#DC2626"
          sub={expenseChangePct !== null ? `${expenseChangePct > 0 ? "+" : ""}${expenseChangePct}% ${lang === "ko" ? "지난달 대비" : "from last month"}` : undefined}
        />
        <StatCard
          label={t("savings")} value={currency(saved, lang)} icon={PiggyBank} color="#3B82F6" accentBar="#3B82F6"
          sub={income > 0 ? `${savingsRatePct}% ${lang === "ko" ? "수입 대비" : "of income"}` : undefined}
        />
        <StatCard
          label={lang === "ko" ? "예산 상태" : "Budget Status"} value={budgetOverall.label === "none" ? "—" : `${budgetOverall.pct}%`} icon={Target} color="#16A34A" accentBar="#16A34A"
          sub={budgetStatusText}
        />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title-row-col">
            <span className="card-title-lg">{lang === "ko" ? "지출 분석" : "Expense Breakdown"}</span>
            <span className="card-subtitle">{lang === "ko" ? "이번 달 카테고리별 지출" : "Your spending categories this month"}</span>
          </div>
          {pieData.length === 0 ? (
            <div className="empty-state">{t("noTransactionsYet")}</div>
          ) : (
            <>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={62} outerRadius={95} paddingAngle={2} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => currency(v, lang)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="dot-legend">
                {pieData.map((d, i) => (
                  <div key={d.id} className="dot-legend-item">
                    <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title-row-col">
            <span className="card-title-lg">{lang === "ko" ? "6개월 추세" : "6-Month Trend"}</span>
            <span className="card-subtitle">{lang === "ko" ? "기간별 수입 vs 지출" : "Income vs Expenses over time"}</span>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} width={44} />
                <Tooltip formatter={(v) => currency(v, lang)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income" name={t("income")} stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" name={t("expenses")} stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="savings" name={t("savings")} stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title-row">
            <span className="card-title">{t("budgetProgress")}</span>
            <Link to="/app/budgets" className="card-link">→</Link>
          </div>
          {statuses.length === 0 ? <div className="empty-state">{t("noBudgetsYet")}</div> : statuses.slice(0, 3).map((b) => (
            <div key={b.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{categoryLabel(b.category, lang)}</span>
                <span style={{ color: "#6B7280" }}>{currency(b.spent, lang)} / {currency(b.limit, lang)}</span>
              </div>
              <ProgressBar pct={b.pct} color={b.status === "over" ? "#DC2626" : b.status === "close" ? "#E0A83B" : "#16A34A"} />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title-row">
            <span className="card-title">{t("savingsGoalProgress")}</span>
            <Link to="/app/goals" className="card-link">→</Link>
          </div>
          {goals.length === 0 ? <div className="empty-state">{t("noGoalsYet")}</div> : goals.slice(0, 2).map((g) => (
            <div key={g.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span>{g.name}</span>
                <span style={{ color: "#6B7280" }}>{currency(g.current, lang)} / {currency(g.target, lang)}</span>
              </div>
              <ProgressBar pct={(g.current / g.target) * 100} color="#3B82F6" />
            </div>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title-row">
            <span className="card-title">{t("recentTransactions")}</span>
            <Link to="/app/transactions" className="card-link">→</Link>
          </div>
          {recent.length === 0 ? <div className="empty-state">{t("noTransactionsYet")}</div> : (
            <div className="tx-list">
              {recent.map((tx) => (
                <div key={tx.id} className="tx-row">
                  <CategoryIcon categoryId={tx.category} withBg />
                  <div className="tx-info">
                    <div className="tx-merchant">{tx.merchant || categoryLabel(tx.category, lang)}</div>
                    <div className="tx-date">{tx.date}</div>
                  </div>
                  <div className={"tx-amount " + (tx.type === "income" ? "positive" : "")}>
                    {tx.type === "income" ? "+" : "-"}{currency(tx.amount, lang)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card insight-card">
          <div className="card-title-row">
            <span className="card-title"><Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t("moneoInsight")}</span>
          </div>
          {insightLoading ? (
            <div className="insight-skeleton">
              <div className="skeleton-line" style={{ width: "90%" }} />
              <div className="skeleton-line" style={{ width: "65%" }} />
            </div>
          ) : (
            <p className="insight-text">{aiInsight}</p>
          )}
          {assistantMode === "api" && !insightLoading && (
            <p className="insight-source">
              {lang === "ko" ? "✨ Gemini가 실시간으로 분석했어요" : "✨ Generated live by Gemini"}
            </p>
          )}
          <Link to="/app/assistant" className="btn-secondary" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {t("assistant")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

