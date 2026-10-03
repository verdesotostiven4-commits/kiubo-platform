"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SaleRecord } from "@/lib/local-store";
import { parseOperationalItemName } from "@/lib/sale-adjustments";
import { businessTimeLabel } from "@/lib/business-time";

const money = (value: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value || 0);

const paymentLabel: Record<SaleRecord["payment"], string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  mixed: "Mixto",
  partial: "Pago parcial",
  credit: "Fiado",
};

type ChartPoint = { key: string; label: string; total: number; sales: SaleRecord[] };
type FocusableElement = Element & { focus: () => void };

export function DashboardSalesExplorer({
  chart,
  total,
  trend,
  periodLabel,
  timeZone,
}: {
  chart: ChartPoint[];
  total: number;
  trend: number;
  periodLabel: string;
  timeZone: string;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [hoveredKey, setHoveredKey] = useState("");
  const [focusedKey, setFocusedKey] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<FocusableElement | null>(null);
  const titleId = useId();
  const gradientId = useId().replaceAll(":", "");

  const selected = chart.find((point) => point.key === selectedKey);
  const previewKey = focusedKey || hoveredKey;
  const preview = chart.find((point) => point.key === previewKey);
  const previewIndex = preview ? chart.findIndex((point) => point.key === preview.key) : -1;
  const max = Math.max(1, ...chart.map((point) => point.total));
  const width = 700;
  const baseline = 195;
  const top = 35;
  const range = baseline - top;
  const xFor = (index: number) => (chart.length <= 1 ? width / 2 : 20 + (index * (width - 40)) / (chart.length - 1));
  const yFor = (value: number) => baseline - (Math.max(0, value) / max) * range;
  const linePoints = chart.map((point, index) => `${xFor(index)},${yFor(point.total)}`).join(" ");
  const areaPoints = chart.length
    ? `20,${baseline} ${linePoints} ${width - 20},${baseline}`
    : `20,${baseline} ${width - 20},${baseline}`;

  const openDetail = (key: string) => {
    const activeElement = document.activeElement;
    triggerRef.current = activeElement && "focus" in activeElement ? activeElement as FocusableElement : null;
    setSelectedKey(key);
  };

  const closeDetail = () => setSelectedKey("");

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      triggerRef.current?.focus();
    };
  }, [selected]);

  const modal = portalReady && selected
    ? createPortal(
        <div className="dashboard-drilldown-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDetail();
        }}>
          <section ref={dialogRef} className="dashboard-drilldown" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button ref={closeButtonRef} className="dashboard-drilldown-close" type="button" onClick={closeDetail} aria-label="Cerrar detalle">×</button>
            <div className="dashboard-drilldown-title">
              <span>DETALLE DEL MOVIMIENTO</span>
              <h3 id={titleId}>{selected.label}</h3>
              <p>Ventas registradas en este momento del período.</p>
            </div>
            <div className="dashboard-drilldown-stats">
              <div><span>Total vendido</span><strong>{money(selected.total)}</strong></div>
              <div><span>Ventas</span><strong>{selected.sales.length}</strong></div>
              <div><span>Ticket promedio</span><strong>{money(selected.sales.length ? selected.total / selected.sales.length : 0)}</strong></div>
            </div>
            {selected.sales.length ? (
              <div className="dashboard-drilldown-list">
                {[...selected.sales]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 12)
                  .map((sale) => (
                    <article key={sale.id}>
                      <div>
                        <strong>{businessTimeLabel(sale.createdAt,timeZone)}</strong>
                        <span>{paymentLabel[sale.payment]}</span>
                      </div>
                      <b>{money(sale.total)}</b>
                      <small>
                        {sale.items.slice(0, 4).map((item) => `${item.qty}× ${parseOperationalItemName(item.name).displayName}`).join(" · ")}
                        {sale.items.length > 4 ? ` · +${sale.items.length - 4}` : ""}
                      </small>
                    </article>
                  ))}
                {selected.sales.length > 12 && <small className="dashboard-drilldown-more">Mostrando las 12 ventas más recientes de {selected.sales.length}.</small>}
              </div>
            ) : (
              <div className="dashboard-drilldown-empty">No hubo ventas en este momento.</div>
            )}
            <footer className="dashboard-drilldown-actions">
              <span>Presiona Esc o toca fuera para cerrar.</span>
              <Link href="/reports" onClick={closeDetail}>Ver reporte completo ↗</Link>
            </footer>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <article className="ref-white-card ref-week-chart dashboard-chart-card dashboard-area-explorer">
      <div className="ref-card-title dashboard-area-head">
        <div><span>Movimiento de ventas</span><small>{periodLabel}</small></div>
        <Link href="/reports">Abrir reporte ↗</Link>
      </div>
      <div className="dashboard-chart-total">
        <strong>{money(total)}</strong>
        <span className={trend >= 0 ? "up" : "down"}>{trend >= 0 ? "↗" : "↘"} {Math.abs(trend).toFixed(0)}%</span>
      </div>
      <div className="ref-svg-chart dashboard-area-chart">
        <div className="dashboard-area-plot" onPointerLeave={() => setHoveredKey("")}>
          <svg viewBox="0 0 700 210" preserveAspectRatio="none" role="img" aria-label={`Ventas · ${periodLabel}`}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#58a985" stopOpacity=".36" />
                <stop offset="1" stopColor="#58a985" stopOpacity=".03" />
              </linearGradient>
            </defs>
            <line x1="20" x2="680" y1={baseline} y2={baseline} className="dashboard-area-baseline" />
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />
            {chart.length > 1 && <polyline points={linePoints} className="dashboard-area-line" />}
            {preview && previewIndex >= 0 && <line x1={xFor(previewIndex)} x2={xFor(previewIndex)} y1={top - 4} y2={baseline} className="dashboard-area-guide" />}
            {chart.map((point, index) => {
              const x = xFor(index);
              const y = yFor(point.total);
              const active = previewKey === point.key;
              return (
                <g
                  key={point.key}
                  className={`dashboard-area-point ${active ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${point.label}: ${money(point.total)}, ${point.sales.length} ${point.sales.length === 1 ? "venta" : "ventas"}. Abrir detalle.`}
                  onPointerEnter={() => setHoveredKey(point.key)}
                  onFocus={() => setFocusedKey(point.key)}
                  onBlur={() => setFocusedKey("")}
                  onClick={() => openDetail(point.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openDetail(point.key);
                    }
                  }}
                >
                  {active && <circle className="dashboard-area-halo" cx={x} cy={y} r="13" />}
                  <circle className="dashboard-area-hit" cx={x} cy={y} r="22" />
                  <circle className="dashboard-area-dot" cx={x} cy={y} r={active ? 7 : 5} />
                  {point.total > 0 && <text x={x} y={Math.max(18, y - 12)} textAnchor="middle" className="dashboard-area-value">{money(point.total)}</text>}
                </g>
              );
            })}
          </svg>
          {preview && previewIndex >= 0 && (
            <div
              className={`dashboard-area-tooltip ${previewIndex === 0 ? "edge-left" : previewIndex === chart.length - 1 ? "edge-right" : ""}`}
              style={{ left: `${(xFor(previewIndex) / width) * 100}%`, top: `${(yFor(preview.total) / 210) * 100}%` }}
              role="status"
            >
              <span>{preview.label}</span>
              <strong>{money(preview.total)}</strong>
              <small>{preview.sales.length} {preview.sales.length === 1 ? "venta" : "ventas"} · clic para ver detalle</small>
            </div>
          )}
        </div>
        <div className="ref-chart-labels dashboard-chart-labels">
          {chart.map((point) => (
            <button
              key={point.key}
              type="button"
              className={previewKey === point.key ? "active" : ""}
              onPointerEnter={() => setHoveredKey(point.key)}
              onPointerLeave={() => setHoveredKey("")}
              onFocus={() => setFocusedKey(point.key)}
              onBlur={() => setFocusedKey("")}
              onClick={() => openDetail(point.key)}
            >
              {point.label}
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-area-foot">
        <span>Pasa el cursor para explorar · pulsa un punto para abrir el detalle.</span>
        <Link href="/reports">Reporte completo ↗</Link>
      </div>
      {modal}
    </article>
  );
}
