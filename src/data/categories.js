// Expense categories used across the app.
// `icon` refers to a lucide-react icon name (resolved in components).
export const CATEGORIES = [
  { id: "food", en: "Food", ko: "식비", color: "#3B6FE0", icon: "UtensilsCrossed" },
  { id: "transport", en: "Transport", ko: "교통", color: "#2FAE66", icon: "Bus" },
  { id: "shopping", en: "Shopping", ko: "쇼핑", color: "#E0A83B", icon: "ShoppingBag" },
  { id: "entertainment", en: "Entertainment", ko: "엔터테인먼트", color: "#9B6BF2", icon: "Popcorn" },
  { id: "bills", en: "Bills", ko: "공과금", color: "#E0563B", icon: "Receipt" },
  { id: "education", en: "Education", ko: "교육", color: "#2BB4C9", icon: "GraduationCap" },
  { id: "health", en: "Health", ko: "건강", color: "#EC6FA8", icon: "HeartPulse" },
  { id: "travel", en: "Travel", ko: "여행", color: "#6B8CFF", icon: "Plane" },
  { id: "other", en: "Other", ko: "기타", color: "#9CA3AF", icon: "MoreHorizontal" },
];

export const PAYMENT_METHODS = ["Card", "Cash", "Transfer", "Other"];

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

export function categoryLabel(id, lang) {
  const c = categoryById(id);
  return lang === "ko" ? c.ko : c.en;
}
