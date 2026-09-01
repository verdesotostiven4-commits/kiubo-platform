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

async function forwardJson(req: Request, body: Json, route: CatalogRoute) {
  const upstream = await fetch(CORE_URL, {
    method: "POST",
    headers: forwardHeaders(req, "application/json"),
    body: JSON.stringify(body)
  });
  const raw = await upstream.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = { error: "invalid_upstream_response" }; }
  if (upstream.ok && body.action === "create_order" && payload && typeof payload === "object") {
    await enrichCreateOrderPayload(payload as Json, route);
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
