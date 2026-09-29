import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");
const component = read("components/DashboardSalesExplorer.tsx");
const styles = read("app/experience-v18.css");

for (const needle of [
  'createPortal(',
  'document.body',
  'role="dialog"',
  'aria-modal="true"',
  'event.key === "Escape"',
  'event.key === "Tab"',
  'document.body.style.overflow = "hidden"',
  'onPointerEnter={() => setHoveredKey(point.key)}',
  'onFocus={() => setFocusedKey(point.key)}',
  'dashboard-area-tooltip',
  'Ticket promedio',
]) {
  assert.ok(component.includes(needle), `dashboard sales explorer guard missing: ${needle}`);
}

for (const needle of [
  'body>.dashboard-drilldown-backdrop',
  'position:fixed!important',
  'z-index:12000!important',
  '.dashboard-area-guide',
  '.dashboard-area-halo',
  '@media(max-width:640px)',
  '@media(prefers-reduced-motion:reduce)',
]) {
  assert.ok(styles.includes(needle), `dashboard sales explorer style guard missing: ${needle}`);
}

console.log("✓ Dashboard sales explorer passed: global dialog, hover preview, keyboard access and responsive layout are guarded.");
