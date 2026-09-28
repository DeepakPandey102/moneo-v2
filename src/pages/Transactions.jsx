import React, { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, Pencil, X, Camera, Check, AlertCircle,
  Sparkles, ReceiptText,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import CategoryIcon from "../components/CategoryIcon";
import Celebration from "../components/Celebration";
import { CATEGORIES, PAYMENT_METHODS, categoryLabel } from "../data/categories";
import { currency } from "../utils/calculations";
import { extractReceiptData, friendlyReceiptError, warmUpBackend } from "../services/assistantService";
import { todayLocal, parseLocalDate } from "../utils/dates";

// A function, not a constant: the old constant computed "today" once when
// the file loaded (and in UTC), so the default date was wrong before 9am in
// Korea and stayed stuck on yesterday if the tab was left open overnight.
function emptyForm() {
  return { type: "expense", amount: "", category: "food", merchant: "", date: todayLocal(), paymentMethod: "Card", note: "" };
}

// Gemini returns free text like "신용카드" or "VISA ****1234" — map it onto
// one of the app's fixed options so the dropdown and filters stay consistent.
function normalizePaymentMethod(raw) {
  const v = String(raw || "").toLowerCase();
  if (!v) return "Card";
  if (/cash|현금/.test(v)) return "Cash";
  if (/transfer|이체|계좌|bank/.test(v)) return "Transfer";
  if (/card|카드|credit|debit|visa|master|amex|체크|신용|pay|페이/.test(v)) return "Card";
  return PAYMENT_METHODS.includes(raw) ? raw : "Other";
}

const ANALYZE_STEPS_EN = ["Reading merchant...", "Checking total...", "Detecting category...", "Extracting items..."];
const ANALYZE_STEPS_KO = ["가맹점 확인 중...", "총액 확인 중...", "카테고리 분석 중...", "항목 추출 중..."];

export default function Transactions() {
  const { data, addTransaction, updateTransaction, deleteTransaction, unlockAchievement, showToast, lang, t } = useApp();
  const { transactions } = data;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") || "");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSource, setFilterSource] = useState(() => (params.get("source") === "ai" ? "ai" : "all")); // all | ai
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);
  const [celebrateLabel, setCelebrateLabel] = useState("");
  const fileInputRef = useRef(null);

  // Receipt review flow state
  const [scanState, setScanState] = useState("idle"); // idle | analyzing | review | error
  const [scanStep, setScanStep] = useState(0);
  const [scanSlow, setScanSlow] = useState(false); // shown if the server is still waking up
  const [scanResult, setScanResult] = useState(null); // backend response
  const [scanError, setScanError] = useState("");
  const [reviewEditing, setReviewEditing] = useState(false);

  const filtered = useMemo(() => {
    return [...transactions]
      .filter((tx) => filterCategory === "all" || tx.category === filterCategory)
      .filter((tx) => filterType === "all" || tx.type === filterType)
      .filter((tx) => filterSource !== "ai" || tx.source === "ai_receipt")
      .filter((tx) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return [tx.merchant, tx.merchantOriginal, tx.note].some((v) => (v || "").toLowerCase().includes(q));
      })
      .sort((a, b) => (parseLocalDate(b.date) - parseLocalDate(a.date)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [transactions, filterCategory, filterType, filterSource, search]);

  function openAdd() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(tx) {
    setForm({ ...tx, amount: String(tx.amount) });
    setEditingId(tx.id);
    setShowForm(true);
  }

  function saveTransaction(payload, { isFirst, celebrateText } = {}) {
    addTransaction(payload);
    unlockAchievement("first_transaction");
    showToast(lang === "ko" ? "거래가 추가됐어요." : "Transaction added.");
    setCelebrateLabel(celebrateText || (isFirst
      ? (lang === "ko" ? "🎉 첫 거래 기록 완료!" : "🎉 First transaction logged!")
      : (lang === "ko" ? "✨ 거래가 추가됐어요" : "✨ Added!")));
    setCelebrateTrigger((n) => n + 1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast(lang === "ko" ? "0보다 큰 금액을 입력해주세요." : "Please enter an amount greater than 0.", "error");
      return;
    }
    const payload = { ...form, amount };
    if (editingId) {
      updateTransaction(editingId, payload);
      showToast(lang === "ko" ? "거래가 수정됐어요." : "Transaction updated.");
    } else {
      saveTransaction(payload, { isFirst: transactions.length === 0 });
    }
    setShowForm(false);
  }

  function handleDelete(id) {
    if (!window.confirm(lang === "ko" ? "이 거래를 삭제할까요?" : "Delete this transaction?")) return;
    deleteTransaction(id);
    showToast(lang === "ko" ? "거래가 삭제됐어요." : "Transaction deleted.", "error");
  }

  // ---------- Receipt scanning: always calls the real backend/Gemini.
  // Never fakes a result — if the backend or key isn't set up, this
  // shows a clear error instead of pretending it worked. ----------

  function triggerReceiptUpload() {
    fileInputRef.current?.click();
  }

  const stepTimerRef = useRef(null);

  async function handleReceiptFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanState("analyzing");
    setScanStep(0);
    setScanError("");
    setScanSlow(false);

    const steps = lang === "ko" ? ANALYZE_STEPS_KO : ANALYZE_STEPS_EN;
    const started = Date.now();
    stepTimerRef.current = setInterval(() => {
      setScanStep((s) => (s + 1) % steps.length);
      if (Date.now() - started > 9000) setScanSlow(true);
    }, 900);

    try {
      const result = await extractReceiptData(file, lang);
      clearInterval(stepTimerRef.current);
      setScanResult({ ...result, payment_method: normalizePaymentMethod(result.payment_method) });
      setReviewEditing(false);
      setScanState("review");
    } catch (err) {
      clearInterval(stepTimerRef.current);
      console.error("Receipt scan failed:", err);
      setScanError(friendlyReceiptError(err, lang));
      setScanState("error");
    }
  }

  useEffect(() => () => clearInterval(stepTimerRef.current), []);
  useEffect(() => { warmUpBackend(); }, []);

  // Links from the dashboard / top search bar / sidebar:
  //   ?q=...  -> search, ?source=ai -> Receipts view, ?action=add|scan -> open that flow
  useEffect(() => {
    const q = params.get("q");
    if (q !== null) setSearch(q);
    setFilterSource(params.get("source") === "ai" ? "ai" : "all");
    const action = params.get("action");
    if (action === "add") openAdd();
    if (action === "scan") setTimeout(() => fileInputRef.current?.click(), 50);
    if (action) {
      const next = new URLSearchParams(params);
      next.delete("action");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function closeScanFlow() {
    setScanState("idle");
    setScanResult(null);
    setScanError("");
    setReviewEditing(false);
  }

  function confirmReceiptSave() {
    if (!scanResult) return;
    const amount = Number(scanResult.total);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast(lang === "ko" ? "금액을 확인해주세요 — 편집을 눌러 수정할 수 있어요." : "Please check the amount — tap Edit to fix it.", "error");
      setReviewEditing(true);
      return;
    }
    const payload = {
      type: "expense",
      amount,
      category: scanResult.category,
      merchant: scanResult.merchant,
      merchantOriginal: showOriginal(scanResult.merchant, scanResult.merchant_original) ? scanResult.merchant_original : "",
      date: scanResult.date,
      paymentMethod: normalizePaymentMethod(scanResult.payment_method),
      note: "",
      source: "ai_receipt",
      confidence: scanResult.confidence,
      items: scanResult.items || [],
    };
    saveTransaction(payload, {
      isFirst: transactions.length === 0,
      celebrateText: lang === "ko" ? "🤖 AI 영수증 저장 완료!" : "🤖 AI receipt saved!",
    });
    closeScanFlow();
  }

  // Show the receipt's printed text under the translation only when it differs.
  function showOriginal(main, original) {
    return Boolean(original) && original.trim().toLowerCase() !== String(main || "").trim().toLowerCase();
  }

  function updateScanField(field, value) {
    setScanResult((prev) => ({ ...prev, [field]: value }));
  }

  const confidenceMeta = {
    high: { label: lang === "ko" ? "높은 신뢰도" : "High confidence", color: "#34D399", bg: "rgba(52,211,153,0.14)" },
    review: { label: lang === "ko" ? "검토 권장" : "Review recommended", color: "#FBBF24", bg: "rgba(251,191,36,0.14)" },
    low: { label: lang === "ko" ? "낮은 신뢰도 — 확인 필요" : "Low confidence — please verify", color: "#F87171", bg: "rgba(248,113,113,0.14)" },
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("transactions")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={triggerReceiptUpload}>
            <Camera size={15} style={{ marginRight: 6 }} />{lang === "ko" ? "영수증 스캔" : "Scan Receipt"}
          </button>
          <button className="btn-primary" onClick={openAdd}><Plus size={16} /> {t("addTransaction")}</button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleReceiptFile} />
      </div>

      <div className="filter-row">
        <div className="search-box">
          <Search size={15} />
          <input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">{t("filterCategory")}</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.id, lang)}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">{t("filterType")}</option>
          <option value="income">{t("income_")}</option>
          <option value="expense">{t("expense_")}</option>
        </select>
        <button
          className={"pill" + (filterSource === "ai" ? " active-blue" : "")}
          onClick={() => setFilterSource(filterSource === "ai" ? "all" : "ai")}
          style={{ flex: "0 0 auto", padding: "9px 14px" }}
        >
          <Sparkles size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
          {lang === "ko" ? "AI 스캔됨" : "AI Scanned"}
        </button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            {transactions.length === 0 ? t("noTransactionsYet") : (lang === "ko" ? "일치하는 거래가 없어요." : "No transactions match your filters.")}
          </div>
        ) : (
          <div className="tx-list">
            {filtered.map((tx) => (
              <div key={tx.id} className="tx-row">
                <CategoryIcon categoryId={tx.category} withBg />
                <div className="tx-info">
                  <div className="tx-merchant">
                    <span className="tx-merchant-name">{tx.merchant || categoryLabel(tx.category, lang)}</span>
                    {tx.source === "ai_receipt" && (
                      <span className="ai-badge"><Sparkles size={10} /> {lang === "ko" ? "AI 인식" : "AI"}</span>
                    )}
                  </div>
                  {tx.merchantOriginal && <div className="tx-original">{tx.merchantOriginal}</div>}
                  <div className="tx-date">{tx.date} · {tx.paymentMethod}{tx.note ? " · " + tx.note : ""}</div>
                </div>
                <div className={"tx-amount " + (tx.type === "income" ? "positive" : "")}>
                  {tx.type === "income" ? "+" : "-"}{currency(tx.amount, lang)}
                </div>
                <div className="tx-actions">
                  <button onClick={() => openEdit(tx)}><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(tx.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Manual add/edit modal ---------- */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingId ? t("editTransaction") : t("addTransaction")}</h2>
                <button onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="tx-form" noValidate>
                <div className="form-row">
                  <button type="button" className={"pill " + (form.type === "expense" ? "active-red" : "")} onClick={() => setForm({ ...form, type: "expense" })}>{t("expense_")}</button>
                  <button type="button" className={"pill " + (form.type === "income" ? "active-green" : "")} onClick={() => setForm({ ...form, type: "income" })}>{t("income_")}</button>
                </div>
                <label>{t("amount")}</label>
                <input type="number" inputMode="numeric" min="1" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <label>{t("category")}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.id, lang)}</option>)}
                </select>
                <label>{t("merchant")}</label>
                <input type="text" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
                <div className="form-row-2">
                  <div>
                    <label>{t("date")}</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label>{t("paymentMethod")}</label>
                    <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <label>{t("note")}</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <button type="submit" className="btn-primary btn-block" style={{ marginTop: 14 }}>{t("save")}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Receipt scan flow: analyzing / review / error ---------- */}
      <AnimatePresence>
        {scanState !== "idle" && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={scanState !== "analyzing" ? closeScanFlow : undefined}>
            <motion.div className="modal" initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>

              {scanState === "analyzing" && (
                <div className="scan-loading">
                  <div className="scan-spinner"><Sparkles size={26} color="#34D399" /></div>
                  <div className="scan-loading-title">{lang === "ko" ? "AI가 영수증을 분석하고 있어요" : "Moneo AI is analyzing your receipt"}</div>
                  <motion.div key={scanStep} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="scan-loading-step">
                    {(lang === "ko" ? ANALYZE_STEPS_KO : ANALYZE_STEPS_EN)[scanStep]}
                  </motion.div>
                  {scanSlow && (
                    <p className="scan-slow-note">
                      {lang === "ko"
                        ? "서버를 깨우는 중이에요. 처음 스캔은 최대 1분 걸릴 수 있어요."
                        : "Waking up the AI server — the first scan can take up to a minute."}
                    </p>
                  )}
                </div>
              )}

              {scanState === "error" && (
                <div className="scan-loading">
                  <div className="scan-spinner" style={{ background: "rgba(248,113,113,0.14)" }}><AlertCircle size={26} color="#F87171" /></div>
                  <div className="scan-loading-title">{lang === "ko" ? "분석에 실패했어요" : "Analysis failed"}</div>
                  <div className="scan-loading-step" style={{ color: "#F87171" }}>{scanError}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "center" }}>
                    <button className="btn-secondary" onClick={closeScanFlow}>{t("cancel")}</button>
                    <button className="btn-primary" onClick={() => { closeScanFlow(); openAdd(); }}>
                      {lang === "ko" ? "직접 입력하기" : "Enter manually"}
                    </button>
                  </div>
                </div>
              )}

              {scanState === "review" && scanResult && (
                <>
                  <div className="modal-header">
                    <h2><ReceiptText size={18} style={{ marginRight: 8, verticalAlign: -3 }} />{lang === "ko" ? "AI 영수증 분석" : "AI Receipt Analysis"}</h2>
                    <button onClick={closeScanFlow}><X size={18} /></button>
                  </div>

                  <div
                    className="confidence-badge"
                    style={{ background: confidenceMeta[scanResult.confidence_label]?.bg, color: confidenceMeta[scanResult.confidence_label]?.color }}
                  >
                    {confidenceMeta[scanResult.confidence_label]?.label} · {scanResult.confidence}%
                  </div>

                  {!reviewEditing ? (
                    <div className="receipt-summary">
                      <div className="receipt-summary-row">
                        <span>{t("merchant")}</span>
                        <b className="receipt-value">
                          {scanResult.merchant}
                          {showOriginal(scanResult.merchant, scanResult.merchant_original) && <small>{scanResult.merchant_original}</small>}
                        </b>
                      </div>
                      <div className="receipt-summary-row"><span>{t("date")}</span><b>{scanResult.date}</b></div>
                      <div className="receipt-summary-row"><span>{t("amount")}</span><b>{currency(scanResult.total, lang)}</b></div>
                      <div className="receipt-summary-row"><span>{t("category")}</span><b>{categoryLabel(scanResult.category, lang)}</b></div>
                      <div className="receipt-summary-row"><span>{t("paymentMethod")}</span><b>{scanResult.payment_method}</b></div>

                      {scanResult.items?.length > 0 && (
                        <div className="receipt-items">
                          <div className="receipt-items-title">{lang === "ko" ? "항목" : "Items"}</div>
                          {scanResult.items.map((item, i) => (
                            <div key={i} className="receipt-item-row">
                              <span className="receipt-item-name">
                                {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                                {showOriginal(item.name, item.name_original) && <small>{item.name_original}</small>}
                              </span>
                              <span className="receipt-item-price">{currency(item.price, lang)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="tx-form">
                      <label>{t("merchant")}</label>
                      <input type="text" value={scanResult.merchant} onChange={(e) => updateScanField("merchant", e.target.value)} />
                      <label>{t("date")}</label>
                      <input type="date" value={scanResult.date} onChange={(e) => updateScanField("date", e.target.value)} />
                      <label>{t("amount")}</label>
                      <input type="number" inputMode="numeric" min="1" step="any" value={scanResult.total} onChange={(e) => updateScanField("total", e.target.value)} />
                      <label>{t("category")}</label>
                      <select value={scanResult.category} onChange={(e) => updateScanField("category", e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.id, lang)}</option>)}
                      </select>
                      <label>{t("paymentMethod")}</label>
                      <select value={scanResult.payment_method} onChange={(e) => updateScanField("payment_method", e.target.value)}>
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setReviewEditing((v) => !v)}>
                      <Pencil size={14} style={{ marginRight: 6 }} />{reviewEditing ? (lang === "ko" ? "완료" : "Done") : t("edit")}
                    </button>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={confirmReceiptSave}>
                      <Check size={15} style={{ marginRight: 6 }} />{lang === "ko" ? "확인 & 저장" : "Confirm & Save"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Celebration trigger={celebrateTrigger} label={celebrateLabel} />
    </div>
  );
}
