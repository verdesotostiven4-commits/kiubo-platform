-- KIUBO · YUKI menu/catalog reconciliation V1
-- Keeps every non-duplicate complementary product, separates ingredients and
-- charges from sellable products, and stores a durable pre-change snapshot.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.tenant_catalog_backups (
  id bigint generated always as identity primary key,
  backup_key text not null unique,
  tenant_id uuid not null,
  branch_id uuid,
  reason text not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='array'),
  created_at timestamptz not null default now()
);
revoke all on table private.tenant_catalog_backups from public, anon, authenticated;

do $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_item jsonb;
  v_id text;
  v_existing jsonb;
  v_payload jsonb;
  v_recipe jsonb;
  v_ingredient_ids jsonb := '{}'::jsonb;
  v_ingredients jsonb := $ingredients$
  [
    {"key":"yogurt-natural","name":"Yogurt Natural","aliases":["Yogurt Natural"],"unit":"porción","tracked":true},
    {"key":"pulpa-mora","name":"Pulpa de Mora","aliases":["Pulpa de Mora"],"unit":"porción","tracked":true},
    {"key":"pulpa-fresa","name":"Pulpa de Fresa","aliases":["Pulpa de Fresa"],"unit":"porción","tracked":true},
    {"key":"pulpa-melon","name":"Pulpa de Melón","aliases":["Pulpa de Melón"],"unit":"porción","tracked":true},
    {"key":"pulpa-tomate-arbol","name":"Pulpa de Tomate de árbol","aliases":["Pulpa de T. Arbol","Pulpa de Tomate de árbol"],"unit":"porción","tracked":true},
    {"key":"banana","name":"Banana","aliases":["Banana"],"unit":"unidad","tracked":true},
    {"key":"pulpa-naranjilla","name":"Pulpa de Naranjilla","aliases":["Pulpa Naranjilla","Pulpa de Naranjilla"],"unit":"porción","tracked":true},
    {"key":"pulpa-maracuya","name":"Pulpa de Maracuyá","aliases":["Pulpa de Maracuyá"],"unit":"porción","tracked":true},
    {"key":"pulpa-mango","name":"Pulpa de Mango","aliases":["Pulpa de mango","Pulpa de Mango"],"unit":"porción","tracked":true},
    {"key":"pulpa-pina","name":"Pulpa de Piña","aliases":["Pulpa de Piña"],"unit":"porción","tracked":true},
    {"key":"pulpa-coco","name":"Pulpa de Coco","aliases":["Pulpa de Coco"],"unit":"porción","tracked":true},
    {"key":"pan-yuca","name":"Pan de Yuca","aliases":["Pan de Yuca"],"unit":"unidad","tracked":true},
    {"key":"baguette","name":"Baguette","aliases":["Baguette"],"unit":"unidad","tracked":true},
    {"key":"pollo-porcion","name":"Pollo porción","aliases":["Pollo Porción","Pollo porción"],"unit":"porción","tracked":true},
    {"key":"carne-porcion","name":"Carne porción","aliases":["Carne Porción","Carne porción"],"unit":"porción","tracked":true},
    {"key":"salsa-queso-tocino","name":"Salsa de queso con tocino","aliases":["Salsa de queso con tocino"],"unit":"porción","tracked":false},
    {"key":"queso-holandes","name":"Queso holandés","aliases":["Queso holandés"],"unit":"porción","tracked":false},
    {"key":"tomate-confitado","name":"Tomate confitado","aliases":["Tomate confitado"],"unit":"porción","tracked":false},
    {"key":"salsa-casa","name":"Salsa de la casa","aliases":["Salsa de la casa"],"unit":"porción","tracked":false},
    {"key":"queso-cheddar","name":"Queso cheddar","aliases":["Queso cheddar"],"unit":"porción","tracked":false},
    {"key":"cebolla-semicaramelizada","name":"Cebolla semicaramelizada","aliases":["Cebolla semicaramelizada"],"unit":"porción","tracked":false},
    {"key":"hojas-albahaca","name":"Hojas de albahaca","aliases":["Hojas de albahaca"],"unit":"porción","tracked":false},
    {"key":"cafe-porcion","name":"Café preparado","aliases":["Café preparado"],"unit":"porción","tracked":false},
    {"key":"leche-porcion","name":"Leche","aliases":["Leche"],"unit":"porción","tracked":false},
    {"key":"te-porcion","name":"Té / infusión","aliases":["Té / infusión"],"unit":"porción","tracked":false},
    {"key":"colas","name":"Cola","aliases":["Coca Cola","Cola"],"unit":"unidad","tracked":true},
    {"key":"agua-gas","name":"Agua con gas","aliases":["Guitig","Agua con gas"],"unit":"unidad","tracked":true}
  ]
  $ingredients$::jsonb;
  v_menu jsonb := $menu$
  [
    {"id":"yuki-menu-yogurt-mora","barcode":"YUKI-YOGURTMORA","name":"Yogurt Mora","category":"Yogurts","price":4.50,"description":"Yogurt natural con mora.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-mora","qty":1}]},
    {"id":"yuki-menu-yogurt-fresa","barcode":"YUKI-YOGURTFRESA","name":"Yogurt Fresa","category":"Yogurts","price":4.50,"description":"Yogurt natural con fresa.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-fresa","qty":1}]},
    {"id":"yuki-menu-yogurt-melon","barcode":"YUKI-YOGURTMELON","name":"Yogurt Melón","category":"Yogurts","price":4.50,"description":"Yogurt natural con melón.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-melon","qty":1}]},
    {"id":"yuki-menu-yogurt-tomate-arbol","barcode":"YUKI-YOGURTTOMATEARBOL","name":"Yogurt Tomate de árbol","category":"Yogurts","price":4.50,"description":"Yogurt natural con tomate de árbol.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-tomate-arbol","qty":1}]},
    {"id":"yuki-menu-yogurt-banana","barcode":"YUKI-YOGURTBANANA","name":"Yogurt Banana","category":"Yogurts","price":4.50,"description":"Yogurt natural con banana.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"banana","qty":1}]},
    {"id":"yuki-menu-yogurt-naranjilla","barcode":"YUKI-YOGURTNARANJILLA","name":"Yogurt Naranjilla","category":"Yogurts","price":4.50,"description":"Yogurt natural con naranjilla.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-naranjilla","qty":1}]},
    {"id":"yuki-menu-yogurt-maracuya","barcode":"YUKI-YOGURTMARACUYA","name":"Yogurt Maracuyá","category":"Yogurts","price":4.50,"description":"Yogurt natural con maracuyá.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-maracuya","qty":1}]},
    {"id":"yuki-menu-yogurt-mango","barcode":"YUKI-YOGURTMANGO","name":"Yogurt Mango","category":"Yogurts","price":4.50,"description":"Yogurt natural con mango.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-mango","qty":1}]},
    {"id":"yuki-menu-yogurt-pina","barcode":"YUKI-YOGURTPINA","name":"Yogurt Piña","category":"Yogurts","price":4.50,"description":"Yogurt natural con piña.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-pina","qty":1}]},
    {"id":"yuki-menu-yogurt-coco","barcode":"YUKI-YOGURTCOCO","name":"Yogurt Coco","category":"Yogurts","price":4.50,"description":"Yogurt natural con coco.","recipe":[{"ingredientKey":"yogurt-natural","qty":1},{"ingredientKey":"pulpa-coco","qty":1}]},
    {"id":"yuki-menu-combo-1","barcode":"YUKI-COMBO1","name":"Combo 1","category":"Combos","price":5.80,"description":"1 yogurt + 3 panes de yuca.","recipe":[{"ingredientKey":"pan-yuca","qty":3}],"optionConfig":{"label":"Yogur","selectionCount":1,"source":"category","sourceCategory":"Yogurts","allowRepeat":true}},
    {"id":"yuki-menu-combo-2","barcode":"YUKI-COMBO2","name":"Combo 2","category":"Combos","price":7.60,"description":"1 yogurt + 6 panes de yuca.","recipe":[{"ingredientKey":"pan-yuca","qty":6}],"optionConfig":{"label":"Yogur","selectionCount":1,"source":"category","sourceCategory":"Yogurts","allowRepeat":true}},
    {"id":"yuki-menu-combo-3","barcode":"YUKI-COMBO3","name":"Combo 3","category":"Combos","price":13.95,"description":"2 yogurts + 10 panes de yuca.","recipe":[{"ingredientKey":"pan-yuca","qty":10}],"optionConfig":{"label":"Yogur","selectionCount":2,"source":"category","sourceCategory":"Yogurts","allowRepeat":true}},
    {"id":"yuki-menu-combo-4","barcode":"YUKI-COMBO4","name":"Combo 4","category":"Combos","price":21.00,"description":"3 yogurts + 15 panes de yuca.","recipe":[{"ingredientKey":"pan-yuca","qty":15}],"optionConfig":{"label":"Yogur","selectionCount":3,"source":"category","sourceCategory":"Yogurts","allowRepeat":true}},
    {"id":"yuki-menu-sandwich-pollo-cremoso","barcode":"YUKI-SANDWICHPOLLOCREMOSO","name":"Pollo Cremoso","category":"Sánduches","price":8.95,"description":"Salsa de queso con tocino, queso holandés, pollo, tomate confitado y salsa de la casa.","recipe":[{"ingredientKey":"baguette","qty":1},{"ingredientKey":"pollo-porcion","qty":1},{"ingredientKey":"salsa-queso-tocino","qty":1},{"ingredientKey":"queso-holandes","qty":1},{"ingredientKey":"tomate-confitado","qty":1},{"ingredientKey":"salsa-casa","qty":1}]},
    {"id":"yuki-menu-sandwich-carne-brava","barcode":"YUKI-SANDWICHCARNEBRAVA","name":"Carne Brava","category":"Sánduches","price":9.90,"description":"Carne de res, queso cheddar, cebolla semicaramelizada y salsa de la casa.","recipe":[{"ingredientKey":"baguette","qty":1},{"ingredientKey":"carne-porcion","qty":1},{"ingredientKey":"queso-cheddar","qty":1},{"ingredientKey":"cebolla-semicaramelizada","qty":1},{"ingredientKey":"salsa-casa","qty":1}]},
    {"id":"yuki-menu-sandwich-la-fresca","barcode":"YUKI-SANDWICHLAFRESCA","name":"La Fresca","category":"Sánduches","price":7.75,"description":"Queso holandés, tomate confitado, hojas de albahaca y salsa de la casa.","recipe":[{"ingredientKey":"baguette","qty":1},{"ingredientKey":"queso-holandes","qty":1},{"ingredientKey":"tomate-confitado","qty":1},{"ingredientKey":"hojas-albahaca","qty":1},{"ingredientKey":"salsa-casa","qty":1}]},
    {"id":"yuki-menu-cafe-americano","barcode":"YUKI-CAFEAMERICANO","name":"Café americano caliente / frío","category":"Bebidas","price":3.25,"description":"Café americano caliente o frío.","recipe":[{"ingredientKey":"cafe-porcion","qty":1}]},
    {"id":"yuki-menu-cappuccino","barcode":"YUKI-CAPPUCCINO","name":"Capuccino","category":"Bebidas","price":3.75,"description":"Café capuccino.","recipe":[{"ingredientKey":"cafe-porcion","qty":1},{"ingredientKey":"leche-porcion","qty":1}]},
    {"id":"yuki-menu-espresso","barcode":"YUKI-ESPRESSO","name":"Espresso","category":"Bebidas","price":3.00,"description":"Café espresso.","recipe":[{"ingredientKey":"cafe-porcion","qty":1}]},
    {"id":"yuki-menu-te","barcode":"YUKI-TE","name":"Té","category":"Bebidas","price":3.00,"description":"Té o infusión.","recipe":[{"ingredientKey":"te-porcion","qty":1}]},
    {"id":"yuki-menu-jugo-frutas","barcode":"YUKI-JUGOFRUTAS","name":"Jugo de frutas","category":"Bebidas","price":3.50,"description":"Jugo de frutas; el sabor se elige al vender.","recipe":[],"optionConfig":{"label":"Sabor","selectionCount":1,"source":"category","sourceCategory":"Jugos","allowRepeat":false}},
    {"id":"yuki-menu-colas","barcode":"YUKI-COLAS","name":"Colas","category":"Bebidas","price":2.25,"description":"Bebida gaseosa.","recipe":[{"ingredientKey":"colas","qty":1}]},
    {"id":"yuki-menu-agua-gas","barcode":"YUKI-AGUAGAS","name":"Agua con gas (Güitig)","category":"Bebidas","price":2.65,"description":"Agua mineral con gas.","recipe":[{"ingredientKey":"agua-gas","qty":1}]}
  ]
  $menu$::jsonb;
begin
  select id into v_tenant
  from public.tenants
  where slug='yuki-irwf' and display_name='YUKI';
  if v_tenant is null then
    raise exception 'YUKI production tenant not found';
  end if;

  select id into v_branch
  from public.branches
  where tenant_id=v_tenant and code='001' and name='Matriz' and active;
  if v_branch is null then
    raise exception 'YUKI production branch not found';
  end if;

  insert into private.tenant_catalog_backups(backup_key,tenant_id,branch_id,reason,snapshot)
  select
    'yuki-menu-catalog-v1-before',v_tenant,v_branch,
    'Estado anterior a la conciliación del menú YUKI 2026-09',
    coalesce(jsonb_agg(jsonb_build_object(
      'tenant_id',tenant_id,'branch_id',branch_id,'entity_type',entity_type,
      'entity_id',entity_id,'payload',payload,'deleted',deleted,'updated_at',updated_at
    ) order by entity_id),'[]'::jsonb)
  from public.sync_entities
  where tenant_id=v_tenant and branch_id=v_branch and entity_type='tenantProducts'
  on conflict(backup_key) do nothing;

  -- Give every current row an explicit role without changing its availability.
  update public.sync_entities
  set payload=payload||jsonb_build_object(
      'productKind',case when coalesce((payload->>'inventoryOnly')::boolean,false) then 'ingredient' when payload->>'category'='Cargos' then 'charge' else 'sellable' end
    ),updated_at=now()
  where tenant_id=v_tenant and branch_id=v_branch and entity_type='tenantProducts' and not deleted;

  -- Normalize or create ingredients. Existing stock/cost values are preserved.
  for v_item in select value from jsonb_array_elements(v_ingredients) loop
    v_id:=null;
    v_existing:=null;
    select entity_id,payload into v_id,v_existing
    from public.sync_entities
    where tenant_id=v_tenant and entity_type='tenantProducts' and not deleted
      and coalesce((payload->>'inventoryOnly')::boolean,false)
      and lower(trim(payload->>'name')) in(
        select lower(trim(value)) from jsonb_array_elements_text(v_item->'aliases')
      )
    order by case when branch_id=v_branch then 0 else 1 end,updated_at desc
    limit 1;
    v_id:=coalesce(v_id,'yuki-ingredient-'||(v_item->>'key'));
    v_payload:=coalesce(v_existing,jsonb_build_object(
      'id',v_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'masterProductId','ingredient-'||v_id,
      'barcode','INS-'||upper(substr(md5(v_id),1,18)),'price',0,'cost',0,'stock',0,'active',true
    ))||jsonb_build_object(
      'name',v_item->>'name','category','Insumos','productKind','ingredient','inventoryOnly',true,
      'trackStock',(v_item->>'tracked')::boolean,'stockUnit',v_item->>'unit','lowStockThreshold',5,'active',true
    );
    insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
    values(v_tenant,v_branch,'tenantProducts',v_id,v_payload,false,now())
    on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
    v_ingredient_ids:=v_ingredient_ids||jsonb_build_object(v_item->>'key',v_id);
  end loop;

  -- Reconcile the customer-facing menu while preserving images and history.
  for v_item in select value from jsonb_array_elements(v_menu) loop
    v_id:=v_item->>'id';
    select payload into v_existing from public.sync_entities where tenant_id=v_tenant and entity_type='tenantProducts' and entity_id=v_id and not deleted;
    select coalesce(jsonb_agg(jsonb_build_object(
      'productId',v_ingredient_ids->>(part->>'ingredientKey'),
      'qty',(part->>'qty')::numeric
    )),'[]'::jsonb)
    into v_recipe
    from jsonb_array_elements(coalesce(v_item->'recipe','[]'::jsonb)) as parts(part);
    v_payload:=coalesce(v_existing,jsonb_build_object(
      'id',v_id,'tenantId',v_tenant::text,'branchId',v_branch::text,'masterProductId','custom-'||v_id,
      'barcode',v_item->>'barcode','cost',0,'stock',1000000
    ))||(v_item-'id'-'description'-'recipe')||jsonb_build_object(
      'recipe',v_recipe,
      'trackStock',false,'active',true,'productKind','sellable','menuFeatured',true,
      'menuDescription',v_item->>'description','menuVersion','2026-09'
    );
    insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
    values(v_tenant,v_branch,'tenantProducts',v_id,v_payload,false,now())
    on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=false,updated_at=excluded.updated_at;
  end loop;

  -- Juices stay available as complementary products and also feed the generic
  -- "Jugo de frutas" flavor selector.
  for v_item in select value from jsonb_array_elements($juices$
    [
      {"aliases":["Jugo de Coco"],"name":"Jugo de Coco"},
      {"aliases":["Jugo de Maracuya","Jugo de Maracuyá"],"name":"Jugo de Maracuyá"},
      {"aliases":["Jugo de Mora"],"name":"Jugo de Mora"},
      {"aliases":["Jugo Mango","Jugo de Mango"],"name":"Jugo de Mango"},
      {"aliases":["JUGO NARANJILL","Jugo de Naranjilla"],"name":"Jugo de Naranjilla"},
      {"aliases":["Jugo T. Arbol.","Jugo de Tomate de árbol"],"name":"Jugo de Tomate de árbol"}
    ]
  $juices$::jsonb) loop
    update public.sync_entities
    set payload=payload||jsonb_build_object(
      'category','Jugos','productKind','sellable','active',true,
      'menuFeatured',false,'name',v_item->>'name'
    ),updated_at=now()
    where tenant_id=v_tenant and branch_id=v_branch and entity_type='tenantProducts' and not deleted
      and lower(trim(payload->>'name')) in(
        select lower(trim(value)) from jsonb_array_elements_text(v_item->'aliases')
      );
  end loop;

  -- Archive only confirmed duplicates; never delete history-bearing rows.
  update public.sync_entities
  set payload=payload||jsonb_build_object('active',false,'archivedReason','Duplicado conciliado por menú YUKI 2026-09'),updated_at=now()
  where tenant_id=v_tenant and branch_id=v_branch and entity_type='tenantProducts' and not deleted
    and (
      (lower(trim(payload->>'name'))='combo 1' and entity_id<>'yuki-menu-combo-1')
      or lower(trim(payload->>'name'))='jugo coco'
      or (
        lower(trim(payload->>'name'))='carne porción'
        and not coalesce((payload->>'inventoryOnly')::boolean,false)
        and coalesce((payload->>'price')::numeric,0)=0
      )
    );

  -- Keep internal charges available but out of product/inventory screens.
  update public.sync_entities set payload=payload||jsonb_build_object('productKind','charge','menuFeatured',false),updated_at=now()
  where tenant_id=v_tenant and branch_id=v_branch and entity_type='tenantProducts'
    and (entity_id='yuki-service-packaging' or payload->>'category'='Cargos');

  update public.sync_entities
  set payload=jsonb_set(payload,'{categoryOrder}','["Combos","Yogurts","Sánduches","Bebidas","Jugos","Pan","Especialidades","Extras","General"]'::jsonb,true),updated_at=now()
  where tenant_id=v_tenant and entity_type='settings' and entity_id=v_tenant::text and not deleted;
end $$;
