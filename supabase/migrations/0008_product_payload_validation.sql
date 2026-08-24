-- KIUBO Cloud v1 · reject malformed product payloads before they can poison another device.
-- NOT VALID keeps existing rows available while enforcing this guard on all new writes/updates.

alter table public.sync_entities
  add constraint sync_tenant_products_payload_sane
  check (
    entity_type <> 'tenantProducts'
    or deleted
    or (
      jsonb_typeof(payload) = 'object'
      and length(coalesce(payload->>'name','')) between 1 and 160
      and length(coalesce(payload->>'barcode','')) between 1 and 96
      and coalesce(payload->>'barcode','') !~ E'[\r\n]'
    )
  ) not valid;
