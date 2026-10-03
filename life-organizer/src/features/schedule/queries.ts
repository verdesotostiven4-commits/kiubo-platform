"use server";

import { createClient } from "@/lib/supabase/server";

export type SessionWithSubject = {
  id: string;
  subject_id: string;
  day_of_week: 1 | 2 | 3 | 4 | 5;
  start_time: string;
  end_time: string;
  room: string | null;
  subject_name: string;
};

/** Trae las sesiones de clase + nombre de materia, ordenadas por día y hora. */
export async function getSchedule(): Promise<SessionWithSubject[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Materias del usuario (para unir en memoria, evitamos problemas de tipos del join).
  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", user.id);

  if (subjectsError) throw subjectsError;

  const subjectRows = (subjects ?? []) as { id: string; name: string }[];
  const subjectMap = new Map<string, string>();
  subjectRows.forEach((s) => subjectMap.set(s.id, s.name));

  const { data: sessions, error: sessionsError } = await supabase
    .from("class_sessions")
    .select("id, subject_id, day_of_week, start_time, end_time, room")
    .eq("user_id", user.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as {
    id: string;
    subject_id: string;
    day_of_week: 1 | 2 | 3 | 4 | 5;
    start_time: string;
    end_time: string;
    room: string | null;
  }[];

  return sessionRows.map((s) => ({
    ...s,
    subject_name: subjectMap.get(s.subject_id) ?? "Materia",
  }));
}
