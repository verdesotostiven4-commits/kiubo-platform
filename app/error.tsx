"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "kiubo.route-error-recovery.v1";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(RECOVERY_KEY) === "1") return;
      window.sessionStorage.setItem(RECOVERY_KEY, "1");
      window.location.reload();
    } catch {
      // The visible recovery action below remains available if storage is blocked.
    }
  }, []);

  const retry = () => {
    try { window.sessionStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
    reset();
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f5f8f6", color: "#183d31", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "min(480px, 100%)", padding: 28, border: "1px solid #dfe8e3", borderRadius: 20, background: "#fff", boxShadow: "0 12px 32px rgba(17,57,45,.08)" }}>
        <strong style={{ display: "block", fontSize: 20 }}>KIUBO está recuperando la pantalla</strong>
        <p style={{ margin: "10px 0 18px", color: "#61736a", lineHeight: 1.5 }}>La aplicación se encontró con un archivo antiguo o una carga interrumpida. Tus ventas y datos guardados no se borraron.</p>
        <button type="button" onClick={retry} style={{ border: 0, borderRadius: 10, padding: "11px 16px", background: "#176a4a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Reintentar KIUBO</button>
      </section>
    </main>
  );
}
