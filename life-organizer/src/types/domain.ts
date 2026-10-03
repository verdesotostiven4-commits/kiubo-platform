// Tipos de dominio compartidos (no generados por Supabase).

export type Priority = 1 | 2 | 3 | 4 | 5;
export type TaskCategory = "estudio" | "personal" | "deseos";
export type DayOfWeek = 1 | 2 | 3 | 4 | 5; // Lun..Vie
export type AttendanceStatus = "asisti" | "falta" | "no_hubo";
export type MuscleGroup =
  | "Glúteos & Piernas"
  | "Espalda & Brazos"
  | "Abdomen & Core"
  | "Cardio & Caminata"
  | "Cuerpo Completo";
export type PantryCategory =
  | "Frutas"
  | "Verduras"
  | "Proteína"
  | "Granos secos"
  | "Lácteos";
export type AccountKind = "banco" | "efectivo" | "ahorros";
export type TransactionType = "ingreso" | "gasto" | "retiro";
export type IncomeMainCategory =
  | "Fotografía & Video"
  | "Sistemas / Programación"
  | "Ingresos Extras";
export type DebtDirection = "debo" | "me_deben";
export type DebtStatus = "pendiente" | "pagado";

/** Metadata visual de la escala Likert de prioridad 1-5. */
export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string; solid: string }
> = {
  5: {
    label: "Máxima / Hoy",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    solid: "bg-rose-500 text-white",
  },
  4: {
    label: "Alta",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
    solid: "bg-orange-500 text-white",
  },
  3: {
    label: "Media",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    solid: "bg-amber-500 text-white",
  },
  2: {
    label: "Normal",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    solid: "bg-emerald-500 text-white",
  },
  1: {
    label: "Sin prisa",
    badge: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
    solid: "bg-teal-500 text-white",
  },
};

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; active: string; idle: string }
> = {
  asisti: {
    label: "Asistí",
    active: "bg-emerald-500 text-white border-emerald-500",
    idle: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
  falta: {
    label: "Falta",
    active: "bg-rose-500 text-white border-rose-500",
    idle: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
  no_hubo: {
    label: "No hubo clase",
    active: "bg-amber-500 text-white border-amber-500",
    idle: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
};
