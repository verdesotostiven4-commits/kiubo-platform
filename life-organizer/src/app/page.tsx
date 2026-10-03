import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Home — redirige según estado de sesión.
 * Logueado → /dashboard · Sin sesión → /login
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  redirect("/login");
}
