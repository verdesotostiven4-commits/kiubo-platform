"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import type { ShoppingItem } from "@/features/pantry/queries";
import {
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
} from "@/features/pantry/queries";
import { PANTRY_CATEGORIES } from "@/config/finance";
import { cn } from "@/lib/utils";
import type { PantryCategory } from "@/types/domain";

interface ShoppingListProps {
  initialItems: ShoppingItem[];
}

const CATEGORY_OPTIONS = PANTRY_CATEGORIES.map((c) => ({
  value: c,
  label: c,
}));

const CATEGORY_DOT: Record<PantryCategory, string> = {
  Frutas: "bg-rose-400",
  Verduras: "bg-emerald-400",
  Proteína: "bg-amber-400",
  "Granos secos": "bg-lavanda-400",
  Lácteos: "bg-sky-400",
};

export function ShoppingList({ initialItems }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PantryCategory>("Frutas");

  const handleAdd = async () => {
    if (!name.trim()) return;
    const tempItem: ShoppingItem = {
      id: `temp-${Date.now()}`,
      name: name.trim(),
      category,
      checked: false,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [tempItem, ...prev]);
    setName("");
    try {
      await addShoppingItem({ name: tempItem.name, category });
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
    }
  };

  const handleToggle = async (id: string, checked: boolean) => {
    const prev = items.find((i) => i.id === id);
    setItems((prevItems) =>
      prevItems.map((i) => (i.id === id ? { ...i, checked } : i)),
    );
    try {
      await toggleShoppingItem(id, checked);
    } catch {
      if (prev) {
        setItems((prevItems) =>
          prevItems.map((i) => (i.id === id ? { ...i, checked: prev.checked } : i)),
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    const backup = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteShoppingItem(id);
    } catch {
      if (backup) setItems((prev) => [backup, ...prev]);
    }
  };

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-lila-900 mb-3">
          Lista de compras
        </h3>

        {/* Input + select */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="¿Qué comprar?"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 h-10 px-3 rounded-xl border border-lila-200 text-sm text-lila-900 placeholder:text-lila-300 focus:outline-none focus:ring-2 focus:ring-lavanda-400 focus:border-lavanda-400"
          />
          <div className="w-36">
            <Select
              value={category}
              options={CATEGORY_OPTIONS}
              onChange={(v) => setCategory(v as PantryCategory)}
            />
          </div>
          <Button size="icon" onClick={handleAdd} disabled={!name.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Lista */}
        {items.length === 0 ? (
          <p className="text-sm text-lila-400 text-center py-4">
            Lista vacía. Agrega lo que necesitas comprar.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors",
                  item.checked && "bg-lila-50/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item.id, !item.checked)}
                  className={cn(
                    "h-5 w-5 shrink-0 rounded-md border-2 transition-all flex items-center justify-center",
                    item.checked
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-lila-200 hover:border-lavanda-400",
                  )}
                >
                  {item.checked && <Check className="h-3 w-3 text-white" />}
                </button>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    CATEGORY_DOT[item.category],
                  )}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    item.checked
                      ? "text-lila-400 line-through"
                      : "text-lila-900",
                  )}
                >
                  {item.name}
                </span>
                <span className="text-[10px] text-lila-400 shrink-0">
                  {item.category}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1 rounded text-lila-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
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
