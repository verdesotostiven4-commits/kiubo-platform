import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTodayWater,
  getRecentWorkouts,
} from "@/features/wellness/queries";
import { WellnessView } from "@/features/wellness/WellnessView";

export default async function WellnessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [todayWater, workouts] = await Promise.all([
    getTodayWater(),
    getRecentWorkouts(),
  ]);

  return (
    <main className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-lila-950">Bienestar</h1>
        <p className="text-sm text-lila-500 mt-1">
          Hidratación y actividad física del día.
        </p>
      </div>

      <WellnessView
        todayCups={todayWater?.cups ?? 0}
        workouts={workouts}
      />
    </main>
  );
}
