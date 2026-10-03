// Utilidades de fecha para Harmony OS.
// Zona: America/Guayaquil (UTC-5). Formato canónico: ISO 'YYYY-MM-DD'.

export const TIMEZONE = "America/Guayaquil" as const;

export const ESPOCH_SEMESTER = {
  start: "2026-09-07",
  end: "2027-02-05",
} as const;

export const DOW_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Hoy en zona Guayaquil como 'YYYY-MM-DD'. */
export function toISODate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Parsea 'YYYY-MM-DD' a Date local (sin desfase de zona). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Suma N días a un ISO (aritmética UTC, sin desfase). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Día de la semana ISO: 1=Lun .. 7=Dom. */
export function weekday(iso: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const d = parseISO(iso);
  const wd = d.getDay(); // 0=Dom..6=Sab
  return (wd === 0 ? 7 : wd) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** ISO del lunes de la semana que contiene 'iso'. */
export function mondayOf(iso: string): string {
  const wd = weekday(iso);
  return addDays(iso, -(wd - 1));
}

/** ISOs Lun..Dom de la semana de 'iso'. */
export function weekDays(iso: string): string[] {
  const mon = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** ¿Está 'iso' dentro del semestre ESPOCH? */
export function inSemester(iso: string): boolean {
  return iso >= ESPOCH_SEMESTER.start && iso <= ESPOCH_SEMESTER.end;
}

/** Fecha legible: "lunes 5 de octubre de 2026". */
export function formatLong(iso: string): string {
  const d = parseISO(iso);
  const dow = DOW_LABELS[(weekday(iso) - 1) % 7];
  return `${dow.toLowerCase()} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Corta: "lun 5 oct". */
export function formatShort(iso: string): string {
  const d = parseISO(iso);
  const dow = DOW_LABELS[(weekday(iso) - 1) % 7].slice(0, 3).toLowerCase();
  const mon = MONTHS_ES[d.getMonth()].slice(0, 3);
  return `${dow} ${d.getDate()} ${mon}`;
}

/** Matriz de días del mes (con huecos iniciales como null) para grilla tipo calendario. */
export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(year, month0, 1);
  const firstWd = first.getDay(); // 0=Dom..6=Sab
  const lead = firstWd === 0 ? 6 : firstWd - 1; // huecos para arrancar en Lunes
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const mm = String(month0 + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
