import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import ProgressBar from "../components/ProgressBar";
import CategoryIcon from "../components/CategoryIcon";
import Celebration from "../components/Celebration";
import { CATEGORIES, categoryLabel } from "../data/categories";
import { budgetStatus, currency } from "../utils/calculations";

export default function Budgets() {
  const { data, addBudget, deleteBudget, lang, t, showToast, unlockAchievement } = useApp();
  const { transactions, budgets } = data;
  const statuses = budgetStatus(budgets, transactions);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "food", limit: "" });
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);

  const usedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = CATEGORIES.filter((c) => !usedCategories.has(c.id));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.limit || isNaN(Number(form.limit))) return;
    const isFirst = budgets.length === 0;
    addBudget({ category: form.category, limit: Number(form.limit) });
    unlockAchievement("budget_created");
    showToast(lang === "ko" ? "예산이 생성됐어요." : "Budget created.");
    if (isFirst) setCelebrateTrigger((n) => n + 1);
    setShowForm(false);
    setForm({ category: availableCategories[1]?.id || "food", limit: "" });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("budgets")}</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)} disabled={availableCategories.length === 0}>
          <Plus size={16} /> {t("createBudget")}
        </button>
      </div>

      <div className="budget-grid">
        {statuses.length === 0 && <div className="card"><div className="empty-state">{t("noBudgetsYet")}</div></div>}
        {statuses.map((b) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card budget-card">
            <div className="budget-card-top">
              <CategoryIcon categoryId={b.category} withBg />
              <div style={{ flex: 1 }}>
                <div className="budget-card-title">{categoryLabel(b.category, lang)}</div>
                <div className="budget-card-sub">{currency(b.spent, lang)} / {currency(b.limit, lang)}</div>
              </div>
              <button className="icon-btn-ghost" onClick={() => deleteBudget(b.id)}><Trash2 size={14} /></button>
            </div>
            <ProgressBar pct={b.pct} color={b.status === "over" ? "#E0563B" : b.status === "close" ? "#E0A83B" : "#2FAE66"} />
            <div className="budget-card-footer">
              <span>{t("remaining")}: {currency(Math.max(0, b.remaining), lang)}</span>
              <span>{b.pct}%</span>
            </div>
            {b.status === "over" && (
              <div className="budget-alert alert-red"><AlertTriangle size={13} /> {t("overBudget", { cat: categoryLabel(b.category, lang) })}</div>
            )}
            {b.status === "close" && (
              <div className="budget-alert alert-amber"><AlertTriangle size={13} /> {t("closeToLimit", { cat: categoryLabel(b.category, lang) })}</div>
            )}
            {b.status === "ok" && (
              <div className="budget-alert alert-green"><CheckCircle2 size={13} /> {lang === "ko" ? "안전한 범위예요." : "On track."}</div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)}>
            <motion.div className="modal modal-sm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{t("createBudget")}</h2>
                <button onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="tx-form">
                <label>{t("category")}</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {availableCategories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.id, lang)}</option>)}
                </select>
                <label>{t("monthlyBudget")}</label>
                <input type="number" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} required />
                <button type="submit" className="btn-primary btn-block" style={{ marginTop: 14 }}>{t("save")}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Celebration trigger={celebrateTrigger} label={lang === "ko" ? "🏆 첫 예산 생성 완료!" : "🏆 First budget created!"} />
    </div>
  );
}
