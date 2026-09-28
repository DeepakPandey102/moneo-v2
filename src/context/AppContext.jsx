import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { getUserData, saveUserData, clearUserData } from "../utils/storage";
import { t as translate } from "../data/translations";
import { todayLocal } from "../utils/dates";

const AppContext = createContext(null);

// Supabase's user object doesn't have a plain "name" field — it lives in
// user_metadata, set at signup time. Normalizing here means every other
// component can keep using user?.name and user?.email exactly like before.
function normalizeUser(supabaseUser) {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0] || "User",
    // Google accounts come with a profile photo
    avatarUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null,
    provider: supabaseUser.app_metadata?.provider || "email",
  };
}

// Date.now() alone collides when two items are created in the same
// millisecond (e.g. a quick double-click), which breaks React keys and
// makes edit/delete hit the wrong item.
const GUEST_LANG_KEY = "moneo-lang";
function readGuestLang() {
  try { return localStorage.getItem(GUEST_LANG_KEY) === "ko" ? "ko" : "en"; } catch { return "en"; }
}

// A password-reset email link brings the user back with "?reset=1" (we put
// it there in requestPasswordReset). Checked once at startup, before
// Supabase cleans the URL.
function urlSaysRecovery() {
  try { return new URLSearchParams(window.location.search).get("reset") === "1"; } catch { return false; }
}

function makeId(prefix) {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [guestLang, setGuestLang] = useState(readGuestLang);
  const [recoveryMode, setRecoveryMode] = useState(urlSaysRecovery);

  // Always holds the LATEST data. Mutations read from here instead of from
  // the `data` captured in their closure. Without this, two mutations in the
  // same click (e.g. addTransaction + unlockAchievement) both started from
  // the same old snapshot, and the second one silently erased the first —
  // a new user's first transaction, first budget, and first goal all
  // disappeared this way.
  const dataRef = useRef(null);
  const userIdRef = useRef(null);
  const loadedForRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Save queue: only one save in flight at a time, and only the newest
  // state is written. Prevents an older, slower request from landing after
  // a newer one and overwriting it.
  const pendingSaveRef = useRef(null);
  const savingRef = useRef(false);

  const lang = data?.settings?.language || guestLang;
  const assistantMode = "api"; // Demo mode removed — the app always uses the AI server
  const langRef = useRef(lang);
  langRef.current = lang;

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  useEffect(() => { document.documentElement.lang = lang === "ko" ? "ko" : "en"; }, [lang]);

  const showToast = useCallback((message, kind = "success") => {
    clearTimeout(toastTimerRef.current); // an old timer must not hide a newer toast early
    setToast({ message, kind, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const replaceData = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const loadData = useCallback(async (userId) => {
    setDataError(null);
    try {
      const userData = await getUserData(userId);
      if (userIdRef.current !== userId) return; // user logged out / switched meanwhile
      replaceData(userData);
    } catch (err) {
      console.error("Failed to load user data:", err);
      if (userIdRef.current !== userId) return;
      loadedForRef.current = null; // allow a retry
      setDataError(err);
    }
  }, [replaceData]);

  // Called on first load, login, logout, AND every hourly token refresh.
  // Only (re)load data when the signed-in user actually changes — reloading
  // on token refresh used to overwrite whatever the user was in the middle of.
  // Returns a promise for the data load (or null if nothing needs loading).
  // Everything before the load runs synchronously so `user` is set right
  // away — Login navigates to the dashboard immediately after signing in.
  const handleSessionChange = useCallback((session) => {
    const sUser = session?.user;
    if (sUser) {
      setUser((prev) => (prev && prev.id === sUser.id && prev.email === sUser.email ? prev : normalizeUser(sUser)));
      userIdRef.current = sUser.id;
      if (loadedForRef.current === sUser.id) return null;
      loadedForRef.current = sUser.id;
      replaceData(null);
      return loadData(sUser.id);
    }
    userIdRef.current = null;
    loadedForRef.current = null;
    pendingSaveRef.current = null;
    setUser(null);
    replaceData(null);
    setDataError(null);
    return null;
  }, [loadData, replaceData]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data: { session } }) => handleSessionChange(session))
      .catch((err) => console.error("getSession failed:", err))
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      // Keep this callback synchronous: Supabase docs warn that awaiting
      // other Supabase calls inside it can deadlock. The user is set
      // immediately; the data query is started on the next tick.
      const sUser = session?.user;
      if (sUser && loadedForRef.current !== sUser.id) {
        setUser(normalizeUser(sUser));
        userIdRef.current = sUser.id;
        setTimeout(() => handleSessionChange(session), 0);
      } else {
        handleSessionChange(session);
      }
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [handleSessionChange]);

  const retryLoad = useCallback(() => {
    const id = userIdRef.current;
    if (!id) return;
    loadedForRef.current = id;
    loadData(id);
  }, [loadData]);

  const flushSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingSaveRef.current) {
        const { userId, snapshot } = pendingSaveRef.current;
        pendingSaveRef.current = null;
        try {
          await saveUserData(userId, snapshot);
        } catch (err) {
          console.error("Save failed:", err);
          showToast(langRef.current === "ko" ? "저장에 실패했어요. 인터넷 연결을 확인해주세요." : "Save failed — check your internet connection.", "error");
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, [showToast]);

  // The one way to change data: pass a function that receives the latest
  // data and returns the next version.
  const mutate = useCallback((updater) => {
    const userId = userIdRef.current;
    const current = dataRef.current;
    if (!userId || !current) return;
    const next = updater(current);
    if (!next || next === current) return;
    replaceData(next); // update UI immediately
    pendingSaveRef.current = { userId, snapshot: next };
    flushSaves();
  }, [replaceData, flushSaves]);

  // ---------- Auth ----------

  const login = useCallback(async (email, password) => {
    let error;
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch (e) {
      error = e;
    }
    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("email not confirmed")) return { ok: false, error: "loginErrorUnconfirmed" };
      if (msg.includes("invalid login credentials")) return { ok: false, error: "loginError" };
      return { ok: false, error: "loginErrorGeneric" };
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
      if (msg.includes("password")) return { ok: false, error: "registerErrorWeak" };
      return { ok: false, error: "registerErrorGeneric" };
    }

    // If Supabase requires email confirmation, no session exists yet —
    // the user needs to click the link in their inbox before they can log in.
    const needsConfirmation = !signUpData.session;
    return { ok: true, needsConfirmation };
  }, []);

  const logout = useCallback(async () => {
    // Stop Google One Tap from instantly signing the user back in.
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* not loaded */ }
    setRecoveryMode(false);
    await supabase.auth.signOut();
  }, []);

  // Full-page redirect to Google's account chooser; Supabase brings the user
  // back to this site already logged in.
  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      console.error("Google sign-in failed:", error);
      return { ok: false, error: "googleError" };
    }
    return { ok: true };
  }, []);

  // Used by Google One Tap: Google hands us a signed ID token directly.
  const loginWithGoogleIdToken = useCallback(async (token, nonce) => {
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce });
    if (error) {
      console.error("One Tap sign-in failed:", error);
      return { ok: false, error: "googleError" };
    }
    return { ok: true };
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    if (!email) return { ok: false, error: "resetErrorEmail" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + "?reset=1",
    });
    // Don't reveal whether an account exists for this email — but do report
    // rate limits / network problems.
    if (error && !/not found|no user/i.test(error.message || "")) {
      console.error("Password reset failed:", error);
      return { ok: false, error: /rate|seconds/i.test(error.message || "") ? "resetErrorRate" : "loginErrorGeneric" };
    }
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (password, confirmPassword) => {
    if (!/^(?=.*[A-Z]).{6,}$/.test(password || "")) return { ok: false, error: "registerErrorWeak" };
    if (password !== confirmPassword) return { ok: false, error: "registerErrorMatch" };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("updatePassword failed:", error);
      return { ok: false, error: /different|same/i.test(error.message || "") ? "resetErrorSame" : "loginErrorGeneric" };
    }
    setRecoveryMode(false);
    return { ok: true };
  }, []);

  const finishRecovery = useCallback(() => setRecoveryMode(false), []);

  // ---------- Data mutations ----------

  const addTransaction = useCallback((tx) => {
    mutate((d) => ({ ...d, transactions: [{ ...tx, id: makeId("tx"), createdAt: new Date().toISOString() }, ...d.transactions] }));
  }, [mutate]);

  const updateTransaction = useCallback((id, updates) => {
    mutate((d) => ({ ...d, transactions: d.transactions.map((tItem) => tItem.id === id ? { ...tItem, ...updates, id } : tItem) }));
  }, [mutate]);

  const deleteTransaction = useCallback((id) => {
    mutate((d) => ({ ...d, transactions: d.transactions.filter((tItem) => tItem.id !== id) }));
  }, [mutate]);

  const addBudget = useCallback((budget) => {
    mutate((d) => {
      // one budget per category — ignore duplicates
      if (d.budgets.some((b) => b.category === budget.category)) return d;
      return { ...d, budgets: [...d.budgets, { ...budget, id: makeId("b") }] };
    });
  }, [mutate]);

  const deleteBudget = useCallback((id) => {
    mutate((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));
  }, [mutate]);

  const addGoal = useCallback((goal) => {
    mutate((d) => ({ ...d, goals: [...d.goals, { ...goal, id: makeId("g") }] }));
  }, [mutate]);

  const updateGoal = useCallback((id, updates) => {
    mutate((d) => ({ ...d, goals: d.goals.map((g) => g.id === id ? { ...g, ...updates, id } : g) }));
  }, [mutate]);

  const deleteGoal = useCallback((id) => {
    mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
  }, [mutate]);

  const addNote = useCallback((text) => {
    mutate((d) => ({ ...d, notes: [{ id: makeId("n"), text, date: todayLocal(), createdAt: new Date().toISOString() }, ...d.notes] }));
  }, [mutate]);

  const updateNote = useCallback((id, text) => {
    mutate((d) => ({ ...d, notes: d.notes.map((n) => n.id === id ? { ...n, text } : n) }));
  }, [mutate]);

  const deleteNote = useCallback((id) => {
    mutate((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  }, [mutate]);

  const unlockAchievement = useCallback((key) => {
    mutate((d) => {
      if (d.achievements.some((a) => a.key === key)) return d; // no-op, no save
      return { ...d, achievements: [...d.achievements, { id: makeId("a"), key, unlockedAt: new Date().toISOString() }] };
    });
  }, [mutate]);

  const setLanguage = useCallback((newLang) => {
    setGuestLang(newLang);
    try { localStorage.setItem(GUEST_LANG_KEY, newLang); } catch { /* private mode */ }
    // Before login there's no cloud data yet — the local choice is enough.
    if (dataRef.current) mutate((d) => ({ ...d, settings: { ...d.settings, language: newLang } }));
  }, [mutate]);

  const setAssistantMode = useCallback((mode) => {
    mutate((d) => ({ ...d, settings: { ...d.settings, assistantMode: mode } }));
  }, [mutate]);

  const clearData = useCallback(async () => {
    if (!user) return;
    try {
      const empty = await clearUserData(user.id);
      replaceData(empty);
      return true;
    } catch (err) {
      console.error("clearData failed:", err);
      showToast(lang === "ko" ? "데이터 삭제에 실패했어요." : "Failed to clear data.", "error");
      return false;
    }
  }, [user, lang, showToast, replaceData]);

  const value = {
    user, data, dataError, retryLoad, lang, assistantMode, t, toast, showToast, authLoading,
    login, register, logout,
    loginWithGoogle, loginWithGoogleIdToken, requestPasswordReset, updatePassword,
    recoveryMode, finishRecovery,
    addTransaction, updateTransaction, deleteTransaction,
    addBudget, deleteBudget,
    addGoal, updateGoal, deleteGoal,
    addNote, updateNote, deleteNote,
    unlockAchievement, setLanguage, setAssistantMode, clearData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
