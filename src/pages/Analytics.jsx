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

const COLORS = ["#16A34A", "#2FAE66", "#E0A83B", "#9B6BF2", "#E0563B", "#2BB4C9", "#EC6FA8", "#6B8CFF", "#9CA3AF"];

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
                  <Legend />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => currency(v, lang)} />
                <Legend />
                <Bar dataKey="income" fill="#2FAE66" radius={[6, 6, 0, 0]} name={t("income")} />
                <Bar dataKey="expenses" fill="#E0563B" radius={[6, 6, 0, 0]} name={t("expenses")} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F4" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => currency(v, lang)} />
                  <Line type="monotone" dataKey="cumulative" stroke="#16A34A" strokeWidth={2.5} dot={false} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => currency(v, lang)} />
                <Bar dataKey="amount" fill="#9B6BF2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
