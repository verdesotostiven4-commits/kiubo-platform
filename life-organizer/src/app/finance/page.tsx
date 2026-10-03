import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAccounts,
  getRecentTransactions,
  getDebts,
  getFinanceSummary,
} from "@/features/finance/queries";
import { FinanceView } from "@/features/finance/FinanceView";

export default async function FinancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [accounts, transactions, debts, summary] = await Promise.all([
    getAccounts(),
    getRecentTransactions(),
    getDebts(),
    getFinanceSummary(),
  ]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Finanzas</h1>
        <p className="text-sm text-lila-500 mt-1">
          Cuentas, ingresos, gastos, ahorros y deudas.
        </p>
      </div>

      <FinanceView
        accounts={accounts}
        transactions={transactions}
        debts={debts}
        summary={summary}
      />
    </main>
  );
}
