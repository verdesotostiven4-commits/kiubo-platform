import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveBudget,
  getShoppingItems,
  getCategoryExpenses,
  getExtraExpenses,
} from "@/features/pantry/queries";
import { PantryView } from "@/features/pantry/PantryView";

export default async function PantryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [budget, shoppingItems, categoryExpenses, extraExpenses] =
    await Promise.all([
      getActiveBudget(),
      getShoppingItems(),
      getCategoryExpenses(),
      getExtraExpenses(),
    ]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Despensa</h1>
        <p className="text-sm text-lila-500 mt-1">
          Presupuesto semanal, lista de compras y gastos.
        </p>
      </div>

      <PantryView
        budget={budget}
        shoppingItems={shoppingItems}
        categoryExpenses={categoryExpenses}
        extraExpenses={extraExpenses}
      />
    </main>
  );
}
