import { createClient } from "@supabase/supabase-js";

// Env vars (local dev via .env.local) with a public-key fallback so the build
// is self-contained for hosting from GitHub. The anon key is a PUBLIC key —
// it's meant to be exposed in client code; Row Level Security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL || "https://vyqwqknxfufarfyukxzu.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5cXdxa254ZnVmYXJmeXVreHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzExNDcsImV4cCI6MjA5ODc0NzE0N30.OCGmjBso305pXSgk9PRVDnlZGmvwIf4VqxviSMC0iJY";

// If not configured yet, the app keeps running in demo (in-memory) mode.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const isConfigured = Boolean(supabase);
