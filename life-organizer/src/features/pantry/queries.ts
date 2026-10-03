"use server";

import { createClient } from "@/lib/supabase/server";
import type { PantryCategory } from "@/types/domain";
import { toISODate } from "@/lib/dates";

export type PantryBudget = {
  id: string;
  weeks: number;
  budget: number;
  is_active: boolean;
  created_at: string;
};

export type ShoppingItem = {
  id: string;
  name: string;
  category: PantryCategory;
  checked: boolean;
  created_at: string;
};

export type CategoryExpense = {
  id: string;
  category: PantryCategory;
  amount: number;
  updated_at: string;
};

export type ExtraExpense = {
  id: string;
  name: string;
  cost: number;
  expense_date: string;
  created_at: string;
};

/** Trae el presupuesto de despensa activo. */
export async function getActiveBudget(): Promise<PantryBudget | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("pantry_budgets")
    .select("id, weeks, budget, is_active, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as PantryBudget | null) ?? null;
}

/** Trae la lista de compras del usuario. */
export async function getShoppingItems(): Promise<ShoppingItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, name, category, checked, created_at")
    .eq("user_id", user.id)
    .order("checked", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ShoppingItem[];
}

/** Agrega un item a la lista de compras. */
export async function addShoppingItem(input: {
  name: string;
  category: PantryCategory;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const budget = await getActiveBudget();

  const { error } = await supabase.from("shopping_items").insert(
    {
      user_id: user.id,
      budget_id: budget?.id ?? null,
      name: input.name,
      category: input.category,
      checked: false,
    } as never,
  );

  if (error) throw error;
}

/** Marca/desmarca un item como comprado. */
export async function toggleShoppingItem(
  id: string,
  checked: boolean,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("shopping_items")
    .update({ checked } as never)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/** Elimina un item de la lista de compras. */
export async function deleteShoppingItem(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/** Trae los gastos por categoría del presupuesto activo. */
export async function getCategoryExpenses(): Promise<CategoryExpense[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const budget = await getActiveBudget();
  if (!budget) return [];

  const { data, error } = await supabase
    .from("pantry_category_expenses")
    .select("id, category, amount, updated_at")
    .eq("user_id", user.id)
    .eq("budget_id", budget.id);

  if (error) throw error;
  return (data ?? []) as CategoryExpense[];
}

/** Actualiza el gasto de una categoría (acumula). */
export async function updateCategoryExpense(
  category: PantryCategory,
  amount: number,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const budget = await getActiveBudget();
  if (!budget) throw new Error("No hay presupuesto activo");

  // Upsert: si existe la categoría para este presupuesto, suma; si no, crea.
  const { data: existing, error: fetchError } = await supabase
    .from("pantry_category_expenses")
    .select("id, amount")
    .eq("user_id", user.id)
    .eq("budget_id", budget.id)
    .eq("category", category)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

  if (existing) {
    const currentAmount = (existing as { amount: number }).amount;
    const { error } = await supabase
      .from("pantry_category_expenses")
      .update({
        amount: currentAmount + amount,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("pantry_category_expenses").insert(
      {
        user_id: user.id,
        budget_id: budget.id,
        category,
        amount,
        updated_at: new Date().toISOString(),
      } as never,
    );
    if (error) throw error;
  }
}

/** Trae los gastos extra del usuario. */
export async function getExtraExpenses(): Promise<ExtraExpense[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("extra_expenses")
    .select("id, name, cost, expense_date, created_at")
    .eq("user_id", user.id)
    .order("expense_date", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as ExtraExpense[];
}

/** Registra un gasto extra. */
export async function addExtraExpense(input: {
  name: string;
  cost: number;
  expense_date?: string;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const budget = await getActiveBudget();

  const { error } = await supabase.from("extra_expenses").insert(
    {
      user_id: user.id,
      budget_id: budget?.id ?? null,
      name: input.name,
      cost: input.cost,
      expense_date: input.expense_date ?? toISODate(),
    } as never,
  );

  if (error) throw error;
}

/** Elimina un gasto extra. */
export async function deleteExtraExpense(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("extra_expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}
