"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import {
  LayoutDashboard,
  Calendar,
  ListChecks,
  Wallet,
  Droplet,
  ShoppingCart,
  GraduationCap,
  LogOut,
  MoreHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/schedule", label: "Horario", icon: Calendar },
  { href: "/tasks", label: "Tareas", icon: ListChecks },
  { href: "/finance", label: "Finanzas", icon: Wallet },
  { href: "/wellness", label: "Bienestar", icon: Droplet },
  { href: "/pantry", label: "Despensa", icon: ShoppingCart },
  { href: "/academic", label: "Notas", icon: GraduationCap },
];

const PRIMARY_LINKS = LINKS.slice(0, 4);
const MORE_LINKS = LINKS.slice(4);

export function NavBar() {
  const pathname = usePathname();
  const supabase = createClient();
  const moreRef = useRef<HTMLDetailsElement>(null);

  // Hide navigation on login.
  if (pathname === "/login") return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const closeMore = () => {
    if (moreRef.current) moreRef.current.open = false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      <header className="app-header sticky top-0 z-30 border-b border-lila-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            onClick={closeMore}
            className="inline-flex min-h-11 items-center font-bold text-lila-900 tracking-tight shrink-0 rounded-lg"
          >
            Harmony OS
          </Link>

          <nav aria-label="Principal" className="hidden lg:flex items-center gap-0.5">
            {LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMore}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-lavanda-50 text-lavanda-700"
                      : "text-lila-500 hover:bg-lila-50 hover:text-lila-700",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lila-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav
        aria-label="Principal móvil"
        className="app-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-lila-100 bg-marfil lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMore}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors",
                active
                  ? "bg-lavanda-50 text-lavanda-700"
                  : "text-lila-500 hover:bg-lila-50 hover:text-lila-700",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}

        <details
          key={pathname}
          ref={moreRef}
          className="relative min-w-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) closeMore();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeMore();
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className={cn(
              "flex h-full min-h-11 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors",
              MORE_LINKS.some((link) => isActive(link.href))
                ? "bg-lavanda-50 text-lavanda-700"
                : "text-lila-500 hover:bg-lila-50 hover:text-lila-700",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            Más
          </summary>
          <div className="absolute bottom-full right-0 mb-3 w-56 max-w-[calc(100vw-1rem)] max-h-[60dvh] overflow-y-auto rounded-xl border border-lila-100 bg-marfil p-2 shadow-lg">
            {MORE_LINKS.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMore}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-lavanda-50 text-lavanda-700"
                      : "text-lila-500 hover:bg-lila-50 hover:text-lila-700",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </details>
      </nav>
    </>
  );
}
