"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { Account } from "@/features/finance/queries";
import {
  INCOME_MAIN_CATEGORIES,
  INCOME_SUB_CATEGORIES,
  SAVINGS_PRESETS,
} from "@/config/finance";
import { formatCurrency } from "@/config/finance";
import type { TransactionType, IncomeMainCategory } from "@/types/domain";

interface TransactionFormProps {
  open: boolean;
  accounts: Account[];
  onClose: () => void;
  onSave: (input: {
    type: TransactionType;
    account_id: string;
    amount: number;
    description: string;
    to_account_id?: string | null;
    main_category?: IncomeMainCategory | null;
    sub_category?: string | null;
    savings_pct?: number;
  }) => void;
  loading?: boolean;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "ingreso", label: "Ingreso" },
  { value: "gasto", label: "Gasto" },
  { value: "retiro", label: "Retiro (transferir a ahorros)" },
];

export function TransactionForm({
  open,
  accounts,
  onClose,
  onSave,
  loading,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>("ingreso");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [savingsPct, setSavingsPct] = useState<number>(0);

  useEffect(() => {
    if (open && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [open, accounts, accountId]);

  // Reset sub-category cuando cambia main category.
  useEffect(() => {
    setSubCategory("");
  }, [mainCategory]);

  const isIncome = type === "ingreso";
  const isRetiro = type === "retiro";

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));

  const toAccountOptions = accounts
    .filter((a) => a.kind === "ahorros" && a.id !== accountId)
    .map((a) => ({ value: a.id, label: a.name }));

  const subOptions = mainCategory
    ? INCOME_SUB_CATEGORIES[mainCategory as IncomeMainCategory].map((s) => ({
        value: s,
        label: s,
      }))
    : [];

  const numericAmount = parseFloat(amount) || 0;
  const savingsAmount = (numericAmount * savingsPct) / 100;
  const netAmount = numericAmount - savingsAmount;

  const handleSave = () => {
    if (!accountId || numericAmount <= 0 || !description.trim()) return;
    onSave({
      type,
      account_id: accountId,
      amount: numericAmount,
      description: description.trim(),
      to_account_id: isRetiro && toAccountId ? toAccountId : null,
      main_category: isIncome && mainCategory ? (mainCategory as IncomeMainCategory) : null,
      sub_category: isIncome && subCategory ? subCategory : null,
      savings_pct: isIncome ? savingsPct : 0,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva transacción"
    >
      <div className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Tipo
          </label>
          <Select
            value={type}
            options={TYPE_OPTIONS}
            onChange={(v) => setType(v as TransactionType)}
          />
        </div>

        {/* Cuenta origen */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            {isRetiro ? "Cuenta origen" : "Cuenta"}
          </label>
          <Select
            value={accountId}
            options={accountOptions}
            onChange={setAccountId}
          />
        </div>

        {/* Cuenta destino (solo retiro) */}
        {isRetiro && (
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Transferir a (ahorros)
            </label>
            <Select
              value={toAccountId}
              options={toAccountOptions}
              onChange={setToAccountId}
              placeholder="Selecciona cuenta de ahorros…"
            />
          </div>
        )}

        {/* Monto */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Monto (USD)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-xs font-medium text-lila-600 mb-1.5">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿De qué se trata?"
            className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
          />
        </div>

        {/* Categoría (solo ingreso) */}
        {isIncome && (
          <>
            <div>
              <label className="block text-xs font-medium text-lila-600 mb-1.5">
                Categoría de ingreso
              </label>
              <Select
                value={mainCategory}
                options={INCOME_MAIN_CATEGORIES.map((c) => ({
                  value: c,
                  label: c,
                }))}
                onChange={setMainCategory}
                placeholder="Selecciona categoría…"
              />
            </div>
            {subOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-lila-600 mb-1.5">
                  Sub-categoría
                </label>
                <Select
                  value={subCategory}
                  options={subOptions}
                  onChange={setSubCategory}
                  placeholder="Selecciona…"
                />
              </div>
            )}
            {/* Presets de ahorro */}
            <div>
              <label className="block text-xs font-medium text-lila-600 mb-1.5">
                Ahorro ({savingsPct}%)
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {SAVINGS_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setSavingsPct(pct)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      savingsPct === pct
                        ? "bg-amber-500 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              {numericAmount > 0 && (
                <p className="text-[10px] text-lila-400 mt-1.5">
                  Ahorro: {formatCurrency(savingsAmount)} · Neto:{" "}
                  {formatCurrency(netAmount)}
                </p>
              )}
            </div>
          </>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={
              !accountId || numericAmount <= 0 || !description.trim() || loading
            }
          >
            {loading ? "Guardando…" : "Registrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
