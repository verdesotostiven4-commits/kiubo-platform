"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f5f8f6", color: "#183d31", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "min(480px, 100%)", padding: 28, border: "1px solid #dfe8e3", borderRadius: 20, background: "#fff" }}>
            <strong style={{ display: "block", fontSize: 20 }}>KIUBO necesita recargar</strong>
            <p style={{ color: "#61736a", lineHeight: 1.5 }}>La aplicación no pudo cargar esta versión. Los datos guardados permanecen protegidos.</p>
            <button type="button" onClick={() => reset()} style={{ border: 0, borderRadius: 10, padding: "11px 16px", background: "#176a4a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Recargar</button>
          </section>
        </main>
      </body>
    </html>
  );
}
