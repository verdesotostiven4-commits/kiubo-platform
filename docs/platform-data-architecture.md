# KIUBO Platform Data Architecture

## Principle

**GitHub stores application code, migrations, tests and configuration templates. It must never be the live database for tenant products, customers, sales, cash, purchases or inventory.**

Operational business data belongs in a transactional database. KIUBO uses Supabase/PostgreSQL as the managed Cloud source of truth and keeps an offline device copy for resilience.

## Why 500–600 products are not the scaling problem

A catalog with hundreds or even thousands of products is small for PostgreSQL. Scaling risk comes from architecture and access patterns, not from the existence of a few hundred product rows.

Typical causes of poor performance or reliability to avoid:

- downloading an entire tenant database on every refresh
- unindexed tenant/branch queries
- large unbounded JSON payloads
- storing images or binary files inside product rows
- one huge localStorage document rewritten too often
- generic last-write-wins updates for coupled sale/stock/cash operations
- missing pagination
- repeated real-time subscriptions that fetch the same data
- mixing multiple tenants without strict tenant/branch keys
- relying on free-plan quotas as if they were production capacity guarantees

## Target architecture

### 1. Cloud control plane — Supabase/PostgreSQL

Source of truth for:

- tenants
- branches
- users/memberships
- products and catalog metadata
- customers
- sales
- orders
- cash sessions/movements
- credits/payments
- suppliers
- purchases/payments
- stock movements
- settings/branding/capabilities
- audit events

All operational rows must be tenant-scoped. Branch-scoped data also carries `branch_id`.

### 2. Object storage

Images/logos/documents do not belong in GitHub or large database JSON payloads.

Use object storage/CDN and keep only stable URLs/paths in PostgreSQL for:

- tenant logos
- product photos
- future invoices/RIDE/XML
- exports/backups when appropriate

### 3. Device database / offline cache

The browser/PWA keeps only the active tenant/sucursal working set plus the durable sync queue.

Goals:

- sell when internet is unstable
- keep pending commands after restart
- load common products immediately
- sync only deltas after reconnect

Current KIUBO durability is a foundation; before broader rollout the preferred long-term browser store is IndexedDB/structured local storage rather than treating one giant localStorage JSON document as the final architecture.

### 4. Transaction commands

Money and stock operations must be atomic Cloud commands/RPCs:

- sale + stock + credit
- sale reversal + stock + cash refund
- cash lifecycle
- credit payment + cash movement
- purchase + stock + weighted cost + supplier payment
- supplier payment + cash outflow
- inventory adjustment + stock movement

Never decompose these into independent generic sync writes in production.

### 5. Delta synchronization

Devices should not fetch every row on every launch.

Pattern:

1. authenticate
2. identify active tenant/branch and allowed branches
3. load durable local working set
4. pull changes after last revision/cursor
5. persist changes
6. commit cursor only after persistence
7. push pending commands idempotently
8. repeat in bounded pages

## Multi-tenant query rules

Every performance-critical table/query should be designed around the most common access path.

Examples:

- products: `(tenant_id, branch_id, active, name/barcode)`
- sales: `(tenant_id, branch_id, created_at)`
- orders: `(tenant_id, branch_id, status, created_at)`
- stock movements: `(tenant_id, branch_id, product_id, created_at)`
- customers: `(tenant_id, identification)`
- purchases: `(tenant_id, branch_id, created_at)`
- sync entities: `(tenant_id, revision)`

Use indexes based on measured queries rather than indexing every field blindly.

## Pagination and working sets

- Product/search screens must be searchable/indexed and can page/filter.
- Reports use date ranges and server-side aggregates as datasets grow.
- Sync pulls are bounded pages, not unbounded tenant dumps.
- Historical sales do not need to remain fully resident on every cashier device forever.
- A cashier device can keep current/recent working data and query older history on demand.

## Images

Never put product/logo image bytes in GitHub source or sync payload JSON.

Preferred pattern:

`tenant/product row -> image_path/url -> object storage/CDN`

This prevents product sync from becoming image sync.

## Reliability and service tiers

The SaaS should not assume a free infrastructure tier is equivalent to production capacity.

For pilots:

- monitor usage
- keep backups
- keep migrations reproducible
- keep local offline continuity
- avoid unnecessary realtime/network traffic

Before onboarding multiple paying businesses, choose infrastructure capacity based on real database size, bandwidth, active users, backup requirements and support expectations. Upgrade infrastructure before tenant growth reaches a quota wall rather than after an outage.

## Disaster recovery

Production readiness requires layered recovery:

1. PostgreSQL Cloud source of truth
2. provider backups / point-in-time strategy appropriate to plan
3. application-level audit trail and idempotent receipts
4. durable local device queue
5. optional tenant export/backup for portability
6. migration history in GitHub

GitHub is useful for rebuilding the application/schema, not for reconstructing live customer sales from source code.

## Tenant isolation

Security is enforced at multiple layers:

- tenant/branch IDs on rows
- RLS/access helpers
- RPC role checks
- device purge after branch/access revocation
- active-tenant-only synchronization
- no cross-tenant cache mixing

## YUKI

YUKI should not receive a forked codebase or hardcoded menu in GitHub.

YUKI is represented by data:

- tenant record
- plan/capabilities: Custom / Early Partner
- branding record
- branch record
- members/roles
- products/menu
- settings
- future food-service configuration

The same KIUBO application renders a YUKI-specific experience using tenant data and capabilities. This keeps one maintainable SaaS instead of one custom app repository per customer.

## Growth path

### Pilot stage

One managed Supabase project is acceptable if tenant isolation, indexes, quotas, backups and monitoring are handled correctly.

### Growth stage

Do not prematurely create one database/project per small customer. Shared multi-tenant PostgreSQL is operationally simpler and more cost-effective for many small/medium tenants.

Only consider tenant-specific databases/projects for reasons such as:

- contractual isolation
- unusually large enterprise workloads
- geographic/data-residency requirements
- custom compliance
- exceptionally heavy tenant workloads

## Non-negotiable rule

**Never migrate live operational data into GitHub as the solution to database scaling.** If Cloud performance becomes a problem, fix schema, indexes, queries, caching, sync and infrastructure capacity.