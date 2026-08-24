# KIUBO · Pilot accounting integrity batch

This branch intentionally accumulates pilot-readiness work while feature-branch Vercel deployments are disabled. It must be squash-merged only after the full quality gate, TypeScript and a production-capable build pass.

## Payment truthfulness

- POS does not offer mixed payment until KIUBO persists the exact cash/transfer split.
- Supplier cash payments require an open cash session and create the linked cash outflow in the same Cloud transaction.
- Purchase receiving, stock, weighted cost, payable state and initial payment remain behind transactional commands.

## Cash reconciliation

- A cash session reconstructs expected cash from opening float + physical cash sales + manual inflows - cash outflows.
- Closing records preserve counted cash and historical over/short differences.
- Voided cash sales remain part of the original physical cash flow; their refund is a separate outflow.

## Sale reversal safety

- Recent cash/transfer sales can be voided only by owner/admin.
- The original sale remains visible and is marked voided instead of being deleted.
- Stock restoration and any cash refund are atomic Cloud effects.
- If the reversal RPC is unavailable, KIUBO keeps the command pending instead of falling back to unsafe multi-write synchronization.

## Retry idempotency

- Migration `0019_payment_idempotency_v1.sql` wraps finance and purchase RPCs without changing their public names.
- Repeating a credit payment or supplier payment with the same economic payment id cannot reduce a balance twice even if a transport retry gets a new operation id.
- Repeating the same purchase id cannot generate a second supplier cash outflow.
- Cash open/movement/close ids are checked so retries cannot silently mutate the same economic event with different amounts.
- Legacy RPC implementations are renamed and execution is revoked from authenticated clients so clients cannot bypass the hardened wrappers.

## Deployment budget

Feature-branch Git deployments stay disabled while this batch is in progress. Before final merge, `vercel.json` must be restored so `main` is the only Git branch allowed to deploy. The PR is then squash-merged so this whole batch lands on `main` as one consolidated commit and consumes one production deployment.
