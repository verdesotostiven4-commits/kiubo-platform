import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Cliente Supabase para el navegador (cookies gestionadas por @supabase/ssr). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
