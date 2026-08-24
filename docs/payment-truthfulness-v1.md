# Payment Truthfulness V1

This release keeps accounting state aligned with what KIUBO actually persists and can reconcile.

- Mixed POS payments stay hidden until cash/transfer split amounts are stored explicitly.
- Cash supplier payments require an open cash session.
- Supplier cash payments generate a linked cash outflow.
- Purchase receiving, payable updates, inventory and cash stay behind transactional cloud commands.
- Legacy fallback remains available when newer RPCs are not yet installed.
