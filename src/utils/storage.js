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

// Fetches the current user's data row. A row is created automatically by
// a database trigger the moment someone finishes signing up (see
// supabase_schema.sql), so this should normally always find one — the
// fallback to emptyUserData() only matters for the brief moment right
// after signup before that trigger has run, or if something unexpected
// happens.
export async function getUserData(userId) {
  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("getUserData error:", error.message);
    return emptyUserData();
  }
  return data?.data || emptyUserData();
}

export async function saveUserData(userId, newData) {
  const { error } = await supabase
    .from("user_data")
    .update({ data: newData })
    .eq("user_id", userId);

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
