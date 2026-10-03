"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/config/finance";
import { PANTRY_CATEGORIES } from "@/config/finance";
import type { PantryBudget, CategoryExpense } from "@/features/pantry/queries";
import type { PantryCategory } from "@/types/domain";

interface BudgetOverviewProps {
  budget: PantryBudget | null;
  expenses: CategoryExpense[];
  extraTotal: number;
}

export function BudgetOverview({
  budget,
  expenses,
  extraTotal,
}: BudgetOverviewProps) {
  if (!budget) {
    return (
      <Card>
        <CardBody className="text-center py-6">
          <p className="text-sm text-lila-400">
            Sin presupuesto de despensa activo. El presupuesto inicial de{" "}
            {formatCurrency(50)} para 3 semanas se crea automáticamente al
            registrar tu cuenta.
          </p>
        </CardBody>
      </Card>
    );
  }

  const totalBudget = budget.budget;
  const spent = expenses.reduce((s, e) => s + e.amount, 0) + extraTotal;
  const remaining = totalBudget - spent;
  const pct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;

  const expenseMap = new Map<PantryCategory, number>();
  expenses.forEach((e) => expenseMap.set(e.category, e.amount));

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-lila-900">
            Presupuesto de despensa
          </h3>
          <span className="text-xs text-lila-400">
            {budget.weeks} semana{budget.weeks === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-lila-400">
              Total
            </p>
            <p className="text-base font-bold text-lila-950">
              {formatCurrency(totalBudget)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-lila-400">
              Gastado
            </p>
            <p className="text-base font-bold text-rose-500">
              {formatCurrency(spent)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-lila-400">
              Restante
            </p>
            <p
              className={`text-base font-bold ${
                remaining >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>

        <ProgressBar
          value={pct}
          tone={pct > 90 ? "rose" : pct > 70 ? "amber" : "emerald"}
          className="mb-4"
        />

        {/* Gastos por categoría */}
        <div className="space-y-2">
          {PANTRY_CATEGORIES.map((cat) => {
            const amount = expenseMap.get(cat) ?? 0;
            const catPct =
              totalBudget > 0 ? Math.min(100, (amount / totalBudget) * 100) : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-lila-600">{cat}</span>
                  <span className="text-xs font-medium text-lila-700">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <ProgressBar value={catPct} tone="lavender" className="h-1" />
              </div>
            );
          })}
        </div>

        {extraTotal > 0 && (
          <div className="mt-3 pt-2 border-t border-lila-100 flex items-center justify-between">
            <span className="text-xs text-lila-500">Gastos extra</span>
            <span className="text-xs font-medium text-lila-700">
              {formatCurrency(extraTotal)}
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
