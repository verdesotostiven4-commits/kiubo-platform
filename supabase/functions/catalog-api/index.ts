import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}") as Record<string, string>;
const SECRET_KEY = secretKeys.default || legacySecret;
const PUBLISHABLE_KEY = publishableKeys.default || legacyAnon;
const BUCKET = "catalog-assets-v4";

if (!SUPABASE_URL || !SECRET_KEY || !PUBLISHABLE_KEY) throw new Error("Missing Supabase runtime configuration");

const db = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set([
  "https://hakuna-matata-catalogo.vercel.app",
  "https://hakuna-matata-catalogo-verdesotostiven4-5089s-projects.vercel.app",
  "http://localhost:4173",
  "http://localhost:8000"
]);

type Json = Record<string, unknown>;
type Actor = { type: "provider" | "master"; accountId?: string; sessionId?: string; userId?: string };

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = allowedOrigins.has(origin) || /^https:\/\/hakuna-matata-catalogo-[a-z0-9-]+\.vercel\.app$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://hakuna-matata-catalogo.vercel.app",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-version, x-provider-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function cleanText(value: unknown, max: number, nullable = true) {
  const text = String(value ?? "").trim().slice(0, max);
  return text || (nullable ? null : "");
}

function validSlug(value: unknown) {
  const slug = String(value ?? "").toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function publicAccount(account: Json) {
  return {
    slug: account.slug,
    name: account.name,
    tagline: account.tagline,
    hero_title: account.hero_title,
    hero_subtitle: account.hero_subtitle,
    logo_url: account.logo_url,
    accent: account.accent,
    accent_deep: account.accent_deep,
    currency: account.currency,
    minimum_order: account.minimum_order,
    is_open: account.is_open,
    show_prices: account.show_prices,
    updated_at: account.updated_at
  };
}

function adminAccount(account: Json) {
  const { provider_pin_hash: _pin, session_version: _version, ...safe } = account;
  return safe;
}

function imageUrl(path: unknown, current: unknown) {
  if (current) return String(current);
  if (!path) return null;
  return db.storage.from(BUCKET).getPublicUrl(String(path)).data.publicUrl;
}

async function accountBySlug(slug: string) {
  const { data, error } = await db.from("catalog_accounts").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Json | null;
}

async function isMasterToken(token: string): Promise<Actor | null> {
  if (!token) return null;
  const authClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: admin } = await db.from("platform_admins").select("user_id,active").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  return admin ? { type: "master", userId: data.user.id } : null;
}

async function providerActor(req: Request): Promise<Actor | null> {
  const token = req.headers.get("x-provider-session")?.trim() || "";
  if (token.length < 32 || token.length > 180) return null;
  const tokenHash = await sha256(token);
  const { data: session } = await db.from("catalog_provider_sessions").select("id,account_id,session_version,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return null;
  const { data: account } = await db.from("catalog_accounts").select("session_version").eq("id", session.account_id).single();
  if (!account || Number(account.session_version) !== Number(session.session_version)) return null;
  void db.from("catalog_provider_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);
  return { type: "provider", accountId: session.account_id, sessionId: session.id };
}

async function requireActor(req: Request): Promise<Actor> {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const master = await isMasterToken(auth.slice(7));
    if (master) return master;
  }
  const provider = await providerActor(req);
  if (provider) return provider;
  throw Object.assign(new Error("session_expired"), { status: 401 });
}

async function actorAccount(actor: Actor, requestedSlug = "") {
  if (actor.type === "provider") {
    const { data, error } = await db.from("catalog_accounts").select("*").eq("id", actor.accountId).single();
    if (error) throw error;
    return data as Json;
  }
  const slug = validSlug(requestedSlug);
  let query = db.from("catalog_accounts").select("*");
  query = slug ? query.eq("slug", slug) : query.order("created_at").limit(1);
  const { data, error } = slug ? await query.single() : await query.maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("account_not_found"), { status: 404 });
  return data as Json;
}

async function adminBootstrap(account: Json) {
  const accountId = String(account.id);
  const [categoriesResult, productsResult, presentationsResult, ordersResult, customersResult] = await Promise.all([
    db.from("catalog_categories").select("*").eq("account_id", accountId).order("sort_order").order("name"),
    db.from("catalog_products").select("*").eq("account_id", accountId).order("sort_order").order("name"),
    db.from("catalog_product_presentations").select("*").eq("account_id", accountId).order("sort_order").order("name"),
    db.from("catalog_orders").select("*,items:catalog_order_items(*)").eq("account_id", accountId).order("created_at", { ascending: false }).limit(250),
    db.from("catalog_customers").select("*").eq("account_id", accountId).order("last_order_at", { ascending: false }).limit(250)
  ]);
  for (const result of [categoriesResult, productsResult, presentationsResult, ordersResult, customersResult]) if (result.error) throw result.error;
  const products = (productsResult.data || []).map(product => ({ ...product, image_url: imageUrl(product.image_path, product.image_url) }));
  return { account: adminAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }), categories: categoriesResult.data || [], products, presentations: presentationsResult.data || [], orders: ordersResult.data || [], customers: customersResult.data || [] };
}

async function publicBootstrap(slug: string) {
  const account = await accountBySlug(slug);
  if (!account) throw Object.assign(new Error("account_not_found"), { status: 404 });
  const [categoriesResult, productsResult, presentationsResult] = await Promise.all([
    db.from("catalog_categories").select("id,name,icon,sort_order,visible").eq("account_id", account.id).eq("visible", true).order("sort_order").order("name"),
    db.from("catalog_products").select("id,category_id,sku,name,brand,description,unit,price,compare_at_price,status,visible,featured,image_path,image_url,sort_order,updated_at,stock_tracking,stock_quantity,low_stock_threshold,base_unit,allow_item_note").eq("account_id", account.id).eq("visible", true).is("archived_at", null).order("featured", { ascending: false }).order("sort_order").order("name"),
    db.from("catalog_product_presentations").select("id,product_id,name,unit_label,units_per_presentation,price,compare_at_price,sort_order").eq("account_id", account.id).eq("visible", true).order("sort_order").order("name")
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (productsResult.error) throw productsResult.error;
  if (presentationsResult.error) throw presentationsResult.error;
  const categoryMap = new Map((categoriesResult.data || []).map(category => [category.id, category.name]));
  const products = (productsResult.data || []).map(product => ({ ...product, category_name: categoryMap.get(product.category_id) || null, image_url: imageUrl(product.image_path, product.image_url) }));
  return { account: publicAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }), categories: categoriesResult.data || [], products, presentations: presentationsResult.data || [] };
}

async function logActivity(accountId: string, actor: Actor, action: string, entityType?: string, entityId?: string, metadata: Json = {}) {
  await db.from("catalog_activity_log").insert({ account_id: accountId, actor_type: actor.type, actor_id: actor.userId || actor.sessionId || null, action, entity_type: entityType || null, entity_id: entityId || null, metadata });
}

function validatePresentationsInput(rows: Json[]) {
  if (rows.length > 40) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    const units = Number(row.units_per_presentation);
    const price = Number(row.price);
    if (!name || name.length > 80) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
    if (!Number.isFinite(units) || units < 1 || units > 100000) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
    if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
  }
}

// Presentations are fully replaced on every save: rows missing an id are new,
// existing ids not present in the payload get deleted, everything else is
// upserted by id. Exactly one row is forced to be the default presentation.
async function savePresentations(accountId: string, productId: string, rows: Json[]) {
  const { data: existing, error: existingError } = await db.from("catalog_product_presentations").select("id").eq("product_id", productId).eq("account_id", accountId);
  if (existingError) throw existingError;
  const existingIds = new Set((existing || []).map(row => String(row.id)));
  const keepIds = new Set<string>();

  const clean = rows.map((row, index) => ({
    id: row.id && existingIds.has(String(row.id)) ? String(row.id) : undefined,
    account_id: accountId,
    product_id: productId,
    name: cleanText(row.name, 80, false),
    unit_label: cleanText(row.unit_label, 40, false) || "unidad",
    units_per_presentation: Math.max(1, Math.trunc(Number(row.units_per_presentation || 1))),
    price: Math.max(0, Number(row.price || 0)),
    compare_at_price: row.compare_at_price == null ? null : Math.max(0, Number(row.compare_at_price)),
    sku: cleanText(row.sku, 60),
    visible: row.visible !== false,
    is_default: false,
    sort_order: index
  }));
  if (!clean.length) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
  const requestedDefault = rows.findIndex(row => row?.is_default === true);
  clean[requestedDefault >= 0 ? requestedDefault : 0].is_default = true;
  for (const row of clean) if (row.id) keepIds.add(row.id);

  const toDelete = [...existingIds].filter(id => !keepIds.has(id));
  const toUpdate = clean.filter(row => row.id);
  const toInsert = clean.filter(row => !row.id).map(({ id: _id, ...rest }) => rest);
  // Clear is_default first to avoid tripping the one-default-per-product unique
  // index while the set is being replaced, then write, then delete stale rows.
  await db.from("catalog_product_presentations").update({ is_default: false }).eq("product_id", productId).eq("account_id", accountId);
  for (const row of toUpdate) {
    const { error } = await db.from("catalog_product_presentations").update(row).eq("id", row.id).eq("product_id", productId).eq("account_id", accountId);
    if (error) throw error;
  }
  if (toInsert.length) {
    const { error } = await db.from("catalog_product_presentations").insert(toInsert);
    if (error) throw error;
  }
  if (toDelete.length) {
    const { error } = await db.from("catalog_product_presentations").delete().eq("product_id", productId).eq("account_id", accountId).in("id", toDelete);
    if (error) throw error;
  }
}

function whatsappUrl(phone: string, order: Json, items: Json[], customer: Json) {
  const lines = [
    `Hola, quiero confirmar el pedido *${order.order_number}*.`, "",
    `*Negocio:* ${customer.customer_business || "Cliente"}`,
    customer.customer_name ? `*Contacto:* ${customer.customer_name}` : "", "",
    "*Productos:*",
    ...items.map(item => `${item.quantity}× ${item.product_name} — $${Number(item.line_total).toFixed(2)}`), "",
    `*Total estimado:* $${Number(order.total).toFixed(2)}`,
    customer.delivery_method === "pickup" ? "*Entrega:* Retiro acordado" : `*Entrega:* ${customer.delivery_address || "Por coordinar"}`,
    customer.notes ? `*Observaciones:* ${customer.notes}` : "", "",
    `Seguimiento: https://hakuna-matata-catalogo.vercel.app/pedido?ref=${order.public_token}`
  ].filter(Boolean);
  return `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
}

async function handleJson(req: Request, body: Json) {
  const action = String(body.action || "");
  const slug = validSlug(body.slug || "hakuna-matata");

  if (action === "catalog_identity") {
    const account = await accountBySlug(slug);
    if (!account) throw Object.assign(new Error("account_not_found"), { status: 404 });
    return { account: publicAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }) };
  }
  if (action === "catalog_bootstrap") return publicBootstrap(slug);
  if (action === "order_status") {
    const token = String(body.public_token || "");
    if (!/^[0-9a-f-]{36}$/i.test(token)) throw Object.assign(new Error("invalid_request"), { status: 400 });
    const { data: order, error } = await db.from("catalog_orders").select("id,account_id,order_number,total,status,created_at,updated_at").eq("public_token", token).maybeSingle();
    if (error) throw error;
    if (!order) throw Object.assign(new Error("order_not_found"), { status: 404 });
    const { data: items, error: itemsError } = await db.from("catalog_order_items").select("product_name,quantity,line_total").eq("order_id", order.id).order("created_at");
    if (itemsError) throw itemsError;
    const { data: account } = await db.from("catalog_accounts").select("slug,name,logo_path,logo_url,accent,accent_deep,currency").eq("id", order.account_id).maybeSingle();
    const safeOrder = { ...order, items: items || [] } as Json;
    delete safeOrder.account_id;
    return { order: safeOrder, account: account ? publicAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }) : null };
  }
  if (action === "create_order") {
    const idempotency = String(body.idempotency_key || "");
    if (!/^[0-9a-f-]{36}$/i.test(idempotency)) throw Object.assign(new Error("invalid_request"), { status: 400 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateKey = await sha256(`${slug}|${ip}`);
    const { data: allowed, error: rateError } = await db.rpc("catalog_check_order_rate", { p_slug: slug, p_rate_key: rateKey });
    if (rateError) throw rateError;
    if (!allowed) throw Object.assign(new Error("too_many_orders"), { status: 429 });
    const { data, error } = await db.rpc("catalog_create_order", { p_slug: slug, p_idempotency_key: idempotency, p_customer: body.customer || {}, p_items: body.items || [] });
    if (error) throw error;
    const order = data as Json;
    const { data: items } = await db.from("catalog_order_items").select("product_name,quantity,line_total").eq("order_id", order.id);
    return { order, whatsapp_url: whatsappUrl(String(order.whatsapp || ""), order, (items || []) as Json[], (body.customer || {}) as Json) };
  }
  if (action === "provider_login") {
    const pin = String(body.pin || "");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const device = String(body.device_id || "").slice(0, 120);
    const attemptKey = await sha256(`${slug}|${ip}|${req.headers.get("user-agent") || ""}`);
    const { data, error } = await db.rpc("catalog_check_pin", { p_slug: slug, p_pin: pin, p_attempt_key: attemptKey });
    if (error) throw error;
    if (!data?.ok) {
      const blocked = data?.reason === "blocked";
      throw Object.assign(new Error(blocked ? "too_many_attempts" : "invalid_pin"), { status: blocked ? 429 : 401, details: data });
    }
    const token = randomToken();
    const tokenHash = await sha256(token);
    const deviceHash = device ? await sha256(device) : null;
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { error: sessionError } = await db.from("catalog_provider_sessions").insert({ account_id: data.account_id, token_hash: tokenHash, session_version: data.session_version, device_hash: deviceHash, expires_at: expiresAt });
    if (sessionError) throw sessionError;
    await db.from("catalog_activity_log").insert({ account_id: data.account_id, actor_type: "provider", action: "session.login", metadata: { device_hash: deviceHash } });
    return { session_token: token, expires_at: expiresAt };
  }

  const actor = await requireActor(req);
  const account = await actorAccount(actor, slug);
  const accountId = String(account.id);

  if (action === "provider_bootstrap") return adminBootstrap(account);
  if (action === "master_bootstrap") {
    if (actor.type !== "master") throw Object.assign(new Error("forbidden"), { status: 403 });
    const { data: accounts, error } = await db.from("catalog_accounts").select("id,slug,name,accent,logo_url,created_at").order("name");
    if (error) throw error;
    return { ...(await adminBootstrap(account)), accounts: accounts || [] };
  }
  if (action === "save_product") {
    const input = (body.product || {}) as Json;
    const name = cleanText(input.name, 120, false);
    const price = Number(input.price);
    if (String(name).length < 2 || !Number.isFinite(price) || price < 0) throw Object.assign(new Error("invalid_product"), { status: 400 });
    const presentationsInput = Array.isArray(body.presentations) ? body.presentations as Json[] : null;
    if (presentationsInput) validatePresentationsInput(presentationsInput);
    const data = {
      account_id: accountId, category_id: input.category_id || null, sku: cleanText(input.sku, 60), name,
      brand: cleanText(input.brand, 80), description: cleanText(input.description, 500), unit: cleanText(input.unit, 100),
      price, compare_at_price: input.compare_at_price == null ? null : Number(input.compare_at_price),
      status: ["available", "low", "out"].includes(String(input.status)) ? input.status : "available",
      visible: input.visible !== false, featured: input.featured === true, image_path: cleanText(input.image_path, 500),
      image_url: cleanText(input.image_url, 1000), sort_order: Math.max(0, Math.min(100000, Number(input.sort_order || 0)))
    };
    let result;
    if (input.id) result = await db.from("catalog_products").update(data).eq("id", input.id).eq("account_id", accountId).select("id").single();
    else result = await db.from("catalog_products").insert(data).select("id").single();
    if (result.error) throw result.error;
    const productId = String(result.data.id);
    if (presentationsInput) await savePresentations(accountId, productId, presentationsInput);
    await logActivity(accountId, actor, input.id ? "product.updated" : "product.created", "product", productId);
    return { id: productId };
  }
  if (action === "set_product_status") {
    const status = String(body.status || "");
    if (!["available", "low", "out"].includes(status)) throw Object.assign(new Error("invalid_status"), { status: 400 });
    const { data, error } = await db.from("catalog_products").update({ status }).eq("id", body.product_id).eq("account_id", accountId).is("archived_at", null).select("id").single();
    if (error) throw error;
    await logActivity(accountId, actor, "product.status_updated", "product", data.id, { status });
    return { id: data.id, status };
  }
  if (action === "archive_product") {
    const archivedAt = body.restore === true ? null : new Date().toISOString();
    const { data, error } = await db.from("catalog_products").update({ archived_at: archivedAt, visible: body.restore === true }).eq("id", body.product_id).eq("account_id", accountId).select("id").single();
    if (error) throw error;
    await logActivity(accountId, actor, body.restore === true ? "product.restored" : "product.archived", "product", data.id);
    return { id: data.id };
  }
  if (action === "save_category") {
    const input = (body.category || {}) as Json;
    const name = cleanText(input.name, 60, false);
    if (String(name).length < 2) throw Object.assign(new Error("invalid_category"), { status: 400 });
    const data = { account_id: accountId, name, icon: cleanText(input.icon, 30) || "box", sort_order: Math.max(0, Number(input.sort_order || 0)), visible: input.visible !== false };
    const result = input.id ? await db.from("catalog_categories").update(data).eq("id", input.id).eq("account_id", accountId).select("id").single() : await db.from("catalog_categories").insert(data).select("id").single();
    if (result.error) throw result.error;
    await logActivity(accountId, actor, input.id ? "category.updated" : "category.created", "category", result.data.id);
    return { id: result.data.id };
  }
  if (action === "delete_category") {
    await db.from("catalog_products").update({ category_id: null }).eq("account_id", accountId).eq("category_id", body.category_id);
    const { error } = await db.from("catalog_categories").delete().eq("id", body.category_id).eq("account_id", accountId);
    if (error) throw error;
    await logActivity(accountId, actor, "category.deleted", "category", String(body.category_id));
    return { ok: true };
  }
  if (action === "update_order_status") {
    const status = String(body.status || "");
    if (!orderStatusAllowed(status)) throw Object.assign(new Error("invalid_status"), { status: 400 });
    const { data, error } = await db.from("catalog_orders").update({ status }).eq("id", body.order_id).eq("account_id", accountId).select("id").single();
    if (error) {
      const message = String((error as { message?: string }).message || "");
      if (message.includes("insufficient_stock")) throw Object.assign(new Error(message), { status: 409 });
      if (message.includes("invalid_status_transition")) throw Object.assign(new Error("invalid_status_transition"), { status: 409 });
      throw error;
    }
    await logActivity(accountId, actor, "order.status_updated", "order", data.id, { status });
    return { id: data.id, status };
  }
  if (action === "save_account") {
    const input = (body.settings || {}) as Json;
    const data: Json = {};
    if ("name" in input) { const name = cleanText(input.name, 80, false); if (String(name).length < 2) throw Object.assign(new Error("invalid_name"), { status: 400 }); data.name = name; }
    if ("tagline" in input) data.tagline = cleanText(input.tagline, 100, false);
    if ("whatsapp" in input) data.whatsapp = String(input.whatsapp || "").replace(/\D/g, "").slice(0, 15);
    if ("accent" in input) { const accent = String(input.accent); if (!/^#[0-9a-f]{6}$/i.test(accent)) throw Object.assign(new Error("invalid_color"), { status: 400 }); data.accent = accent; }
    if ("logo_path" in input) data.logo_path = cleanText(input.logo_path, 500);
    if ("logo_url" in input) data.logo_url = cleanText(input.logo_url, 1000);
    if ("hero_title" in input) data.hero_title = cleanText(input.hero_title, 110, false);
    if ("hero_subtitle" in input) data.hero_subtitle = cleanText(input.hero_subtitle, 240, false);
    if ("minimum_order" in input) data.minimum_order = Math.max(0, Number(input.minimum_order || 0));
    if ("is_open" in input) data.is_open = input.is_open === true;
    if ("show_prices" in input) data.show_prices = input.show_prices !== false;
    const { data: updated, error } = await db.from("catalog_accounts").update(data).eq("id", accountId).select("*").single();
    if (error) throw error;
    await logActivity(accountId, actor, "account.updated", "account", accountId, { fields: Object.keys(data) });
    return { account: adminAccount(updated) };
  }
  if (action === "change_pin") {
    const pin = String(body.pin || "");
    if (!/^[0-9]{4}$/.test(pin)) throw Object.assign(new Error("pin_must_be_4_digits"), { status: 400 });
    const { error } = await db.rpc("catalog_set_pin", { p_account_id: accountId, p_pin: pin });
    if (error) throw error;
    await logActivity(accountId, actor, "security.pin_changed", "account", accountId);
    return { ok: true };
  }
  if (action === "revoke_sessions") {
    let query = db.from("catalog_provider_sessions").update({ revoked_at: new Date().toISOString() }).eq("account_id", accountId).is("revoked_at", null);
    if (actor.type === "provider" && actor.sessionId) query = query.neq("id", actor.sessionId);
    const { error } = await query;
    if (error) throw error;
    await logActivity(accountId, actor, "security.sessions_revoked", "account", accountId);
    return { ok: true };
  }
  if (action === "provider_logout") {
    if (actor.type === "provider" && actor.sessionId) await db.from("catalog_provider_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", actor.sessionId);
    return { ok: true };
  }
  throw Object.assign(new Error("unknown_action"), { status: 400 });
}

function orderStatusAllowed(value: string) {
  return ["new", "confirmed", "preparing", "dispatched", "delivered", "cancelled"].includes(value);
}

async function handleUpload(req: Request, form: FormData) {
  const actor = await requireActor(req);
  const slug = validSlug(form.get("slug"));
  const account = await actorAccount(actor, slug);
  const file = form.get("file");
  const kind = String(form.get("kind") || "");
  if (!(file instanceof File) || !["logo", "product"].includes(kind)) throw Object.assign(new Error("invalid_upload"), { status: 400 });
  if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw Object.assign(new Error("invalid_file"), { status: 400 });
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${account.id}/${kind}s/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const oldPath = String(form.get("old_path") || "");
  if (oldPath.startsWith(`${account.id}/`) && oldPath !== path) await db.storage.from(BUCKET).remove([oldPath]);
  await logActivity(String(account.id), actor, "asset.uploaded", kind, path, { size: file.size, type: file.type });
  return { path, public_url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return response(req, { error: "method_not_allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin) && !/^https:\/\/hakuna-matata-catalogo-[a-z0-9-]+\.vercel\.app$/.test(origin)) return response(req, { error: "origin_not_allowed" }, 403);
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 6 * 1024 * 1024) return response(req, { error: "payload_too_large" }, 413);
  try {
    const contentType = req.headers.get("content-type") || "";
    const result = contentType.includes("multipart/form-data")
      ? await handleUpload(req, await req.formData())
      : await handleJson(req, await req.json() as Json);
    return response(req, result);
  } catch (error) {
    const err = error as Error & { status?: number; details?: unknown; code?: string };
    const message = err.message || "request_failed";
    const known = ["account_not_found", "order_not_found", "catalog_closed", "invalid_request", "minimum_order", "insufficient_stock", "product_unavailable", "invalid_customer", "invalid_phone", "invalid_items", "invalid_quantity", "invalid_delivery", "invalid_pin", "too_many_attempts", "too_many_orders", "session_expired", "forbidden", "pin_must_be_4_digits", "invalid_product", "invalid_presentations", "invalid_category", "invalid_status", "invalid_status_transition", "invalid_name", "invalid_color", "invalid_upload", "invalid_file", "unknown_action"];
    const code = known.find(item => message.includes(item)) || err.code || "request_failed";
    const status = err.status || (code === "account_not_found" ? 404 : code === "session_expired" || code === "invalid_pin" ? 401 : code === "forbidden" ? 403 : code === "too_many_attempts" || code === "too_many_orders" ? 429 : code === "insufficient_stock" || code === "invalid_status_transition" ? 409 : code === "request_failed" ? 500 : 400);
    if (status >= 500) console.error("catalog-api", { code, message, details: err.details });
    return response(req, { error: code, message: status >= 500 ? "No pudimos procesar la solicitud." : code, details: err.details }, status);
  }
});
