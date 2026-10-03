"use client";

import type { Account } from "@/features/finance/queries";
import { ACCOUNT_KIND_LABELS } from "@/config/finance";
import { formatCurrency } from "@/config/finance";
import { cn } from "@/lib/utils";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const meta = ACCOUNT_KIND_LABELS[account.kind];

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all",
        account.kind === "ahorros"
          ? "border-amber-200 bg-amber-50/50"
          : "border-lila-100 bg-white",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{meta.emoji}</span>
          <span className="text-xs font-medium text-lila-700">
            {account.name}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-lila-400">
          {meta.label}
        </span>
      </div>
      <p
        className={cn(
          "text-lg font-bold",
          account.balance >= 0 ? "text-lila-950" : "text-rose-600",
        )}
      >
        {formatCurrency(account.balance)}
      </p>
      {account.note && (
        <p className="text-[10px] text-lila-400 mt-0.5 truncate">
          {account.note}
        </p>
      )}
    </div>
  );
}
