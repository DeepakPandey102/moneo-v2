import React, { useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { useApp } from "../context/AppContext";
import {
  spendingByCategory, dailySpendSeries, totalIncome, totalExpenses,
  monthComparison, currency,
} from "../utils/calculations";
import { categoryLabel } from "../data/categories";

const COLORS = ["#34D399", "#10B981", "#FBBF24", "#A78BFA", "#F87171", "#2BB4C9", "#EC6FA8", "#6B8CFF", "#8890A3"];

// ₩2,600,000 → ₩2.6M so axis labels stay short on phones
function shortWon(v) {
  const n = Math.abs(v);
  if (n >= 1000000) return `₩${(v / 1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 1000) return `₩${Math.round(v / 1000)}K`;
  return `₩${v}`;
}

export default function Analytics() {
  const { data, lang, t } = useApp();
  const { transactions } = data;

  const catData = useMemo(() => {
    const map = spendingByCategory(transactions);
    return Object.entries(map).map(([id, value]) => ({ name: categoryLabel(id, lang), value }));
  }, [transactions, lang]);

  const daily = dailySpendSeries(transactions);
  const income = totalIncome(transactions);
  const expenses = totalExpenses(transactions);
  const { lastMonthExpenses, thisMonthExpenses } = monthComparison(transactions);

  const incomeExpenseData = [{ name: t("thisMonth"), income, expenses }];
  const comparisonData = [
    { name: lang === "ko" ? "지난달" : "Last month", amount: lastMonthExpenses },
    { name: lang === "ko" ? "이번달" : "This month", amount: thisMonthExpenses },
  ];

  return (
    <div className="page">
      <div className="page-header"><h1>{t("analytics")}</h1></div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title-row"><span className="card-title">{t("spendingByCategory")}</span></div>
          {catData.length === 0 ? <div className="empty-state">{t("noTransactionsYet")}</div> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => currency(v, lang)} />
                  <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 6 }} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title-row"><span className="card-title">{t("income")} vs {t("expenses")}</span></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={incomeExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A93B5" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8A93B5" }} width={52} tickFormatter={shortWon} />
                <Tooltip formatter={(v) => currency(v, lang)} />
                <Legend wrapperStyle={{ fontSize: 12.5, paddingTop: 6 }} iconSize={10} />
                <Bar dataKey="income" fill="#10B981" radius={[6, 6, 0, 0]} name={t("income")} />
                <Bar dataKey="expenses" fill="#F87171" radius={[6, 6, 0, 0]} name={t("expenses")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-title-row"><span className="card-title">{lang === "ko" ? "누적 지출 추세" : "Cumulative Spending Trend"}</span></div>
          {daily.length === 0 ? <div className="empty-state">{t("noTransactionsYet")}</div> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8A93B5" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8A93B5" }} width={52} tickFormatter={shortWon} />
                  <Tooltip formatter={(v) => currency(v, lang)} />
                  <Line type="monotone" dataKey="cumulative" stroke="#34D399" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title-row"><span className="card-title">{lang === "ko" ? "월 비교" : "Month Comparison"}</span></div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A93B5" }} />
                <YAxis tick={{ fontSize: 11, fill: "#8A93B5" }} width={52} tickFormatter={shortWon} />
                <Tooltip formatter={(v) => currency(v, lang)} />
                <Bar dataKey="amount" fill="#A78BFA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
