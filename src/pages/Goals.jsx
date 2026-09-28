import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Target } from "lucide-react";
import { useApp } from "../context/AppContext";
import ProgressBar from "../components/ProgressBar";
import Celebration from "../components/Celebration";
import { currency, goalProgress } from "../utils/calculations";

export default function Goals() {
  const { data, addGoal, updateGoal, deleteGoal, lang, t, showToast, unlockAchievement } = useApp();
  const { goals } = data;

  const [showForm, setShowForm] = useState(false);
  const [addFundsFor, setAddFundsFor] = useState(null);
  const [fundsAmount, setFundsAmount] = useState("");
  const [form, setForm] = useState({ name: "", target: "", current: "0", targetDate: "" });
  const [celebrateTrigger, setCelebrateTrigger] = useState(0);
  const [celebrateLabel, setCelebrateLabel] = useState("");

  function fire(label) {
    setCelebrateLabel(label);
    setCelebrateTrigger((n) => n + 1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const target = Number(form.target);
    const current = Math.max(0, Number(form.current) || 0);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0) {
      showToast(lang === "ko" ? "목표 이름과 0보다 큰 목표 금액을 입력해주세요." : "Enter a goal name and a target greater than 0.", "error");
      return;
    }
    addGoal({ name: form.name.trim(), target, current, targetDate: form.targetDate });
    unlockAchievement("goal_started");
    showToast(lang === "ko" ? "목표가 생성됐어요." : "Goal created.");
    setShowForm(false);
    setForm({ name: "", target: "", current: "0", targetDate: "" });
  }

  function handleAddFunds(e) {
    e.preventDefault();
    const goal = goals.find((g) => g.id === addFundsFor);
    const amount = Number(fundsAmount);
    if (!goal) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast(lang === "ko" ? "0보다 큰 금액을 입력해주세요." : "Please enter an amount greater than 0.", "error");
      return;
    }
    const wasComplete = Number(goal.current) >= Number(goal.target);
    const newCurrent = (Number(goal.current) || 0) + amount;
    updateGoal(goal.id, { current: newCurrent });
    if (newCurrent >= 100000) unlockAchievement("saved_100k");
    showToast(lang === "ko" ? "금액이 추가됐어요." : "Funds added.");
    if (!wasComplete && newCurrent >= Number(goal.target)) {
      fire(lang === "ko" ? `🏆 ${goal.name} 목표 달성!` : `🏆 ${goal.name} goal reached!`);
    } else {
      fire(lang === "ko" ? "✨ 저축액이 추가됐어요" : "✨ Funds added!");
    }
    setAddFundsFor(null);
    setFundsAmount("");
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("goals")}</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> {t("createGoal")}</button>
      </div>

      <div className="budget-grid">
        {goals.length === 0 && <div className="card"><div className="empty-state">{t("noGoalsYet")}</div></div>}
        {goals.map((g) => {
          const pct = Math.round(goalProgress(g) * 100);
          return (
            <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card budget-card">
              <div className="budget-card-top">
                <div className="goal-icon"><Target size={17} color="#34D399" /></div>
                <div style={{ flex: 1 }}>
                  <div className="budget-card-title">{g.name}</div>
                  <div className="budget-card-sub">{currency(g.current, lang)} / {currency(g.target, lang)}</div>
                </div>
                <button className="icon-btn-ghost" onClick={() => { if (window.confirm(lang === "ko" ? `"${g.name}" 목표를 삭제할까요?` : `Delete the "${g.name}" goal?`)) deleteGoal(g.id); }}><Trash2 size={14} /></button>
              </div>
              <ProgressBar pct={pct} color="#34D399" />
              <div className="budget-card-footer">
                <span>{g.targetDate}</span>
                <span>{pct}%</span>
              </div>
              <button className="btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => setAddFundsFor(g.id)}>{t("addFunds")}</button>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)}>
            <motion.div className="modal modal-sm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header"><h2>{t("createGoal")}</h2><button onClick={() => setShowForm(false)}><X size={18} /></button></div>
              <form onSubmit={handleSubmit} className="tx-form" noValidate>
                <label>{t("goalName")}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <label>{t("targetAmount")}</label>
                <input type="number" inputMode="numeric" min="1" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                <label>{t("currentAmount")}</label>
                <input type="number" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
                <label>{t("targetDate")}</label>
                <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
                <button type="submit" className="btn-primary btn-block" style={{ marginTop: 14 }}>{t("save")}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {addFundsFor && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddFundsFor(null)}>
            <motion.div className="modal modal-sm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header"><h2>{t("addFunds")}</h2><button onClick={() => setAddFundsFor(null)}><X size={18} /></button></div>
              <form onSubmit={handleAddFunds} className="tx-form" noValidate>
                <label>{t("amount")}</label>
                <input type="number" inputMode="numeric" min="1" value={fundsAmount} onChange={(e) => setFundsAmount(e.target.value)} autoFocus />
                <button type="submit" className="btn-primary btn-block" style={{ marginTop: 14 }}>{t("save")}</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Celebration trigger={celebrateTrigger} label={celebrateLabel} />
    </div>
  );
}
