"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Si ya hay sesión, redirigir al dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || email.split("@")[0] },
        },
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Confirmación de email desactivada → sesión activa.
        router.push("/dashboard");
        router.refresh();
      } else {
        // Confirmación de email activada → avisar al usuario.
        setInfo(
          "Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.",
        );
        setMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }

    setLoading(false);
  };

  const inputClass =
    "w-full h-10 px-3 rounded-xl border border-lila-200 text-sm outline-none transition-colors focus:border-lavanda-400 focus:ring-2 focus:ring-lavanda-400/20";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        {/* Logo / título */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-lila-950">Harmony OS</h1>
          <p className="text-sm text-lila-500 mt-1">Planificador ESPOCH</p>
        </div>

        {/* Toggle login / register */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-lila-50">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "login"
                ? "bg-white text-lila-900 shadow-sm"
                : "text-lila-500"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setInfo(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "register"
                ? "bg-white text-lila-900 shadow-sm"
                : "text-lila-500"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-lila-600 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mónica"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1">
              Correo
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="monica@espoch.edu.ec"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {info && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading
              ? "Cargando…"
              : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
