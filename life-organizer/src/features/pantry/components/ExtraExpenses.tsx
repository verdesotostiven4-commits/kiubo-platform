"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type { ExtraExpense } from "@/features/pantry/queries";
import {
  addExtraExpense,
  deleteExtraExpense,
} from "@/features/pantry/queries";
import { formatCurrency } from "@/config/finance";
import { formatShort, toISODate } from "@/lib/dates";

interface ExtraExpensesProps {
  initialExpenses: ExtraExpense[];
}

export function ExtraExpenses({ initialExpenses }: ExtraExpensesProps) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");

  const handleAdd = async () => {
    const num = parseFloat(cost);
    if (!name.trim() || num <= 0) return;

    // 1. Inserción optimista inmediata.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ExtraExpense = {
      id: tempId,
      name: name.trim(),
      cost: num,
      expense_date: toISODate(),
      created_at: new Date().toISOString(),
    };
    setExpenses((prev) => [optimistic, ...prev]);
    setName("");
    setCost("");

    // 2. Sincronizar con Supabase en segundo plano; rollback si falla.
    try {
      await addExtraExpense({ name: optimistic.name, cost: num });
    } catch (err) {
      console.error("Error al registrar gasto extra:", err);
      setExpenses((prev) => prev.filter((e) => e.id !== tempId));
    }
  };

  const handleDelete = async (id: string) => {
    const backup = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteExtraExpense(id);
    } catch (err) {
      console.error("Error al borrar gasto extra:", err);
      if (backup) {
        setExpenses((prev) =>
          [...prev, backup].sort((a, b) =>
            b.expense_date.localeCompare(a.expense_date),
          ),
        );
      }
    }
  };

  const total = expenses.reduce((s, e) => s + e.cost, 0);

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-lila-900">
            Gastos extra
          </h3>
          {total > 0 && (
            <span className="text-xs font-bold text-rose-500">
              {formatCurrency(total)}
            </span>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="¿Qué fue?"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            className="w-20 h-10 px-2 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
          />
          <Button
            size="icon"
            onClick={handleAdd}
            disabled={!name.trim() || !parseFloat(cost)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Lista */}
        {expenses.length === 0 ? (
          <p className="text-sm text-lila-400 text-center py-4">
            Sin gastos extra registrados.
          </p>
        ) : (
          <div className="space-y-1">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-lila-50/50 transition-colors"
              >
                <span className="flex-1 text-sm text-lila-900 truncate">
                  {exp.name}
                </span>
                <span className="text-[10px] text-lila-400">
                  {formatShort(exp.expense_date)}
                </span>
                <span className="text-sm font-medium text-rose-500">
                  {formatCurrency(exp.cost)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  className="p-1 rounded text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
