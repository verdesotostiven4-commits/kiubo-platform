"use client";

import { useState } from "react";
import { Plus, Wallet, PiggyBank } from "lucide-react";
import type {
  Account,
  Transaction,
  Debt,
} from "@/features/finance/queries";
import { recordTransaction } from "@/features/finance/queries";
import { AccountCard } from "./components/AccountCard";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionList } from "./components/TransactionList";
import { DebtList } from "./components/DebtList";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { formatCurrency } from "@/config/finance";
import type { TransactionType, IncomeMainCategory } from "@/types/domain";

interface FinanceViewProps {
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  summary: {
    totalBalance: number;
    totalSavings: number;
    debtsOwed: number;
    debtsOwedToMe: number;
  };
}

export function FinanceView({
  accounts: initialAccounts,
  transactions: initialTransactions,
  debts,
  summary: initialSummary,
}: FinanceViewProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [summary, setSummary] = useState(initialSummary);
  const [formOpen, setFormOpen] = useState(false);

  const handleSave = async (input: {
    type: TransactionType;
    account_id: string;
    amount: number;
    description: string;
    to_account_id?: string | null;
    main_category?: IncomeMainCategory | null;
    sub_category?: string | null;
    savings_pct?: number;
  }) => {
    // Backup para rollback.
    const prevAccounts = [...accounts];
    const prevSummary = { ...summary };
    const prevTransactions = [...transactions];

    const account = accounts.find((a) => a.id === input.account_id);
    const toAccount = input.to_account_id
      ? accounts.find((a) => a.id === input.to_account_id)
      : null;

    const savingsPct = input.savings_pct ?? 0;
    const savingsAmount =
      input.type === "ingreso" && savingsPct > 0
        ? (input.amount * savingsPct) / 100
        : 0;
    const netAmount = input.amount - savingsAmount;

    // 1. Transacción optimista.
    const tempId = `temp-${Date.now()}`;
    const optimisticTx: Transaction = {
      id: tempId,
      type: input.type,
      account_id: input.account_id,
      account_name: account?.name ?? "—",
      to_account_id: input.to_account_id ?? null,
      to_account_name: toAccount?.name ?? null,
      amount: input.amount,
      main_category: input.main_category ?? null,
      sub_category: input.sub_category ?? null,
      description: input.description,
      savings_pct: savingsPct,
      savings_amount: savingsAmount,
      net_amount: netAmount,
      created_at: new Date().toISOString(),
    };

    setTransactions((prev) => [optimisticTx, ...prev]);

    // 2. Actualizar saldos de cuentas localmente.
    setAccounts((prev) =>
      prev.map((a) => {
        let balance = a.balance;
        if (a.id === input.account_id) {
          if (input.type === "ingreso") balance += input.amount;
          else balance -= input.amount;
        }
        if (input.to_account_id && a.id === input.to_account_id) {
          if (input.type === "retiro") balance += input.amount;
        }
        return { ...a, balance };
      }),
    );

    // 3. Actualizar resumen local.
    setSummary((prev) => {
      let totalBalance = prev.totalBalance;
      let totalSavings = prev.totalSavings;
      if (input.type === "ingreso") {
        totalBalance += input.amount;
        if (savingsAmount > 0) {
          totalSavings += savingsAmount;
          totalBalance -= savingsAmount;
        }
      } else if (input.type === "gasto") {
        totalBalance -= input.amount;
      } else if (input.type === "retiro") {
        totalBalance -= input.amount;
        totalSavings += input.amount;
      }
      return { ...prev, totalBalance, totalSavings };
    });

    // 4. Cerrar formulario instantáneamente.
    setFormOpen(false);

    // 5. Sincronizar con Supabase en segundo plano.
    try {
      const realId = await recordTransaction(input);
      setTransactions((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t)),
      );
    } catch (err) {
      console.error("Error al registrar transacción:", err);
      setTransactions(prevTransactions);
      setAccounts(prevAccounts);
      setSummary(prevSummary);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardBody className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-lavanda-600" />
              <span className="text-xs text-lila-500">Saldo disponible</span>
            </div>
            <p className="text-lg font-bold text-lila-950">
              {formatCurrency(summary.totalBalance)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-lila-500">Ahorros</span>
            </div>
            <p className="text-lg font-bold text-amber-700">
              {formatCurrency(summary.totalSavings)}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Deudas resumidas */}
      {(summary.debtsOwed > 0 || summary.debtsOwedToMe > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {summary.debtsOwed > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2">
              <p className="text-xs text-rose-500">Debo</p>
              <p className="text-sm font-bold text-rose-600">
                {formatCurrency(summary.debtsOwed)}
              </p>
            </div>
          )}
          {summary.debtsOwedToMe > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
              <p className="text-xs text-emerald-600">Me deben</p>
              <p className="text-sm font-bold text-emerald-700">
                {formatCurrency(summary.debtsOwedToMe)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cuentas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-lila-900">Cuentas</h2>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Transacción
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      </div>

      {/* Transacciones recientes */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-lila-900 mb-3">
            Movimientos recientes
          </h3>
          <TransactionList transactions={transactions} />
        </CardBody>
      </Card>

      {/* Deudas */}
      <Card>
        <CardBody>
          <DebtList initialDebts={debts} />
        </CardBody>
      </Card>

      <TransactionForm
        open={formOpen}
        accounts={accounts}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        loading={false}
      />
    </div>
  );
}
