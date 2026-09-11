// The ONLY file that creates the Supabase connection. Everything else
// (auth, saving/loading data) imports this client rather than creating
// its own — keeps configuration in one place.
//
// The two values below are NOT secrets. The Supabase "anon" key is
// specifically designed to be used in browser code — it's meaningless
// without the Row Level Security rules we set up in the database, which
// are what actually keep each user's data private. This is different
// from the Gemini API key, which must stay server-side only.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
