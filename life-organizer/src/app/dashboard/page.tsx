import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatLong, toISODate } from "@/lib/dates";

const MODULES = [
  { href: "/schedule", label: "Horario", emoji: "📅", desc: "Clases ESPOCH" },
  { href: "/tasks", label: "Tareas", emoji: "📝", desc: "Por prioridad" },
  { href: "/finance", label: "Finanzas", emoji: "💰", desc: "Cuentas y gastos" },
  { href: "/wellness", label: "Bienestar", emoji: "💧", desc: "Agua y gym" },
  { href: "/pantry", label: "Despensa", emoji: "🛒", desc: "Compras" },
  { href: "/academic", label: "Notas", emoji: "🎓", desc: "Prácticas y exámenes" },
] as const;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Si no tiene materias, sembrar datos iniciales.
  const { count } = await supabase
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count === 0) {
    await supabase.rpc("seed_initial_data");
  }

  // Perfil del usuario.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const name =
    (profile as { display_name?: string } | null)?.display_name ??
    user.email?.split("@")[0] ??
    "Mónica";
  const today = toISODate();

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Hola, {name}</h1>
        <p className="text-sm text-lila-500 mt-1">{formatLong(today)}</p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <h2 className="text-sm font-semibold text-lila-900 mb-1">
            Harmony OS
          </h2>
          <p className="text-sm text-lila-600 mb-4">
            Todos los módulos están listos. Toca cualquiera para empezar.
          </p>
          <div>
            <p className="text-xs text-lila-400 mb-1">Progreso del proyecto</p>
            <ProgressBar value={100} tone="emerald" />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group min-w-0 rounded-xl border border-lavanda-200 bg-lavanda-50/50 p-4 text-center transition-colors hover:border-lavanda-300 hover:shadow-sm hover:bg-lavanda-50 focus-visible:ring-2 focus-visible:ring-lavanda-500 focus-visible:ring-offset-2"
          >
            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
              {mod.emoji}
            </div>
            <p className="text-xs font-semibold text-lavanda-700">
              {mod.label}
            </p>
            <p className="text-[10px] text-lila-400 mt-0.5">{mod.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
