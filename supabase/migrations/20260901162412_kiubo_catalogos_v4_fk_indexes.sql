-- Foreign-key covering indexes recommended by the database advisor.

create index if not exists catalog_products_category_fk_idx
  on public.catalog_products (category_id);

create index if not exists catalog_order_items_product_fk_idx
  on public.catalog_order_items (product_id);
