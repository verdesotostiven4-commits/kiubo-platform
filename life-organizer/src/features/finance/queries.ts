"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  TransactionType,
  IncomeMainCategory,
  AccountKind,
  DebtDirection,
  DebtStatus,
} from "@/types/domain";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  note: string;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  account_id: string;
  account_name: string;
  to_account_id: string | null;
  to_account_name: string | null;
  amount: number;
  main_category: IncomeMainCategory | null;
  sub_category: string | null;
  description: string;
  savings_pct: number;
  savings_amount: number;
  net_amount: number;
  created_at: string;
};

export type Debt = {
  id: string;
  person: string;
  amount: number;
  reason: string;
  direction: DebtDirection;
  status: DebtStatus;
  settled_at: string | null;
  created_at: string;
};

/** Trae todas las cuentas del usuario con saldo. */
export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, kind, balance, note, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Account[];
}

/** Trae las transacciones recientes del usuario (últimas 50). */
export async function getRecentTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Cuentas para el join en memoria.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("user_id", user.id);

  const accountMap = new Map<string, string>();
  ((accounts ?? []) as { id: string; name: string }[]).forEach((a) =>
    accountMap.set(a.id, a.name),
  );

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, type, account_id, to_account_id, amount, main_category, sub_category, description, savings_pct, savings_amount, net_amount, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const rows = (data ?? []) as Omit<Transaction, "account_name" | "to_account_name">[];
  return rows.map((r) => ({
    ...r,
    account_name: accountMap.get(r.account_id) ?? "—",
    to_account_name: r.to_account_id ? (accountMap.get(r.to_account_id) ?? "—") : null,
  }));
}

/** Registra una transacción vía RPC atómico (actualiza saldo + calcula ahorro). */
export async function recordTransaction(input: {
  type: TransactionType;
  account_id: string;
  amount: number;
  description: string;
  to_account_id?: string | null;
  main_category?: IncomeMainCategory | null;
  sub_category?: string | null;
  savings_pct?: number;
}): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data, error } = await supabase.rpc("record_transaction", {
    p_type: input.type,
    p_account_id: input.account_id,
    p_amount: input.amount,
    p_description: input.description,
    p_to_account_id: input.to_account_id ?? null,
    p_main_category: input.main_category ?? null,
    p_sub_category: input.sub_category ?? null,
    p_savings_pct: input.savings_pct ?? 0,
  } as never);

  if (error) throw error;
  return data as string;
}

/** Trae todas las deudas del usuario. */
export async function getDebts(): Promise<Debt[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("debts")
    .select(
      "id, person, amount, reason, direction, status, settled_at, created_at",
    )
    .eq("user_id", user.id)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Debt[];
}

/** Crea una nueva deuda. */
export async function createDebt(input: {
  person: string;
  amount: number;
  reason?: string;
  direction: DebtDirection;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.from("debts").insert(
    {
      user_id: user.id,
      person: input.person,
      amount: input.amount,
      reason: input.reason ?? "",
      direction: input.direction,
    } as never,
  );

  if (error) throw error;
}

/** Marca una deuda como pagada / pendiente. */
export async function toggleDebtStatus(
  id: string,
  status: DebtStatus,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("debts")
    .update({
      status,
      settled_at: status === "pagado" ? new Date().toISOString() : null,
    } as never)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/** Elimina una deuda. */
export async function deleteDebt(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/** Calcula totales para el resumen. */
export async function getFinanceSummary(): Promise<{
  totalBalance: number;
  totalSavings: number;
  debtsOwed: number;
  debtsOwedToMe: number;
}> {
  const [accounts, debts] = await Promise.all([
    getAccounts(),
    getDebts(),
  ]);

  const totalBalance = accounts
    .filter((a) => a.kind !== "ahorros")
    .reduce((sum, a) => sum + a.balance, 0);

  const totalSavings = accounts
    .filter((a) => a.kind === "ahorros")
    .reduce((sum, a) => sum + a.balance, 0);

  const debtsOwed = debts
    .filter((d) => d.direction === "debo" && d.status === "pendiente")
    .reduce((sum, d) => sum + d.amount, 0);

  const debtsOwedToMe = debts
    .filter((d) => d.direction === "me_deben" && d.status === "pendiente")
    .reduce((sum, d) => sum + d.amount, 0);

  return { totalBalance, totalSavings, debtsOwed, debtsOwedToMe };
}
