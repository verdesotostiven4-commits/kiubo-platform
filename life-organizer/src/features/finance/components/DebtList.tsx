"use client";

import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { Debt } from "@/features/finance/queries";
import {
  createDebt,
  toggleDebtStatus,
  deleteDebt,
} from "@/features/finance/queries";
import { formatCurrency } from "@/config/finance";
import { cn } from "@/lib/utils";
import type { DebtDirection } from "@/types/domain";

interface DebtListProps {
  initialDebts: Debt[];
}

const DIRECTION_OPTIONS = [
  { value: "debo", label: "Yo debo" },
  { value: "me_deben", label: "Me deben" },
];

export function DebtList({ initialDebts }: DebtListProps) {
  const [debts, setDebts] = useState(initialDebts);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<DebtDirection>("debo");
  const [loading, setLoading] = useState(false);

  const pendientes = debts.filter((d) => d.status === "pendiente");
  const settled = debts.filter((d) => d.status === "pagado");

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!person.trim() || num <= 0) return;

    // 1. Inserción optimista inmediata.
    const tempId = `temp-${Date.now()}`;
    const optimisticDebt: Debt = {
      id: tempId,
      person: person.trim(),
      amount: num,
      reason: reason.trim(),
      direction,
      status: "pendiente",
      settled_at: null,
      created_at: new Date().toISOString(),
    };
    setDebts((prev) => [optimisticDebt, ...prev]);
    setOpen(false);
    setPerson("");
    setAmount("");
    setReason("");

    // 2. Sincronizar con Supabase; rollback si falla.
    setLoading(true);
    try {
      await createDebt({
        person: optimisticDebt.person,
        amount: num,
        reason: optimisticDebt.reason,
        direction,
      });
    } catch (err) {
      console.error("Error al crear deuda:", err);
      setDebts((prev) => prev.filter((d) => d.id !== tempId));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, current: "pendiente" | "pagado") => {
    const newStatus = current === "pendiente" ? "pagado" : "pendiente";
    const prevDebt = debts.find((d) => d.id === id);
    setDebts((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              status: newStatus,
              settled_at:
                newStatus === "pagado" ? new Date().toISOString() : null,
            }
          : d,
      ),
    );
    try {
      await toggleDebtStatus(id, newStatus);
    } catch {
      if (prevDebt) {
        setDebts((prev) =>
          prev.map((d) => (d.id === id ? prevDebt : d)),
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    const backup = debts.find((d) => d.id === id);
    setDebts((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDebt(id);
    } catch {
      if (backup) setDebts((prev) => [backup, ...prev]);
    }
  };

  const renderDebt = (debt: Debt) => (
    <div
      key={debt.id}
      className={cn(
        "flex items-center gap-3 py-2 px-1 rounded-lg transition-colors",
        debt.status === "pagado" && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => handleToggle(debt.id, debt.status)}
        className="shrink-0"
        title={debt.status === "pagado" ? "Marcar pendiente" : "Marcar pagado"}
      >
        {debt.status === "pagado" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <Circle className="h-5 w-5 text-lila-300 hover:text-lavanda-400" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            debt.status === "pagado"
              ? "text-lila-400 line-through"
              : "text-lila-900",
          )}
        >
          {debt.person}
        </p>
        {debt.reason && (
          <p className="text-[10px] text-lila-400 truncate">{debt.reason}</p>
        )}
        <span
          className={cn(
            "text-[10px] font-medium",
            debt.direction === "debo" ? "text-rose-500" : "text-emerald-600",
          )}
        >
          {debt.direction === "debo" ? "Yo debo" : "Me deben"}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-bold shrink-0",
          debt.direction === "debo" ? "text-rose-500" : "text-emerald-600",
        )}
      >
        {formatCurrency(debt.amount)}
      </p>
      <button
        type="button"
        onClick={() => handleDelete(debt.id)}
        className="p-1.5 rounded-lg text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-lila-900">Deudas</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </div>

      {debts.length === 0 ? (
        <p className="text-xs text-lila-400 text-center py-4">
          Sin deudas registradas.
        </p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-lila-400 mb-1">
                Pendientes
              </p>
              {pendientes.map(renderDebt)}
            </div>
          )}
          {settled.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-lila-400 mb-1">
                Saldadas
              </p>
              {settled.map(renderDebt)}
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva deuda">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Persona
            </label>
            <input
              type="text"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="¿Con quién?"
              autoFocus
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Dirección
            </label>
            <Select
              value={direction}
              options={DIRECTION_OPTIONS}
              onChange={(v) => setDirection(v as DebtDirection)}
            />
          </div>
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
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-lila-600 mb-1.5">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="¿Por qué?"
              className="w-full h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={!person.trim() || !parseFloat(amount) || loading}
            >
              {loading ? "Guardando…" : "Crear"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
