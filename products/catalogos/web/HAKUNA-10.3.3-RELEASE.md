# Hakuna Matata 10.3.3 — Panel Stability

Release: 2026-09-11

Operational fixes shipped in PR #73:

- Product, order and customer search now have a deterministic clear action.
- Native Android/Chrome search clear (`type=search`) is handled explicitly.
- Clearing a product search re-renders the complete result set for the active filters.
- If a legacy panel layer leaves a stale subset in the DOM, the 10.3.3 guard compares it with the latest bootstrap and performs one safe refresh recovery.
- Mobile bottom navigation now exposes **Clientes** directly instead of hiding that section behind desktop-only navigation.
- Search-clear behavior is shared across Productos, Pedidos and Clientes.
- Service-worker/app-shell cache bumped to 10.3.3.
- Customer production audit before release: 3 customers, no duplicate phones, no missing business/phone fields, and stored order counters/totals match real orders.

This release does not modify product prices, stock, customer rows or order data in Supabase.
