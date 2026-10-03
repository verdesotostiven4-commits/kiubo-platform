// Configuración de finanzas: categorías de ingreso, presets de ahorro,
// y metadatos visuales para la UI.

import type { IncomeMainCategory, AccountKind, MuscleGroup, PantryCategory } from "@/types/domain";

export const INCOME_MAIN_CATEGORIES: IncomeMainCategory[] = [
  "Fotografía & Video",
  "Sistemas / Programación",
  "Ingresos Extras",
];

export const INCOME_SUB_CATEGORIES: Record<IncomeMainCategory, string[]> = {
  "Fotografía & Video": [
    "Sesión de fotos",
    "Edición / Post-producción",
    "Video eventos",
    "Impresión / Álbumes",
    "Alquiler de equipo",
  ],
  "Sistemas / Programación": [
    "Desarrollo web",
    "App móvil",
    "Mantenimiento / Soporte",
    "Consultoría",
    "Freelance / Plataforma",
  ],
  "Ingresos Extras": [
    "Ventas",
    "Reembolso",
    "Préstamo recibido",
    "Regalo",
    "Otros",
  ],
};

/** Presets rápidos de % de ahorro al registrar un ingreso. */
export const SAVINGS_PRESETS = [0, 10, 15, 20, 30, 50] as const;

export const ACCOUNT_KIND_LABELS: Record<AccountKind, { label: string; emoji: string }> = {
  banco: { label: "Banco", emoji: "🏦" },
  efectivo: { label: "Efectivo", emoji: "💵" },
  ahorros: { label: "Ahorros", emoji: "🐷" },
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Glúteos & Piernas",
  "Espalda & Brazos",
  "Abdomen & Core",
  "Cardio & Caminata",
  "Cuerpo Completo",
];

export const PANTRY_CATEGORIES: PantryCategory[] = [
  "Frutas",
  "Verduras",
  "Proteína",
  "Granos secos",
  "Lácteos",
];

/** Meta diaria de hidratación (8 vasos × 250ml = 2L). */
export const WATER_GOAL_CUPS = 8;
export const WATER_CUP_ML = 250;

/** Umbral reglamentario de asistencia ESPOCH (75%). */
export const ATTENDANCE_THRESHOLD = 75;

/** Formatea un número como moneda USD. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Formatea un número como porcentaje con 1 decimal. */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}
