// Data layer for Moneo. Previously this read/wrote localStorage directly;
// now every function here talks to Supabase instead, so data is real and
// synced to the cloud rather than trapped in one browser.
//
// IMPORTANT: user accounts and login are handled directly by Supabase Auth
// in AppContext.jsx (supabase.auth.signUp / signInWithPassword / signOut).
// This file only handles the app's financial data — the one row per user
// in the `user_data` table, protected by Row Level Security so a user can
// only ever read or write their own row.

import { supabase } from "./supabaseClient";
import { generateDemoData } from "../data/demoData";

function emptyUserData(settings) {
  return {
    transactions: [],
    budgets: [],
    goals: [],
    notes: [],
    achievements: [],
    settings: settings || { language: "en", assistantMode: "api" },
  };
}

// Makes sure every array the pages read from actually exists, so an older
// or partially-written row can never crash a page with
// "cannot read properties of undefined (reading 'map')".
function normalize(raw) {
  const base = emptyUserData();
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    transactions: Array.isArray(d.transactions) ? d.transactions : base.transactions,
    budgets: Array.isArray(d.budgets) ? d.budgets : base.budgets,
    goals: Array.isArray(d.goals) ? d.goals : base.goals,
    notes: Array.isArray(d.notes) ? d.notes : base.notes,
    achievements: Array.isArray(d.achievements) ? d.achievements : base.achievements,
    settings: { ...base.settings, ...(d.settings || {}) },
  };
}

// Fetches the current user's data row.
//
// IMPORTANT: a real error (network down, Supabase hiccup) must THROW, not
// quietly return empty data. Previously any error returned an empty object,
// and the very next save (e.g. adding one transaction) overwrote the user's
// entire real history in the cloud with that empty object.
//
// Only "no row exists yet" is treated as empty — and in that case we create
// the row, so saves afterwards have something to update (covers accounts
// created before the signup trigger existed).
export async function getUserData(userId) {
  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getUserData error:", error.message);
    throw error;
  }

  if (!data) {
    const fresh = emptyUserData();
    await saveUserData(userId, fresh);
    return fresh;
  }
  return normalize(data.data);
}

// upsert instead of update: an update against a missing row "succeeds"
// with zero rows changed, so data would silently never be saved.
export async function saveUserData(userId, newData) {
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, data: newData }, { onConflict: "user_id" });

  if (error) {
    console.error("saveUserData error:", error.message);
    throw error;
  }
  return newData;
}

// Explicit, opt-in demo data tool (Settings > Demo Tools > "Generate
// Sample Month"). Never called automatically.
export async function generateSampleMonth(userId) {
  const existing = await getUserData(userId);
  const sample = generateDemoData();
  const merged = { ...sample, settings: existing.settings || sample.settings };
  await saveUserData(userId, merged);
  return merged;
}

export async function clearUserData(userId) {
  const existing = await getUserData(userId);
  const empty = emptyUserData(existing.settings);
  await saveUserData(userId, empty);
  return empty;
}
