"use client";

import { CloudUpload, AlertCircle, X } from "lucide-react";

export function SyncStatus({ pending = 0, error, onDismiss }: {
  pending?: number; error?: string | null; onDismiss?: () => void;
}) {
  if (error) return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{error}</span>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Cerrar aviso" className="rounded-lg p-1"><X className="size-4" /></button>}
    </div>
  );
  return (
    <div role="status" aria-live="polite" className="min-h-5 text-xs text-lila-600">
      {pending > 0 && <span className="inline-flex items-center gap-2"><CloudUpload className="size-3.5" />Guardando {pending > 1 ? `${pending} cambios` : "cambio"}… Puedes seguir aquí.</span>}
    </div>
  );
}
