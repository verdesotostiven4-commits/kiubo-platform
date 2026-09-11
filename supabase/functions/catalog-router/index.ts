import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
const SECRET_KEY = secretKeys.default || legacySecret;
const CORE_URL = `${SUPABASE_URL}/functions/v1/catalog-api`;

if (!SUPABASE_URL || !SECRET_KEY) throw new Error("Missing Supabase runtime configuration");

const db = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const platformOrigins = new Set([
  "https://kiubo-platform.vercel.app",
  "https://kiubo-catalogos-master.vercel.app",
  "http://localhost:4173",
  "http://localhost:8000"
]);

type Json = Record<string, unknown>;
type CatalogRoute = { id: string; slug: string; public_base_url: string | null; allowed_origins: string[] | null };
type OrderItem = { product_name: string; quantity: number; line_total: number | string; item_note?: string | null };

function validSlug(value: unknown) {
  const slug = String(value ?? "").toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : "";
}

function validUuid(value: unknown) {
  const uuid = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid) ? uuid : "";
}

function normalizedOrigin(value: string) {
  if (!value) return "";
  try { return new URL(value).origin; } catch { return ""; }
}

function isSafePreflightOrigin(origin: string) {
  if (!origin) return true;
  return /^https:\/\/[^/\s]+$/.test(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin);
}

function cors(req: Request, allowOrigin = true) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-version, x-provider-session",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (allowOrigin && origin && isSafePreflightOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function response(req: Request, body: unknown, status = 200, allowOrigin = true) {
  return new Response(JSON.stringify(body), { status, headers: cors(req, allowOrigin) });
}

async function routeBySlug(slug: string): Promise<CatalogRoute | null> {
  const { data, error } = await db.from("catalog_accounts")
    .select("id,slug,public_base_url,allowed_origins")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as CatalogRoute | null;
}

function routeAllowsOrigin(route: CatalogRoute, origin: string) {
  if (!origin) return true;
  if (platformOrigins.has(origin)) return true;
  if (/^http:\/\/localhost(?::\d+)?$/.test(origin)) return true;

  const allowed = new Set((route.allowed_origins || []).map(normalizedOrigin).filter(Boolean));
  const baseOrigin = normalizedOrigin(route.public_base_url || "");
  if (baseOrigin) allowed.add(baseOrigin);
  if (allowed.has(origin)) return true;

  try {
    const base = new URL(route.public_base_url || "");
    if (base.hostname.endsWith(".vercel.app")) {
      const prefix = base.hostname.slice(0, -".vercel.app".length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`^https://${prefix}-[a-z0-9-]+\\.vercel\\.app$`).test(origin)) return true;
    }
  } catch { /* no configured base URL yet */ }
  return false;
}

function forwardHeaders(req: Request, contentType?: string) {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  for (const name of ["authorization", "x-provider-session", "x-client-version"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) headers.set("x-forwarded-for", forwarded);
  return headers;
}

function rewriteWhatsapp(value: unknown, baseUrl: string | null) {
  if (!value || !baseUrl) return value;
  try {
    const whatsapp = new URL(String(value));
    const text = whatsapp.searchParams.get("text");
    if (!text) return value;
    const base = baseUrl.replace(/\/+$/, "");
    const rewritten = text.replace(
      /Seguimiento:\s+https:\/\/[^\s]+\/pedido\?ref=/i,
      `Seguimiento: ${base}/pedido?ref=`
    );
    whatsapp.searchParams.set("text", rewritten);
    return whatsapp.toString();
  } catch { return value; }
}

function addItemNotesToWhatsapp(value: unknown, items: OrderItem[]) {
  if (!value || !items.length) return value;
  try {
    const whatsapp = new URL(String(value));
    const text = whatsapp.searchParams.get("text");
    if (!text) return value;
    const lines = text.split("\n");
    const productsIndex = lines.findIndex(line => line.trim() === "*Productos:*");
    const totalIndex = lines.findIndex((line, index) => index > productsIndex && /^\*Total estimado:\*/.test(line.trim()));
    if (productsIndex < 0 || totalIndex < 0) return value;

    const itemLines = items.flatMap(item => {
      const note = String(item.item_note || "").replace(/\s+/g, " ").trim().slice(0, 180);
      const line = `${Number(item.quantity)}× ${String(item.product_name || "Producto")} — $${Number(item.line_total || 0).toFixed(2)}`;
      return note ? [line, `   ↳ ${note}`] : [line];
    });

    lines.splice(productsIndex + 1, totalIndex - productsIndex - 1, ...itemLines, "");
    whatsapp.searchParams.set("text", lines.join("\n"));
    return whatsapp.toString();
  } catch { return value; }
}

async function enrichCreateOrderPayload(payload: Json, route: CatalogRoute) {
  payload.whatsapp_url = rewriteWhatsapp(payload.whatsapp_url, route.public_base_url);
  const order = payload.order as Json | undefined;
  const orderId = String(order?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return;

  const { data, error } = await db.from("catalog_order_items")
    .select("product_name,quantity,line_total,item_note,created_at")
    .eq("order_id", orderId)
    .order("created_at");
  if (!error && Array.isArray(data)) {
    payload.whatsapp_url = addItemNotesToWhatsapp(payload.whatsapp_url, data as OrderItem[]);
  }
}

async function enrichCatalogStock(payload: Json, route: CatalogRoute) {
  if (!Array.isArray(payload.products) || !payload.products.length) return;
  const { data, error } = await db.from("catalog_products")
    .select("id,stock_tracking,stock_quantity,low_stock_threshold")
    .eq("account_id", route.id)
    .is("archived_at", null);
  if (error || !Array.isArray(data)) return;

  const stock = new Map(data.map(item => [item.id, item]));
  payload.products = (payload.products as Json[]).map(product => {
    const inventory = stock.get(String(product.id));
    return inventory ? { ...product, ...inventory } : product;
  });
}

async function authorizeRouteActor(req: Request, route: CatalogRoute) {
  const upstream = await fetch(CORE_URL, {
    method: "POST",
    headers: forwardHeaders(req, "application/json"),
    body: JSON.stringify({ action: "provider_bootstrap", slug: route.slug })
  });
  if (!upstream.ok) return false;
  try {
    const payload = await upstream.json() as Json;
    return String((payload.account as Json | undefined)?.slug || "") === route.slug;
  } catch { return false; }
}

async function saveStock(req: Request, body: Json, route: CatalogRoute) {
  if (!(await authorizeRouteActor(req, route))) return response(req, { error: "session_expired" }, 401);

  const productId = validUuid(body.product_id);
  if (!productId) return response(req, { error: "invalid_product" }, 400);

  const tracking = body.stock_tracking === true;
  const quantity = Math.max(0, Math.min(100000000, Math.trunc(Number(body.stock_quantity || 0))));
  const threshold = Math.max(0, Math.min(100000000, Math.trunc(Number(body.low_stock_threshold ?? 5))));
  if (!Number.isFinite(quantity) || !Number.isFinite(threshold)) return response(req, { error: "invalid_stock" }, 400);

  const { data, error } = await db.from("catalog_products")
    .update({ stock_tracking: tracking, stock_quantity: quantity, low_stock_threshold: threshold, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("account_id", route.id)
    .is("archived_at", null)
    .select("id,stock_tracking,stock_quantity,low_stock_threshold,status")
    .maybeSingle();

  if (error) throw error;
  if (!data) return response(req, { error: "product_not_found" }, 404);
  return response(req, { product: data }, 200);
}

async function savePresentationImage(req: Request, body: Json, route: CatalogRoute) {
  if (!(await authorizeRouteActor(req, route))) return response(req, { error: "session_expired" }, 401);

  const presentationId = validUuid(body.presentation_id);
  const imageUrl = String(body.image_url || "").trim();
  const imagePath = String(body.image_path || "").trim();
  const accountPrefix = `${route.id}/products/`;
  let parsedUrl: URL;
  try { parsedUrl = new URL(imageUrl); } catch { return response(req, { error: "invalid_image" }, 400); }
  const publicPrefix = "/storage/v1/object/public/catalog-assets-v4/";
  if (!presentationId || !imagePath.startsWith(accountPrefix) || parsedUrl.host !== new URL(SUPABASE_URL).host || !parsedUrl.pathname.startsWith(publicPrefix) || decodeURIComponent(parsedUrl.pathname.slice(publicPrefix.length)) !== imagePath) {
    return response(req, { error: "invalid_image" }, 400);
  }

  const fileName = imagePath.slice(accountPrefix.length);
  const { data: objects, error: objectError } = await db.storage.from("catalog-assets-v4").list(`${route.id}/products`, { search: fileName, limit: 2 });
  if (objectError) throw objectError;
  if (!objects?.some(item => item.name === fileName)) return response(req, { error: "image_not_found" }, 404);

  const { data: previous, error: previousError } = await db.from("catalog_product_presentations")
    .select("id,image_path")
    .eq("id", presentationId)
    .eq("account_id", route.id)
    .maybeSingle();
  if (previousError) throw previousError;
  if (!previous) return response(req, { error: "presentation_not_found" }, 404);

  const { data, error } = await db.from("catalog_product_presentations")
    .update({ image_url: imageUrl, image_path: imagePath, updated_at: new Date().toISOString() })
    .eq("id", presentationId)
    .eq("account_id", route.id)
    .select("id,image_url,image_path")
    .maybeSingle();
  if (error) throw error;
  if (!data) return response(req, { error: "presentation_not_found" }, 404);
  const previousPath = String(previous.image_path || "");
  if (previousPath.startsWith(accountPrefix) && previousPath !== imagePath) {
    const { error: removeError } = await db.storage.from("catalog-assets-v4").remove([previousPath]);
    if (removeError) console.error("presentation image cleanup", { presentationId, previousPath, message: removeError.message });
  }
  return response(req, { ok: true, presentation: data }, 200);
}

async function forwardJson(req: Request, body: Json, route: CatalogRoute) {
  if (body.action === "save_stock") return saveStock(req, body, route);
  if (body.action === "save_presentation_image") return savePresentationImage(req, body, route);

  const upstream = await fetch(CORE_URL, {
    method: "POST",
    headers: forwardHeaders(req, "application/json"),
    body: JSON.stringify(body)
  });
  const raw = await upstream.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = { error: "invalid_upstream_response" }; }

  if (upstream.ok && payload && typeof payload === "object") {
    const json = payload as Json;
    if (body.action === "create_order") await enrichCreateOrderPayload(json, route);
    if (body.action === "catalog_bootstrap") await enrichCatalogStock(json, route);
  }

  return response(req, payload, upstream.status, true);
}

async function forwardForm(req: Request, form: FormData) {
  const upstream = await fetch(CORE_URL, {
    method: "POST",
    headers: forwardHeaders(req),
    body: form
  });
  const raw = await upstream.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = { error: "invalid_upstream_response" }; }
  return response(req, payload, upstream.status, true);
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("health") !== "1") return response(req, { error: "method_not_allowed" }, 405);
    const { count, error } = await db.from("catalog_accounts").select("id", { count: "exact", head: true });
    return response(req, {
      service: "kiubo-catalog-router",
      ready: !error,
      accounts: error ? null : count,
      inventory: true,
      checkedAt: new Date().toISOString()
    }, error ? 503 : 200);
  }

  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    return new Response("ok", { status: isSafePreflightOrigin(origin) ? 200 : 403, headers: cors(req, isSafePreflightOrigin(origin)) });
  }
  if (req.method !== "POST") return response(req, { error: "method_not_allowed" }, 405);

  const length = Number(req.headers.get("content-length") || 0);
  if (length > 6 * 1024 * 1024) return response(req, { error: "payload_too_large" }, 413);

  try {
    const contentType = req.headers.get("content-type") || "";
    const origin = req.headers.get("origin") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const slug = validSlug(form.get("slug") || "hakuna-matata");
      const route = slug ? await routeBySlug(slug) : null;
      if (!route) return response(req, { error: "account_not_found" }, 404);
      if (!routeAllowsOrigin(route, origin)) return response(req, { error: "origin_not_allowed" }, 403, false);
      return await forwardForm(req, form);
    }

    const body = await req.json() as Json;
    const slug = validSlug(body.slug || "hakuna-matata");
    const route = slug ? await routeBySlug(slug) : null;
    if (!route) return response(req, { error: "account_not_found" }, 404);
    if (!routeAllowsOrigin(route, origin)) return response(req, { error: "origin_not_allowed" }, 403, false);
    return await forwardJson(req, body, route);
  } catch (error) {
    console.error("catalog-router", error);
    return response(req, { error: "router_failed", message: "No pudimos procesar la solicitud." }, 500);
  }
});
