"use client";

import { useState } from "react";
import { Minus, Plus, Droplet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Card, CardBody } from "@/components/ui/Card";
import { WATER_GOAL_CUPS, WATER_CUP_ML } from "@/config/finance";
import { updateWaterCups } from "@/features/wellness/queries";
import { cn } from "@/lib/utils";

interface WaterTrackerProps {
  initialCups: number;
}

export function WaterTracker({ initialCups }: WaterTrackerProps) {
  const [cups, setCups] = useState(initialCups);
  const [loading, setLoading] = useState(false);
  const pct = Math.min(100, (cups / WATER_GOAL_CUPS) * 100);
  const goalReached = cups >= WATER_GOAL_CUPS;

  const handleAdd = async (delta: number) => {
    if (loading) return;
    setLoading(true);
    // Optimistic.
    setCups((c) => Math.max(0, c + delta));
    try {
      const newCups = await updateWaterCups(delta);
      setCups(newCups);
    } catch {
      // Revertir.
      setCups((c) => Math.max(0, c - delta));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplet
              className={cn(
                "h-5 w-5 transition-colors",
                goalReached ? "text-lavanda-600" : "text-lila-300",
              )}
              fill={goalReached ? "currentColor" : "none"}
            />
            <h3 className="text-sm font-semibold text-lila-900">Hidratación</h3>
          </div>
          <span className="text-xs text-lila-400">
            {cups}/{WATER_GOAL_CUPS} vasos
          </span>
        </div>

        {/* Vasos visuales */}
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: WATER_GOAL_CUPS }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (i < cups) {
                  handleAdd(-(cups - i));
                } else {
                  handleAdd(i + 1 - cups);
                }
              }}
              className="flex-1 flex flex-col items-center gap-0.5 group"
            >
              <Droplet
                className={cn(
                  "h-5 w-5 transition-all group-hover:scale-110",
                  i < cups
                    ? "text-lavanda-500"
                    : "text-lila-200",
                )}
                fill={i < cups ? "currentColor" : "none"}
              />
            </button>
          ))}
        </div>

        <ProgressBar
          value={pct}
          tone={goalReached ? "lavender" : "amber"}
          className="h-2 mb-3"
        />

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAdd(-1)}
            disabled={loading || cups === 0}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-lila-700">
            {cups * WATER_CUP_ML}ml / {WATER_GOAL_CUPS * WATER_CUP_ML}ml
          </p>
          <Button
            size="sm"
            onClick={() => handleAdd(1)}
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {goalReached && (
          <p className="text-xs text-center text-lavanda-600 font-medium mt-2">
            Meta del día cumplida.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
