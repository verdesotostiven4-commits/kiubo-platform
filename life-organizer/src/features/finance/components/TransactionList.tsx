"use client";

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import type { Transaction } from "@/features/finance/queries";
import { formatCurrency } from "@/config/finance";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/domain";

interface TransactionListProps {
  transactions: Transaction[];
}

const TYPE_META: Record<
  TransactionType,
  { icon: typeof ArrowDownLeft; color: string; sign: string; label: string }
> = {
  ingreso: {
    icon: ArrowDownLeft,
    color: "text-emerald-600 bg-emerald-50",
    sign: "+",
    label: "Ingreso",
  },
  gasto: {
    icon: ArrowUpRight,
    color: "text-rose-500 bg-rose-50",
    sign: "-",
    label: "Gasto",
  },
  retiro: {
    icon: ArrowLeftRight,
    color: "text-amber-600 bg-amber-50",
    sign: "",
    label: "Retiro",
  },
};

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-lila-400 text-center py-6">
        Sin transacciones todavía. Registra tu primer ingreso o gasto.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {transactions.map((tx) => {
        const meta = TYPE_META[tx.type];
        const Icon = meta.icon;
        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-lila-50/50 transition-colors"
          >
            <div
              className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                meta.color,
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-lila-900 truncate">
                {tx.description}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-lila-400">
                <span>{meta.label}</span>
                <span>·</span>
                <span className="truncate">{tx.account_name}</span>
                {tx.sub_category && (
                  <>
                    <span>·</span>
                    <span className="truncate">{tx.sub_category}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={cn(
                  "text-sm font-bold",
                  tx.type === "ingreso"
                    ? "text-emerald-600"
                    : tx.type === "gasto"
                      ? "text-rose-500"
                      : "text-amber-600",
                )}
              >
                {meta.sign}
                {formatCurrency(tx.amount)}
              </p>
              {tx.savings_amount > 0 && (
                <p className="text-[10px] text-amber-600">
                  ↳ {formatCurrency(tx.savings_amount)} a ahorros
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
