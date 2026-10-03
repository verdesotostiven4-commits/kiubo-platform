"use server";

import { createClient } from "@/lib/supabase/server";
import { getSubjects } from "@/features/tasks/queries";

export type PracticeLog = {
  id: string;
  practice_date: string;
  description: string;
  hours: number;
  created_at: string;
};

export type ExamGrade = {
  id: string;
  subject_id: string;
  subject_name: string;
  exam_name: string;
  grade: number;
  max_grade: number;
  exam_date: string;
  created_at: string;
};

export type { SubjectOption } from "@/features/tasks/queries";

/** Trae los registros de prácticas laborales recientes. */
export async function getRecentPractices(): Promise<PracticeLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("practice_logs")
    .select("id, practice_date, description, hours, created_at")
    .eq("user_id", user.id)
    .order("practice_date", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as PracticeLog[];
}

/** Crea un nuevo registro de práctica. */
export async function createPractice(input: {
  practice_date: string;
  description: string;
  hours: number;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("practice_logs").insert(
    {
      user_id: user.id,
      practice_date: input.practice_date,
      description: input.description,
      hours: input.hours,
    } as never,
  );

  if (error) throw error;
}

/** Elimina un registro de práctica. */
export async function deletePractice(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("practice_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/** Trae las notas de exámenes con nombre de materia. */
export async function getExamGrades(): Promise<ExamGrade[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const subjects = await getSubjects();
  const subjectMap = new Map<string, string>();
  subjects.forEach((s) => subjectMap.set(s.id, s.name));

  const { data, error } = await supabase
    .from("exam_grades")
    .select(
      "id, subject_id, exam_name, grade, max_grade, exam_date, created_at",
    )
    .eq("user_id", user.id)
    .order("exam_date", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Omit<ExamGrade, "subject_name">[];
  return rows.map((r) => ({
    ...r,
    subject_name: subjectMap.get(r.subject_id) ?? "Materia",
  }));
}

/** Crea una nueva nota de examen. */
export async function createExamGrade(input: {
  subject_id: string;
  exam_name: string;
  grade: number;
  max_grade?: number;
  exam_date: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("exam_grades").insert(
    {
      user_id: user.id,
      subject_id: input.subject_id,
      exam_name: input.exam_name,
      grade: input.grade,
      max_grade: input.max_grade ?? 10,
      exam_date: input.exam_date,
    } as never,
  );

  if (error) throw error;
}

/** Elimina una nota de examen. */
export async function deleteExamGrade(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("exam_grades")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
