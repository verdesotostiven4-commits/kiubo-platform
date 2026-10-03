// Configuración estática del horario oficial ESPOCH.
// Espejo en TypeScript de lo que sembrará seed_initial_data() en Supabase.
// Sirve como fallback visual antes de que carguen los datos reales de la DB.

import type { DayOfWeek } from "@/types/domain";

export interface SubjectSeed {
  name: string;
  is_practice: boolean;
  sort_order: number;
}

export interface ClassSessionSeed {
  subject_name: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM"
  end_time: string;
  room: string;
}

export interface AccountSeed {
  name: string;
  kind: "banco" | "efectivo" | "ahorros";
  note: string;
  sort_order: number;
}

export const ESPOCH_SUBJECTS: SubjectSeed[] = [
  { name: "Ornitología y Aviturismo", is_practice: false, sort_order: 1 },
  {
    name: "Patrimonio Cultural Material y Turismo (Prácticas Laborales)",
    is_practice: false,
    sort_order: 2,
  },
  { name: "Estadística", is_practice: false, sort_order: 3 },
  { name: "Contabilidad General y de Costos", is_practice: false, sort_order: 4 },
  {
    name: "Servicios de Alimentación (Prácticas Laborales)",
    is_practice: false,
    sort_order: 5,
  },
  { name: "Inglés IV", is_practice: false, sort_order: 6 },
  { name: "Prácticas Laborales Autónomas", is_practice: true, sort_order: 7 },
];

export const ESPOCH_SCHEDULE: ClassSessionSeed[] = [
  // Martes
  { subject_name: "Ornitología y Aviturismo", day_of_week: 2, start_time: "09:00", end_time: "11:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Patrimonio Cultural Material y Turismo (Prácticas Laborales)", day_of_week: 2, start_time: "11:00", end_time: "13:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Estadística", day_of_week: 2, start_time: "15:00", end_time: "17:00", room: "Cuarto-1 Aula 5" },
  // Miércoles
  { subject_name: "Contabilidad General y de Costos", day_of_week: 3, start_time: "08:00", end_time: "11:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Servicios de Alimentación (Prácticas Laborales)", day_of_week: 3, start_time: "11:00", end_time: "13:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Inglés IV", day_of_week: 3, start_time: "15:00", end_time: "17:00", room: "Cuarto-1 Aula 5" },
  // Jueves
  { subject_name: "Servicios de Alimentación (Prácticas Laborales)", day_of_week: 4, start_time: "07:00", end_time: "09:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Estadística", day_of_week: 4, start_time: "09:00", end_time: "11:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Contabilidad General y de Costos", day_of_week: 4, start_time: "11:00", end_time: "13:00", room: "Cuarto-1 Aula 5" },
  // Viernes
  { subject_name: "Estadística", day_of_week: 5, start_time: "07:00", end_time: "09:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Ornitología y Aviturismo", day_of_week: 5, start_time: "09:00", end_time: "11:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Patrimonio Cultural Material y Turismo (Prácticas Laborales)", day_of_week: 5, start_time: "11:00", end_time: "13:00", room: "Cuarto-1 Aula 5" },
  { subject_name: "Inglés IV", day_of_week: 5, start_time: "15:00", end_time: "17:00", room: "Cuarto-1 Aula 5" },
];

export const ESPOCH_ACCOUNTS: AccountSeed[] = [
  { name: "Banco Pichincha", kind: "banco", note: "Banca Móvil Principal", sort_order: 1 },
  { name: "Banco del Pacífico", kind: "banco", note: "Banca Móvil Nómina", sort_order: 2 },
  { name: "Efectivo en Mano", kind: "efectivo", note: "Billetera física", sort_order: 3 },
  { name: "Bóveda de Ahorros", kind: "ahorros", note: "Fondo intocable", sort_order: 4 },
];

export const PANTRY_DEFAULT_BUDGET = {
  weeks: 3 as const,
  budget: 50.0,
};

/** Etiquetas cortas de días para el horario. */
export const DOW_SHORT: Record<DayOfWeek, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
};
