// Moneo Assistant service.
//
// getAssistantResponse() / getProactiveInsight() / extractReceiptData()
// are the entry points the UI calls.
//
// - Demo Mode: answers are computed locally from the user's real
//   localStorage data. No network calls, no backend needed, works
//   fully offline.
// - API Mode: calls the LOCAL BACKEND (see /backend), which is the
//   only thing that ever talks to Gemini. The Gemini API key lives in
//   backend/.env and is NEVER sent to, or readable from, the browser.
//   This file makes plain fetch() calls to http://localhost:4000 —
//   nothing here ever touches an API key directly.

import { categoryLabel } from "../data/categories";
import {
  totalIncome, totalExpenses, savings, spendingByCategory,
  topCategory, monthComparison, budgetStatus, currency,
} from "../utils/calculations";
import { t } from "../data/translations";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

function pct(a, b) {
  if (!b) return 0;
  return Math.round(((a - b) / b) * 100);
}

// ---------- Demo Mode (local, offline, no backend required) ----------

function localAnswer(query, data, lang) {
  const q = query.toLowerCase();
  const { transactions, budgets, goals } = data;

  const catMatch = (catId, keywords) => keywords.some((k) => q.includes(k));

  const categoryKeywords = {
    food: ["food", "식비", "밥", "먹"],
    transport: ["transport", "교통", "버스", "택시"],
    shopping: ["shopping", "쇼핑", "옷"],
    entertainment: ["entertainment", "엔터", "영화"],
    bills: ["bill", "공과금", "요금"],
    education: ["education", "교육", "책"],
    health: ["health", "건강", "병원", "약"],
    travel: ["travel", "여행"],
  };

  for (const [catId, keywords] of Object.entries(categoryKeywords)) {
    if (catMatch(catId, keywords)) {
      const spend = spendingByCategory(transactions);
      const amount = spend[catId] || 0;
      const label = categoryLabel(catId, lang);
      const budget = budgets.find((b) => b.category === catId);
      let extra = "";
      if (budget) {
        const usedPct = Math.round((amount / budget.limit) * 100);
        extra = lang === "ko"
          ? ` 예산 ${currency(budget.limit, lang)}의 ${usedPct}%를 사용했어요.`
          : ` That's ${usedPct}% of your ${currency(budget.limit, lang)} budget.`;
      }
      return lang === "ko"
        ? `${label} 카테고리에 이번 달 ${currency(amount, lang)}을 사용했어요.${extra}`
        : `You've spent ${currency(amount, lang)} on ${label} this month.${extra}`;
    }
  }

  if (q.includes("biggest") || q.includes("최고") || q.includes("가장")) {
    const top = topCategory(transactions);
    if (!top) return lang === "ko" ? "아직 지출 데이터가 없어요." : "No spending data yet.";
    const label = categoryLabel(top.category, lang);
    return lang === "ko"
      ? `가장 큰 지출 카테고리는 ${label}이고, ${currency(top.amount, lang)}을 사용했어요.`
      : `Your biggest expense category is ${label} at ${currency(top.amount, lang)}.`;
  }

  if (q.includes("why") || q.includes("왜") || q.includes("increase") || q.includes("증가")) {
    const { lastMonthExpenses, thisMonthExpenses } = monthComparison(transactions);
    if (!lastMonthExpenses) {
      return lang === "ko" ? "지난달 데이터가 없어서 비교할 수 없어요." : "There's no data from last month to compare against yet.";
    }
    const change = pct(thisMonthExpenses, lastMonthExpenses);
    const top = topCategory(transactions);
    const label = top ? categoryLabel(top.category, lang) : "";
    if (change > 0) {
      return lang === "ko"
        ? `이번 달 지출이 지난달보다 ${change}% 증가했어요. 가장 큰 원인은 ${label} 지출이에요.`
        : `Your spending is up ${change}% versus last month, mainly driven by ${label}.`;
    }
    return lang === "ko"
      ? `이번 달 지출은 지난달보다 오히려 ${Math.abs(change)}% 감소했어요. 잘하고 있어요!`
      : `Your spending is actually down ${Math.abs(change)}% versus last month — nice work!`;
  }

  if (q.includes("save") || q.includes("저축") || q.includes("saved")) {
    const s = savings(transactions);
    return lang === "ko"
      ? `이번 달 ${currency(s, lang)}을 저축했어요 (수입 - 지출 기준).`
      : `You've saved ${currency(s, lang)} this month (income minus expenses).`;
  }

  if (q.includes("this month") || q.includes("이번 달") || q.includes("total") || q.includes("총")) {
    const exp = totalExpenses(transactions);
    const inc = totalIncome(transactions);
    return lang === "ko"
      ? `이번 달 수입 ${currency(inc, lang)}, 지출 ${currency(exp, lang)}이에요.`
      : `This month: income ${currency(inc, lang)}, expenses ${currency(exp, lang)}.`;
  }

  if (q.includes("budget") || q.includes("예산") || q.includes("close")) {
    const statuses = budgetStatus(budgets, transactions);
    const worst = statuses.sort((a, b) => b.pct - a.pct)[0];
    if (!worst) return lang === "ko" ? "설정된 예산이 없어요." : "You don't have any budgets set yet.";
    const label = categoryLabel(worst.category, lang);
    if (worst.status === "over") return t(lang, "overBudget", { cat: label });
    if (worst.status === "close") return t(lang, "closeToLimit", { cat: label });
    return lang === "ko"
      ? `모든 예산 내에서 잘 관리되고 있어요. ${label} 예산이 ${worst.pct}%로 가장 높아요.`
      : `You're within all your budgets. ${label} is your highest at ${worst.pct}%.`;
  }

  if (q.includes("goal") || q.includes("목표")) {
    if (!goals.length) return lang === "ko" ? "아직 설정된 목표가 없어요." : "You haven't set any savings goals yet.";
    const g = goals[0];
    const remaining = g.target - g.current;
    return lang === "ko"
      ? `${g.name} 목표까지 ${currency(remaining, lang)} 남았어요 (${Math.round((g.current / g.target) * 100)}% 달성).`
      : `You need ${currency(remaining, lang)} more to reach your ${g.name} goal (${Math.round((g.current / g.target) * 100)}% there).`;
  }

  if (q.includes("afford") || q.includes("감당") || q.includes("살 수") || q.includes("사도")) {
    const s = savings(transactions);
    const priceMatch = query.match(/[\d,]+/);
    const price = priceMatch ? Number(priceMatch[0].replace(/,/g, "")) : null;
    if (price) {
      const canAfford = price <= s;
      return lang === "ko"
        ? `이번 달 저축액은 ${currency(s, lang)}이에요. ${currency(price, lang)}은 ${canAfford ? "저축액 안에서 감당할 수 있어요" : "현재 저축액을 초과해요 — 목표나 예산에 영향이 있을 수 있어요"}. (참고: Demo Mode는 간단한 계산만 해요 — 더 자세한 분석은 API Mode를 사용해보세요.)`
        : `Your savings this month are ${currency(s, lang)}. ${currency(price, lang)} is ${canAfford ? "within that" : "more than that — it could eat into your goals or budget"}. (Note: Demo Mode does simple math only — switch to API Mode for deeper reasoning.)`;
    }
    return lang === "ko"
      ? `이번 달 저축액은 ${currency(s, lang)}이에요. 정확한 가격을 알려주시면 감당 가능한지 계산해드릴게요. 더 깊은 분석은 API Mode에서 가능해요.`
      : `Your savings this month are ${currency(s, lang)}. Tell me the price and I can do the math — for deeper reasoning about goals and budgets, try API Mode.`;
  }

  if (q.includes("reduce") || q.includes("줄이") || q.includes("how can")) {
    const top = topCategory(transactions);
    if (!top) return lang === "ko" ? "지출 데이터가 더 쌓이면 맞춤 조언을 드릴게요." : "Add a few more transactions and I'll give tailored advice.";
    const label = categoryLabel(top.category, lang);
    return lang === "ko"
      ? `${label} 지출이 가장 크니 여기서부터 줄여보는 걸 추천해요. 외식을 주 1~2회로 제한해보는 건 어떨까요?`
      : `${label} is your biggest category — that's the best place to start. Try capping it to 1-2 times a week and see the difference.`;
  }

  return lang === "ko"
    ? "좋은 질문이에요! 식비, 예산, 저축, 목표, 이번 달 지출에 대해 물어보시면 실제 데이터로 답해드릴 수 있어요 😊"
    : "Good question! I can answer things about your spending by category, budgets, savings, goals, or this month's totals — try asking one of those 😊";
}

function localInsight(data, lang) {
  const { transactions, budgets } = data;
  const top = topCategory(transactions);
  const exp = totalExpenses(transactions);
  const { lastMonthExpenses, thisMonthExpenses } = monthComparison(transactions);
  const statuses = budgetStatus(budgets, transactions);
  const worstBudget = [...statuses].sort((a, b) => b.pct - a.pct)[0];

  if (!transactions.length) {
    return lang === "ko"
      ? "거래를 추가하면 맞춤 인사이트를 보여드릴게요."
      : "Add a few transactions to unlock personalized insights.";
  }
  if (worstBudget && worstBudget.status === "over") {
    const label = categoryLabel(worstBudget.category, lang);
    return lang === "ko"
      ? `${label} 예산을 ${worstBudget.pct}% 사용해서 초과했어요. 이번 달 남은 기간 동안 ${label} 지출을 줄여보는 걸 추천해요.`
      : `You're at ${worstBudget.pct}% of your ${label} budget — already over. Consider pulling back on ${label} for the rest of the month.`;
  }
  if (worstBudget && worstBudget.status === "close") {
    const label = categoryLabel(worstBudget.category, lang);
    return lang === "ko"
      ? `${label} 예산의 ${worstBudget.pct}%를 사용했어요. 조금만 더 신경 쓰면 예산 안에서 마무리할 수 있어요.`
      : `You've used ${worstBudget.pct}% of your ${label} budget. A little more care here and you'll finish the month within budget.`;
  }
  if (lastMonthExpenses > 0 && thisMonthExpenses > lastMonthExpenses * 1.15) {
    const change = Math.round(((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100);
    return lang === "ko"
      ? `이번 달 지출이 지난달보다 ${change}% 늘었어요. ${top ? categoryLabel(top.category, lang) + " 지출이 가장 큰 원인이에요." : ""}`
      : `Spending is up ${change}% versus last month${top ? `, mostly driven by ${categoryLabel(top.category, lang)}` : ""}.`;
  }
  if (top && exp > 0) {
    const pctOfExpenses = Math.round((top.amount / exp) * 100);
    return lang === "ko"
      ? `${categoryLabel(top.category, lang)} 지출이 이번 달 전체 지출의 ${pctOfExpenses}%를 차지해요.`
      : `${categoryLabel(top.category, lang)} makes up ${pctOfExpenses}% of your spending this month.`;
  }
  return lang === "ko"
    ? "거래를 추가하면 맞춤 인사이트를 보여드릴게요."
    : "Add a few transactions and I'll start surfacing insights here.";
}

// ---------- Shared: financial context sent to the backend ----------

function buildFinancialContext(data) {
  const { transactions, budgets, goals } = data;
  const catSpend = spendingByCategory(transactions);
  const top = topCategory(transactions);
  const { lastMonthExpenses, thisMonthExpenses } = monthComparison(transactions);
  const statuses = budgetStatus(budgets, transactions);

  return {
    has_data: transactions.length > 0,
    income_this_month: totalIncome(transactions),
    expenses_this_month: totalExpenses(transactions),
    savings_this_month: savings(transactions),
    spending_by_category: Object.fromEntries(
      Object.entries(catSpend).map(([id, amt]) => [categoryLabel(id, "en"), amt])
    ),
    biggest_expense_category: top ? categoryLabel(top.category, "en") : null,
    biggest_expense_amount: top ? top.amount : 0,
    last_month_expenses: lastMonthExpenses,
    this_month_expenses: thisMonthExpenses,
    budgets: statuses.map((b) => ({
      category: categoryLabel(b.category, "en"), limit: b.limit, spent: b.spent, percent_used: b.pct,
    })),
    goals: goals.map((g) => ({ name: g.name, target: g.target, current: g.current, target_date: g.targetDate })),
    recent_transactions: transactions.slice(0, 8).map((tx) => ({
      type: tx.type, amount: tx.amount, category: categoryLabel(tx.category, "en"), merchant: tx.merchant, date: tx.date,
    })),
  };
}

// ---------- API Mode: calls to the local backend ----------

async function postToBackend(path, body) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error("BACKEND_UNREACHABLE");
    err.code = "BACKEND_UNREACHABLE";
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || "Request failed");
    err.code = json.error || "UNKNOWN";
    err.status = res.status;
    throw err;
  }
  return json;
}

function friendlyApiError(err, lang) {
  if (err.code === "BACKEND_UNREACHABLE") {
    return lang === "ko"
      ? "백엔드 서버에 연결할 수 없어요. backend 폴더에서 서버가 실행 중인지 확인해주세요."
      : "Can't reach the backend server. Make sure it's running (see backend/README).";
  }
  if (err.code === "gemini_not_configured") {
    return lang === "ko"
      ? "AI 기능이 아직 설정되지 않았어요. backend/.env에 GEMINI_API_KEY를 추가하고 서버를 재시작해주세요."
      : "AI features aren't set up yet. Add GEMINI_API_KEY in backend/.env and restart the backend.";
  }
  return lang === "ko"
    ? "AI 요청이 실패했어요. 잠시 후 다시 시도해주세요."
    : "The AI request failed. Please try again in a moment.";
}

async function apiAnswer(query, data, lang) {
  const context = buildFinancialContext(data);
  try {
    const { answer } = await postToBackend("/api/ai/chat", { question: query, financialContext: context, language: lang });
    return answer;
  } catch (err) {
    console.error("Moneo Assistant error:", err);
    return friendlyApiError(err, lang);
  }
}

async function apiInsight(data, lang) {
  const context = buildFinancialContext(data);
  try {
    const { insight } = await postToBackend("/api/ai/insight", { financialContext: context, language: lang });
    return insight;
  } catch (err) {
    console.error("Moneo insight error:", err);
    // Insights fail silently to the local fallback — a broken dashboard
    // insight card is worse UX than a slightly-less-smart local one.
    return localInsight(data, lang);
  }
}

// ---------- Receipt scanning (always via backend — vision needs the key) ----------

// file must be a browser File/Blob object (from an <input type="file">).
// Returns the backend's structured result, including confidence data,
// or throws with a friendly-mappable error code.
export async function extractReceiptData(file) {
  const formData = new FormData();
  formData.append("receipt", file);

  let res;
  try {
    res = await fetch(`${BACKEND_URL}/api/receipt/analyze`, { method: "POST", body: formData });
  } catch (networkErr) {
    const err = new Error("BACKEND_UNREACHABLE");
    err.code = "BACKEND_UNREACHABLE";
    throw err;
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || "Receipt analysis failed");
    err.code = json.error || "UNKNOWN";
    throw err;
  }
  return json; // { merchant, date, total, currency, category, payment_method, items, confidence, confidence_label }
}

export function friendlyReceiptError(err, lang) {
  if (err.code === "BACKEND_UNREACHABLE") {
    return lang === "ko"
      ? "백엔드 서버에 연결할 수 없어요. 서버가 실행 중인지 확인해주세요."
      : "Can't reach the backend server. Make sure it's running.";
  }
  if (err.code === "gemini_not_configured") {
    return lang === "ko"
      ? "AI 영수증 인식이 아직 설정되지 않았어요. backend/.env에 GEMINI_API_KEY를 추가해주세요."
      : "AI receipt scanning isn't set up yet. Add GEMINI_API_KEY in backend/.env.";
  }
  if (err.code === "unreadable_receipt") {
    return lang === "ko"
      ? "영수증을 읽지 못했어요. 더 선명한 사진으로 다시 시도하거나 직접 입력해주세요."
      : "Couldn't read that receipt. Try a clearer photo, or enter it manually.";
  }
  if (err.code === "invalid_file") {
    return lang === "ko" ? "이미지 파일을 업로드해주세요 (8MB 이하)." : "Please upload an image file (8MB max).";
  }
  return lang === "ko" ? "영수증 분석에 실패했어요. 다시 시도해주세요." : "Receipt analysis failed. Please try again.";
}

// ---------- Backend / Gemini status (for Settings indicator) ----------

export async function getBackendStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) return { backendUp: false, geminiConfigured: false };
    await res.json();
    const statusRes = await fetch(`${BACKEND_URL}/api/ai/status`);
    const statusJson = statusRes.ok ? await statusRes.json() : { configured: false };
    return { backendUp: true, geminiConfigured: Boolean(statusJson.configured) };
  } catch {
    return { backendUp: false, geminiConfigured: false };
  }
}

// ---------- Public entry points ----------

export async function getAssistantResponse(query, data, lang, mode) {
  if (mode === "api") return apiAnswer(query, data, lang);
  return localAnswer(query, data, lang);
}

export async function getProactiveInsight(data, lang, mode) {
  if (mode === "api") return apiInsight(data, lang);
  return localInsight(data, lang);
}
