// Pure functions that derive dashboard/analytics numbers from raw
// transactions + budgets + goals. Nothing here touches localStorage
// directly, so it's easy to test and reason about.

import { parseLocalDate, toLocalISODate } from "./dates";

function isThisMonth(dateStr) {
  const d = parseLocalDate(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function monthTransactions(transactions) {
  return transactions.filter((t) => isThisMonth(t.date));
}

export function totalIncome(transactions) {
  return monthTransactions(transactions)
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
}

export function totalExpenses(transactions) {
  return monthTransactions(transactions)
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
}

export function balance(transactions) {
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  return income - expense;
}

export function savings(transactions) {
  return totalIncome(transactions) - totalExpenses(transactions);
}

export function spendingByCategory(transactions) {
  const map = {};
  monthTransactions(transactions)
    .filter((t) => t.type === "expense")
    .forEach((t) => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
  return map;
}

export function topCategory(transactions) {
  const map = spendingByCategory(transactions);
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { category: entries[0][0], amount: entries[0][1] };
}

export function dailySpendSeries(transactions) {
  const map = {};
  monthTransactions(transactions)
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const day = parseLocalDate(t.date).getDate();
      map[day] = (map[day] || 0) + Number(t.amount);
    });
  const days = Object.keys(map).map(Number).sort((a, b) => a - b);
  let cumulative = 0;
  return days.map((d) => { cumulative += map[d]; return { day: d, amount: map[d], cumulative }; });
}

export function monthComparison(transactions) {
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthExpenses = transactions
    .filter((t) => t.type === "expense")
    .filter((t) => {
      const d = parseLocalDate(t.date);
      return d.getFullYear() === lastMonthDate.getFullYear() && d.getMonth() === lastMonthDate.getMonth();
    })
    .reduce((s, t) => s + Number(t.amount), 0);
  const thisMonthExpenses = totalExpenses(transactions);
  return { lastMonthExpenses, thisMonthExpenses };
}

export function budgetStatus(budgets, transactions) {
  const spend = spendingByCategory(transactions);
  return budgets.map((b) => {
    const spent = spend[b.category] || 0;
    const limit = Number(b.limit) || 0;
    const pct = limit > 0 ? Math.min(999, Math.round((spent / limit) * 100)) : 0;
    let status = "ok";
    if (pct >= 100) status = "over";
    else if (pct >= 80) status = "close";
    return { ...b, limit, spent, remaining: limit - spent, pct, status };
  });
}

export function financialHealthScore(transactions, budgets, goals) {
  const income = totalIncome(transactions);
  const expenses = totalExpenses(transactions);
  const savingsRate = income > 0 ? Math.max(0, (income - expenses) / income) : 0;

  // Budget usage factor: reward staying within budgets
  const statuses = budgetStatus(budgets, transactions);
  const overCount = statuses.filter((s) => s.status === "over").length;
  const budgetFactor = statuses.length > 0 ? Math.max(0, 1 - overCount / statuses.length) : 0.7;

  // Consistency factor: how many distinct days had transactions logged this month
  const days = new Set(monthTransactions(transactions).map((t) => t.date)).size;
  const consistencyFactor = Math.min(1, days / 15);

  // Goal progress factor
  const goalFactor = goals.length > 0
    ? goals.reduce((s, g) => s + goalProgress(g), 0) / goals.length
    : 0.5;

  const score = Math.round(
    savingsRate * 40 + budgetFactor * 25 + consistencyFactor * 15 + goalFactor * 20
  );
  return Math.max(0, Math.min(100, score));
}

// Streak = consecutive days on which the user actually logged something
// AND (if they have budgets) kept that day's spending within the daily
// allowance. A day with nothing logged breaks the streak — before, days the
// user never opened the app counted as "under budget", so being away for
// 17 days produced a 17-day streak. Today only counts once something is
// logged; an empty today doesn't break yesterday's streak yet.
export function savingStreak(transactions, budgets) {
  if (!transactions || transactions.length === 0) return 0;

  const totalBudget = (budgets || []).reduce((s, b) => s + (Number(b.limit) || 0), 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAllowance = totalBudget > 0 ? totalBudget / daysInMonth : Infinity;

  const logged = new Set();
  const spentByDate = {};
  transactions.forEach((t) => {
    if (!t.date) return;
    logged.add(t.date);
    if (t.type === "expense") spentByDate[t.date] = (spentByDate[t.date] || 0) + (Number(t.amount) || 0);
  });

  const cursor = new Date(now);
  if (!logged.has(toLocalISODate(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const key = toLocalISODate(cursor);
    if (!logged.has(key)) break;
    if ((spentByDate[key] || 0) > dailyAllowance * 1.3) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function last6MonthsSeries(transactions) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return months.map(({ year, month, label }) => {
    let income = 0, expenses = 0;
    transactions.forEach((t) => {
      const d = parseLocalDate(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (t.type === "income") income += Number(t.amount);
        else expenses += Number(t.amount);
      }
    });
    return { month: label, income, expenses, savings: income - expenses };
  });
}

export function overallBudgetStatus(budgets, transactions) {
  if (!budgets || budgets.length === 0) return { pct: 0, label: "none" };
  const spend = spendingByCategory(transactions);
  const totalLimit = budgets.reduce((s, b) => s + Number(b.limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spend[b.category] || 0), 0);
  if (totalLimit <= 0) return { pct: 0, label: "none" };
  const pct = Math.round((totalSpent / totalLimit) * 100);
  const label = pct >= 100 ? "over" : pct >= 80 ? "close" : "ok";
  return { pct, label };
}

export function currency(n, lang = "en") {
  const val = Math.round(Number(n) || 0);
  return "₩" + val.toLocaleString(lang === "ko" ? "ko-KR" : "en-US");
}

// 0..1 progress toward a goal, safe against a 0/missing target.
export function goalProgress(goal) {
  const target = Number(goal?.target) || 0;
  const current = Number(goal?.current) || 0;
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, current / target));
}
