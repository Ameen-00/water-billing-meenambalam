import { createClient } from "@supabase/supabase-js";

// Reads the two values from .env.local (VITE_ vars are exposed to the browser).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If not configured yet, the app keeps running in demo (in-memory) mode.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const isConfigured = Boolean(supabase);
