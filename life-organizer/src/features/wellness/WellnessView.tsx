"use client";

import { WaterTracker } from "./components/WaterTracker";
import { WorkoutSection } from "./components/WorkoutSection";
import type { WorkoutLog } from "./queries";

interface WellnessViewProps {
  todayCups: number;
  workouts: WorkoutLog[];
}

export function WellnessView({ todayCups, workouts }: WellnessViewProps) {
  return (
    <div className="space-y-4">
      <WaterTracker initialCups={todayCups} />
      <WorkoutSection initialWorkouts={workouts} />
    </div>
  );
}
