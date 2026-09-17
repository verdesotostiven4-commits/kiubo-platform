-- Enable per-product observations for every current Hakuna Matata product.
-- New products already default to true; archived products are included so the
-- setting remains enabled if they are restored later.
update public.catalog_products as product
set allow_item_note = true,
    updated_at = now()
from public.catalog_accounts as account
where account.id = product.account_id
  and account.slug = 'hakuna-matata'
  and product.allow_item_note is distinct from true;
