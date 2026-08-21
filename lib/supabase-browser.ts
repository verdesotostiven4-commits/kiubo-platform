import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(){
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if(typeof window === "undefined" || !isSupabaseConfigured()) return null;
  if(browserClient) return browserClient;
  browserClient=createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
  );
  return browserClient;
}
