"use server";

import { createClient } from "@/lib/supabase/server";
import type { MuscleGroup } from "@/types/domain";
import { toISODate } from "@/lib/dates";

export type WaterLog = {
  log_date: string;
  cups: number;
};

export type WorkoutLog = {
  id: string;
  workout_date: string;
  minutes: number;
  muscle_group: MuscleGroup;
  note: string;
  created_at: string;
};

/** Trae el registro de agua de hoy. */
export async function getTodayWater(): Promise<WaterLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = toISODate();
  const { data, error } = await supabase
    .from("water_logs")
    .select("log_date, cups")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as WaterLog | null) ?? null;
}

/** Trae los registros de agua de la última semana. */
export async function getWeekWater(): Promise<WaterLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const today = toISODate();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);

  const { data, error } = await supabase
    .from("water_logs")
    .select("log_date, cups")
    .eq("user_id", user.id)
    .gte("log_date", toISODate(weekAgo))
    .lte("log_date", today)
    .order("log_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as WaterLog[];
}

/** Incrementa o decrementa los vasos de agua de hoy. */
export async function updateWaterCups(delta: number): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const today = toISODate();

  // Upsert: si no existe fila para hoy, la crea con delta; si existe, suma delta.
  const { data: existing, error: fetchError } = await supabase
    .from("water_logs")
    .select("log_date, cups")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

  const currentCups = (existing as WaterLog | null)?.cups ?? 0;
  const newCups = Math.max(0, currentCups + delta);

  const { error } = await supabase.from("water_logs").upsert(
    {
      user_id: user.id,
      log_date: today,
      cups: newCups,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id, log_date" },
  );

  if (error) throw error;
  return newCups;
}

/** Trae los entrenamientos recientes (últimos 20). */
export async function getRecentWorkouts(): Promise<WorkoutLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workout_logs")
    .select(
      "id, workout_date, minutes, muscle_group, note, created_at",
    )
    .eq("user_id", user.id)
    .order("workout_date", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as WorkoutLog[];
}

/** Registra un nuevo entrenamiento. */
export async function createWorkout(input: {
  workout_date: string;
  minutes: number;
  muscle_group: MuscleGroup;
  note?: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("workout_logs").insert(
    {
      user_id: user.id,
      workout_date: input.workout_date,
      minutes: input.minutes,
      muscle_group: input.muscle_group,
      note: input.note ?? "",
    } as never,
  );

  if (error) throw error;
}

/** Elimina un entrenamiento. */
export async function deleteWorkout(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
