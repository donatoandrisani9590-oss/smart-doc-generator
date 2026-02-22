import { createClient } from '@supabase/supabase-js'

/**
 * §14 — Supabase Client Singleton
 *
 * Used for authentication. All other data goes through
 * our FastAPI backend via api-client.ts.
 *
 * Environment variables:
 *   VITE_SUPABASE_URL      — Project URL (e.g., https://xxx.supabase.co)
 *   VITE_SUPABASE_ANON_KEY — Public anon key (safe for frontend)
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
