import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { getUserData, saveUserData, generateSampleMonth, clearUserData } from "../utils/storage";
import { t as translate } from "../data/translations";

const AppContext = createContext(null);

// Supabase's user object doesn't have a plain "name" field — it lives in
// user_metadata, set at signup time. Normalizing here means every other
// component can keep using user?.name and user?.email exactly like before.
function normalizeUser(supabaseUser) {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
  };
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const lang = data?.settings?.language || "en";
  const assistantMode = data?.settings?.assistantMode || "api";

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const showToast = useCallback((message, kind = "success") => {
    setToast({ message, kind, id: Date.now() });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Loads (or reloads) the current user's data whenever the Supabase auth
  // session changes — on first page load, after login, after logout.
  const handleSessionChange = useCallback(async (session) => {
    if (session?.user) {
      setUser(normalizeUser(session.user));
      try {
        const userData = await getUserData(session.user.id);
        setData(userData);
      } catch (err) {
        console.error("Failed to load user data:", err);
        setData(null);
      }
    } else {
      setUser(null);
      setData(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session).finally(() => setAuthLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });

    return () => subscription.unsubscribe();
  }, [handleSessionChange]);

  const persist = useCallback((next) => {
    if (!user) return;
    setData(next); // update UI immediately
    saveUserData(user.id, next).catch((err) => {
      console.error("Save failed:", err);
      showToast(lang === "ko" ? "저장에 실패했어요. 인터넷 연결을 확인해주세요." : "Save failed — check your internet connection.", "error");
    });
  }, [user, lang, showToast]);

  // ---------- Auth ----------

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) return { ok: false, error: "loginErrorUnconfirmed" };
      if (msg.includes("invalid login credentials")) return { ok: false, error: "loginError" };
      return { ok: false, error: "loginError" };
    }
    return { ok: true };
  }, []);

  const register = useCallback(async (name, email, password, confirmPassword) => {
    if (!name || !email || !password || !confirmPassword) return { ok: false, error: "registerErrorFields" };
    if (!/^(?=.*[A-Z]).{6,}$/.test(password)) return { ok: false, error: "registerErrorWeak" };
    if (password !== confirmPassword) return { ok: false, error: "registerErrorMatch" };

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
        return { ok: false, error: "registerErrorExists" };
      }
      return { ok: false, error: "registerErrorFields" };
    }

    // If Supabase requires email confirmation, no session exists yet —
    // the user needs to click the link in their inbox before they can log in.
    const needsConfirmation = !signUpData.session;
    return { ok: true, needsConfirmation };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // ---------- Data mutations ----------

  const addTransaction = useCallback((tx) => {
    const next = { ...data, transactions: [{ ...tx, id: "tx-" + Date.now(), createdAt: new Date().toISOString() }, ...data.transactions] };
    persist(next);
  }, [data, persist]);

  const updateTransaction = useCallback((id, updates) => {
    const next = { ...data, transactions: data.transactions.map((tItem) => tItem.id === id ? { ...tItem, ...updates } : tItem) };
    persist(next);
  }, [data, persist]);

  const deleteTransaction = useCallback((id) => {
    const next = { ...data, transactions: data.transactions.filter((tItem) => tItem.id !== id) };
    persist(next);
  }, [data, persist]);

  const addBudget = useCallback((budget) => {
    const next = { ...data, budgets: [...data.budgets, { ...budget, id: "b-" + Date.now() }] };
    persist(next);
  }, [data, persist]);

  const deleteBudget = useCallback((id) => {
    const next = { ...data, budgets: data.budgets.filter((b) => b.id !== id) };
    persist(next);
  }, [data, persist]);

  const addGoal = useCallback((goal) => {
    const next = { ...data, goals: [...data.goals, { ...goal, id: "g-" + Date.now() }] };
    persist(next);
  }, [data, persist]);

  const updateGoal = useCallback((id, updates) => {
    const next = { ...data, goals: data.goals.map((g) => g.id === id ? { ...g, ...updates } : g) };
    persist(next);
  }, [data, persist]);

  const deleteGoal = useCallback((id) => {
    const next = { ...data, goals: data.goals.filter((g) => g.id !== id) };
    persist(next);
  }, [data, persist]);

  const addNote = useCallback((text) => {
    const next = { ...data, notes: [{ id: "n-" + Date.now(), text, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString() }, ...data.notes] };
    persist(next);
  }, [data, persist]);

  const updateNote = useCallback((id, text) => {
    const next = { ...data, notes: data.notes.map((n) => n.id === id ? { ...n, text } : n) };
    persist(next);
  }, [data, persist]);

  const deleteNote = useCallback((id) => {
    const next = { ...data, notes: data.notes.filter((n) => n.id !== id) };
    persist(next);
  }, [data, persist]);

  const unlockAchievement = useCallback((key) => {
    if (data.achievements.some((a) => a.key === key)) return;
    const next = { ...data, achievements: [...data.achievements, { id: "a-" + Date.now(), key, unlockedAt: new Date().toISOString() }] };
    persist(next);
  }, [data, persist]);

  const setLanguage = useCallback((newLang) => {
    persist({ ...data, settings: { ...data.settings, language: newLang } });
  }, [data, persist]);

  const setAssistantMode = useCallback((mode) => {
    persist({ ...data, settings: { ...data.settings, assistantMode: mode } });
  }, [data, persist]);

  const generateSample = useCallback(async () => {
    if (!user) return;
    try {
      const fresh = await generateSampleMonth(user.id);
      setData(fresh);
    } catch (err) {
      console.error("generateSample failed:", err);
      showToast(lang === "ko" ? "샘플 데이터 생성에 실패했어요." : "Failed to generate sample data.", "error");
    }
  }, [user, lang, showToast]);

  const clearData = useCallback(async () => {
    if (!user) return;
    try {
      const empty = await clearUserData(user.id);
      setData(empty);
    } catch (err) {
      console.error("clearData failed:", err);
      showToast(lang === "ko" ? "데이터 삭제에 실패했어요." : "Failed to clear data.", "error");
    }
  }, [user, lang, showToast]);

  const value = {
    user, data, lang, assistantMode, t, toast, showToast, authLoading,
    login, register, logout,
    addTransaction, updateTransaction, deleteTransaction,
    addBudget, deleteBudget,
    addGoal, updateGoal, deleteGoal,
    addNote, updateNote, deleteNote,
    unlockAchievement, setLanguage, setAssistantMode, generateSample, clearData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
