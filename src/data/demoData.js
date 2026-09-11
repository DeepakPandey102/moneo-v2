// Generates realistic sample data for a brand-new user, dated within the
// current month, so the dashboard never looks empty on first login.

function pad(n) { return String(n).padStart(2, "0"); }

function dateStr(day) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  const d = Math.min(day, lastDay);
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function generateDemoTransactions() {
  const rows = [
    { category: "food", amount: 12000, merchant: "Kimbap Heaven", day: 1, note: "Lunch" },
    { category: "food", amount: 18500, merchant: "BBQ Chicken", day: 3, note: "Dinner with friends" },
    { category: "food", amount: 8000, merchant: "Cafe Onion", day: 5, note: "Coffee" },
    { category: "transport", amount: 3000, merchant: "T-money", day: 2, note: "Bus" },
    { category: "transport", amount: 6500, merchant: "Kakao Taxi", day: 6, note: "Taxi" },
    { category: "shopping", amount: 45000, merchant: "Musinsa", day: 4, note: "T-shirt" },
    { category: "shopping", amount: 32000, merchant: "Daiso", day: 8, note: "Home goods" },
    { category: "entertainment", amount: 20000, merchant: "CGV", day: 7, note: "Movie night" },
    { category: "bills", amount: 65000, merchant: "KT Mobile", day: 1, note: "Phone bill" },
    { category: "food", amount: 15000, merchant: "GS25", day: 9, note: "Snacks" },
    { category: "education", amount: 28000, merchant: "Yes24", day: 10, note: "Textbook" },
    { category: "health", amount: 12000, merchant: "CU Pharmacy", day: 11, note: "Vitamins" },
  ];

  return rows.map((r, i) => ({
    id: `demo-${i}`,
    type: "expense",
    amount: r.amount,
    category: r.category,
    merchant: r.merchant,
    date: dateStr(r.day),
    paymentMethod: i % 2 === 0 ? "Card" : "Cash",
    note: r.note,
    createdAt: new Date().toISOString(),
  })).concat([
    {
      id: "demo-income-1",
      type: "income",
      amount: 2400000,
      category: "other",
      merchant: "Part-time Job",
      date: dateStr(1),
      paymentMethod: "Transfer",
      note: "Monthly income",
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function generateDemoBudgets() {
  return [
    { id: "b-food", category: "food", limit: 300000 },
    { id: "b-transport", category: "transport", limit: 60000 },
    { id: "b-shopping", category: "shopping", limit: 150000 },
    { id: "b-entertainment", category: "entertainment", limit: 80000 },
  ];
}

export function generateDemoGoals() {
  return [
    { id: "g-travel", name: "Travel", target: 1000000, current: 400000, targetDate: dateStr(30) },
    { id: "g-laptop", name: "New Laptop", target: 1500000, current: 650000, targetDate: dateStr(30) },
  ];
}

export function generateDemoNotes() {
  return [
    { id: "n-1", text: "Spent more this week because I went out with friends.", date: dateStr(7), createdAt: new Date().toISOString() },
  ];
}

export function generateDemoAchievements() {
  return [
    { id: "a-first-tx", key: "first_transaction", unlockedAt: new Date().toISOString() },
  ];
}

export function generateDemoData() {
  return {
    transactions: generateDemoTransactions(),
    budgets: generateDemoBudgets(),
    goals: generateDemoGoals(),
    notes: generateDemoNotes(),
    achievements: generateDemoAchievements(),
    settings: { language: "en", assistantMode: "api" },
  };
}
