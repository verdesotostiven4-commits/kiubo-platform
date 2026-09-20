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

function validUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
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
    payment_methods: account.payment_methods,
    payment_details: account.payment_details,
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
  const presentations = (presentationsResult.data || []).map(row => ({ ...row, image_url: imageUrl(row.image_path, row.image_url) }));
  return { account: adminAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }), categories: categoriesResult.data || [], products, presentations, orders: ordersResult.data || [], customers: customersResult.data || [] };
}

async function publicBootstrap(slug: string) {
  const account = await accountBySlug(slug);
  if (!account) throw Object.assign(new Error("account_not_found"), { status: 404 });
  const [categoriesResult, productsResult, presentationsResult] = await Promise.all([
    db.from("catalog_categories").select("id,name,icon,sort_order,visible").eq("account_id", account.id).eq("visible", true).order("sort_order").order("name"),
    db.from("catalog_products").select("id,category_id,sku,name,brand,description,unit,price,compare_at_price,status,visible,featured,image_path,image_url,sort_order,updated_at,stock_tracking,stock_quantity,low_stock_threshold,base_unit,allow_item_note").eq("account_id", account.id).eq("visible", true).is("archived_at", null).order("featured", { ascending: false }).order("sort_order").order("name"),
    db.from("catalog_product_presentations").select("id,product_id,name,unit_label,units_per_presentation,price,compare_at_price,sku,visible,is_default,sort_order,image_path,image_url,promo_active,promo_price,promo_label").eq("account_id", account.id).eq("visible", true).order("sort_order").order("name")
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (productsResult.error) throw productsResult.error;
  if (presentationsResult.error) throw presentationsResult.error;
  const categoryMap = new Map((categoriesResult.data || []).map(category => [category.id, category.name]));
  const products = (productsResult.data || []).map(product => ({ ...product, category_name: categoryMap.get(product.category_id) || null, image_url: imageUrl(product.image_path, product.image_url) }));
  const presentations = (presentationsResult.data || []).map(row => ({ ...row, image_url: imageUrl(row.image_path, row.image_url) }));
  return { account: publicAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }), categories: categoriesResult.data || [], products, presentations };
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
    if (row.cost_total != null && (!Number.isFinite(Number(row.cost_total)) || Number(row.cost_total) < 0)) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
    if (row.promo_price != null && (!Number.isFinite(Number(row.promo_price)) || Number(row.promo_price) < 0)) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
    if (row.promo_active === true && (row.promo_price == null || Number(row.promo_price) >= price)) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
  }
}

// Presentations are fully replaced on every save: rows missing an id are new,
// existing ids not present in the payload get deleted, everything else is
// upserted by id. Exactly one row is forced to be the default presentation.
async function presentationSnapshot(accountId: string, productId: string) {
  const { data, error } = await db.from("catalog_product_presentations").select("*").eq("account_id", accountId).eq("product_id", productId).order("sort_order").order("name");
  if (error) throw error;
  return (data || []).map(row => ({ ...row, image_url: imageUrl(row.image_path, row.image_url) }));
}

async function savePresentations(accountId: string, productId: string, rows: Json[]) {
  const { data, error } = await db.rpc("catalog_replace_presentations", { p_account_id: accountId, p_product_id: productId, p_rows: rows });
  if (error) throw error;
  const result = Array.isArray(data) ? data as Json[] : [];
  return result.map(row => ({ ...row, image_url: imageUrl(row.image_path, row.image_url) }));
}
function whatsappUrl(phone: string, order: Json, items: Json[], customer: Json) {
  const productLines = items.flatMap(item => {
    const presentation = cleanText(item.presentation_name, 80);
    const note = cleanText(item.item_note, 180);
    const line = `${item.quantity}× ${item.product_name}${presentation ? ` · ${presentation}` : ""} — $${Number(item.line_total).toFixed(2)}`;
    return note ? [line, `   ↳ ${note}`] : [line];
  });
  const lines = [
    `Hola, quiero confirmar el pedido *${order.order_number}*.`, "",
    `*Negocio:* ${customer.customer_business || "Cliente"}`,
    customer.customer_name ? `*Contacto:* ${customer.customer_name}` : "", "",
    "*Productos:*",
    ...productLines, "",
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
    if (!validUuid(token)) throw Object.assign(new Error("invalid_request"), { status: 400 });
    const { data: order, error } = await db.from("catalog_orders").select("id,account_id,order_number,total,status,created_at,updated_at,delivery_method,delivery_address,payment_method").eq("public_token", token).maybeSingle();
    if (error) throw error;
    if (!order) throw Object.assign(new Error("order_not_found"), { status: 404 });
    const { data: items, error: itemsError } = await db.from("catalog_order_items").select("product_name,quantity,line_total,presentation_name,item_note").eq("order_id", order.id).order("created_at");
    if (itemsError) throw itemsError;
    const { data: account } = await db.from("catalog_accounts").select("slug,name,logo_path,logo_url,accent,accent_deep,currency").eq("id", order.account_id).maybeSingle();
    const safeOrder = { ...order, items: items || [] } as Json;
    delete safeOrder.account_id;
    return { order: safeOrder, account: account ? publicAccount({ ...account, logo_url: imageUrl(account.logo_path, account.logo_url) }) : null };
  }
  if (action === "create_order") {
    const idempotency = String(body.idempotency_key || "");
    if (!validUuid(idempotency)) throw Object.assign(new Error("invalid_request"), { status: 400 });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateKey = await sha256(`${slug}|${ip}`);
    const { data: allowed, error: rateError } = await db.rpc("catalog_check_order_rate", { p_slug: slug, p_rate_key: rateKey });
    if (rateError) throw rateError;
    if (!allowed) throw Object.assign(new Error("too_many_orders"), { status: 429 });
    const customer = { ...((body.customer || {}) as Json), payment_method: body.payment_method || null };
    const { data, error } = await db.rpc("catalog_create_order", { p_slug: slug, p_idempotency_key: idempotency, p_customer: customer, p_items: body.items || [] });
    if (error) throw error;
    const order = data as Json;
    const { data: items } = await db.from("catalog_order_items").select("product_name,quantity,line_total,presentation_name,item_note").eq("order_id", order.id);
    return { order, whatsapp_url: whatsappUrl(String(order.whatsapp || ""), order, (items || []) as Json[], customer) };
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
    const presentations = presentationsInput ? await savePresentations(accountId, productId, presentationsInput) : await presentationSnapshot(accountId, productId);
    await logActivity(accountId, actor, input.id ? "product.updated" : "product.created", "product", productId);
    return { id: productId, presentations };
  }
  if (action === "save_presentations") {
    const productId = String(body.product_id || "");
    const rows = Array.isArray(body.presentations) ? body.presentations as Json[] : [];
    if (!validUuid(productId)) throw Object.assign(new Error("invalid_product"), { status: 400 });
    validatePresentationsInput(rows);
    const presentations = await savePresentations(accountId, productId, rows);
    await logActivity(accountId, actor, "presentation.saved", "product", productId, { count: presentations.length });
    return { product_id: productId, presentations };
  }
  if (action === "save_payment_settings") {
    const allowed = new Set(["cash", "transfer", "card", "credit", "other"]);
    const methods = Array.isArray(body.payment_methods) ? [...new Set((body.payment_methods as unknown[]).map(String).filter(value => allowed.has(value)))] : [];
    if (!methods.length) throw Object.assign(new Error("invalid_payment_settings"), { status: 400 });
    const raw = (body.payment_details || {}) as Json;
    const details = {
      bank_name: cleanText(raw.bank_name, 80),
      account_type: cleanText(raw.account_type, 40),
      account_number: cleanText(raw.account_number, 60),
      account_holder: cleanText(raw.account_holder, 100),
      id_number: cleanText(raw.id_number, 30)
    };
    const { data: updated, error } = await db.from("catalog_accounts").update({ payment_methods: methods, payment_details: details, updated_at: new Date().toISOString() }).eq("id", accountId).select("*").single();
    if (error) throw error;
    await logActivity(accountId, actor, "account.payment_settings_updated", "account", accountId, { payment_methods: methods });
    return { account: adminAccount(updated) };
  }
  if (action === "save_product_image") {
    const productId = String(body.product_id || "");
    if (!validUuid(productId)) throw Object.assign(new Error("invalid_product"), { status: 400 });
    const { data, error } = await db.from("catalog_products").update({
      image_url: cleanText(body.image_url, 1000),
      image_path: cleanText(body.image_path, 500),
      updated_at: new Date().toISOString()
    }).eq("id", productId).eq("account_id", accountId).is("archived_at", null).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("product_not_found"), { status: 404 });
    await logActivity(accountId, actor, "product.image_updated", "product", productId);
    return { product: { ...data, image_url: imageUrl(data.image_path, data.image_url) } };
  }
  if (action === "save_presentation_image") {
    const presentationId = String(body.presentation_id || "");
    if (!validUuid(presentationId)) throw Object.assign(new Error("invalid_presentation"), { status: 400 });
    const { data, error } = await db.from("catalog_product_presentations").update({
      image_url: cleanText(body.image_url, 1000),
      image_path: cleanText(body.image_path, 500),
      updated_at: new Date().toISOString()
    }).eq("id", presentationId).eq("account_id", accountId).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("invalid_presentation"), { status: 404 });
    await logActivity(accountId, actor, "presentation.image_updated", "presentation", presentationId);
    return { presentation: { ...data, image_url: imageUrl(data.image_path, data.image_url) } };
  }
  if (action === "save_presentation_settings") {
    const productId = String(body.product_id || "");
    if (!validUuid(productId) || !Array.isArray(body.settings)) throw Object.assign(new Error("invalid_presentations"), { status: 400 });
    const { data, error } = await db.rpc("catalog_update_presentation_settings", { p_account_id: accountId, p_product_id: productId, p_settings: body.settings as Json[] });
    if (error) throw error;
    const presentations = (Array.isArray(data) ? data as Json[] : []).map(row => ({ ...row, image_url: imageUrl(row.image_path, row.image_url) }));
    await logActivity(accountId, actor, "presentation.settings_updated", "product", productId);
    return { product_id: productId, presentations };
  }
  if (action === "product_snapshot") {
    const productId = String(body.product_id || "");
    if (!validUuid(productId)) throw Object.assign(new Error("invalid_product"), { status: 400 });
    const { data: product, error } = await db.from("catalog_products").select("*").eq("id", productId).eq("account_id", accountId).is("archived_at", null).maybeSingle();
    if (error) throw error;
    if (!product) throw Object.assign(new Error("product_not_found"), { status: 404 });
    return { product: { ...product, image_url: imageUrl(product.image_path, product.image_url) }, presentations: await presentationSnapshot(accountId, productId) };
  }
  if (action === "save_stock") {
    const productId = String(body.product_id || "");
    if (!validUuid(productId)) throw Object.assign(new Error("invalid_product"), { status: 400 });
    const tracking = body.stock_tracking === true;
    const initialized = tracking || body.stock_initialized === true;
    const quantity = Math.trunc(Number(body.stock_quantity ?? 0));
    const threshold = Math.trunc(Number(body.low_stock_threshold ?? 5));
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 100000000 || !Number.isFinite(threshold) || threshold < 0 || threshold > 100000000) {
      throw Object.assign(new Error("invalid_stock"), { status: 400 });
    }
    const baseUnit = cleanText(body.base_unit, 40, false) || "unidad";
    const allowItemNote = body.allow_item_note !== false;
    const { data: product, error } = await db.from("catalog_products").update({
      stock_tracking: tracking,
      stock_initialized: initialized,
      stock_quantity: quantity,
      low_stock_threshold: threshold,
      base_unit: baseUnit,
      allow_item_note: allowItemNote,
      updated_at: new Date().toISOString()
    }).eq("id", productId).eq("account_id", accountId).is("archived_at", null)
      .select("id,stock_tracking,stock_initialized,stock_quantity,low_stock_threshold,base_unit,allow_item_note,status")
      .maybeSingle();
    if (error) throw error;
    if (!product) throw Object.assign(new Error("product_not_found"), { status: 404 });
    await logActivity(accountId, actor, "product.stock_updated", "product", productId, { stock_tracking: tracking, stock_initialized: initialized });
    return { product };
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
    const known = ["account_not_found", "order_not_found", "catalog_closed", "invalid_request", "minimum_order", "insufficient_stock", "product_unavailable", "invalid_customer", "invalid_phone", "invalid_items", "invalid_quantity", "invalid_delivery", "invalid_pin", "too_many_attempts", "too_many_orders", "session_expired", "forbidden", "pin_must_be_4_digits", "invalid_product", "product_not_found", "invalid_presentation", "invalid_presentations", "invalid_payment_settings", "invalid_stock", "invalid_category", "invalid_status", "invalid_status_transition", "invalid_name", "invalid_color", "invalid_upload", "invalid_file", "unknown_action"];
    const code = known.find(item => message.includes(item)) || err.code || "request_failed";
    const status = err.status || (code === "account_not_found" ? 404 : code === "session_expired" || code === "invalid_pin" ? 401 : code === "forbidden" ? 403 : code === "too_many_attempts" || code === "too_many_orders" ? 429 : code === "insufficient_stock" || code === "invalid_status_transition" ? 409 : code === "request_failed" ? 500 : 400);
    if (status >= 500) console.error("catalog-api", { code, message, details: err.details });
    return response(req, { error: code, message: status >= 500 ? "No pudimos procesar la solicitud." : code, details: err.details }, status);
  }
});
