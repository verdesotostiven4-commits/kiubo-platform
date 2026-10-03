"use client";

import { BudgetOverview } from "./components/BudgetOverview";
import { ShoppingList } from "./components/ShoppingList";
import { ExtraExpenses } from "./components/ExtraExpenses";
import type {
  PantryBudget,
  ShoppingItem,
  CategoryExpense,
  ExtraExpense,
} from "./queries";

interface PantryViewProps {
  budget: PantryBudget | null;
  shoppingItems: ShoppingItem[];
  categoryExpenses: CategoryExpense[];
  extraExpenses: ExtraExpense[];
}

export function PantryView({
  budget,
  shoppingItems,
  categoryExpenses,
  extraExpenses,
}: PantryViewProps) {
  const extraTotal = extraExpenses.reduce((s, e) => s + e.cost, 0);

  return (
    <div className="space-y-4">
      <BudgetOverview
        budget={budget}
        expenses={categoryExpenses}
        extraTotal={extraTotal}
      />
      <ShoppingList initialItems={shoppingItems} />
      <ExtraExpenses initialExpenses={extraExpenses} />
    </div>
  );
}
