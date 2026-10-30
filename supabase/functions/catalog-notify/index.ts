import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import webpush from "npm:web-push@3.6.7";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
type Json = Record<string, any>;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
const SECRET = keys.default || legacy;
if (!SUPABASE_URL || !SECRET) throw new Error("Missing runtime configuration");
const db = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const clean = (v: unknown, max = 800) => String(v ?? "").trim().slice(0, max);
const slugify = (v: unknown) => { const s = clean(v, 80).toLowerCase(); return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ? s : ""; };
const uuid = (v: unknown) => { const s = clean(v, 36); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s) ? s : ""; };
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, "0")).join("");
function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origin === "https://hakuna-matata-catalogo.vercel.app" || origin === "https://kiubo-catalogos-master.vercel.app" || /^https:\/\/(?:hakuna-matata-catalogo|kiubo-catalogos-master)-[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin);
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin", "access-control-allow-headers": "authorization, content-type, x-provider-session", "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "86400" });
  if (allowed) h.set("access-control-allow-origin", origin);
  return h;
}
const out = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors(req) });
function safeEndpoint(value: string) {
  try {
    const u = new URL(value), host = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      (host === "fcm.googleapis.com" || host === "android.googleapis.com" || host === "updates.push.services.mozilla.com" || host === "push.services.mozilla.com" || host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com") || host.endsWith(".notify.live.net"));
  } catch { return false; }
}
async function route(slug: string) {
  const { data, error } = await db.from("catalog_accounts").select("id,slug,name,session_version").eq("slug", slug).maybeSingle();
  if (error) throw error; return data;
}
async function providerVersion(req: Request, account: Json) {
  const token = clean(req.headers.get("x-provider-session"), 180); if (token.length < 32) return null;
  const { data, error } = await db.from("catalog_provider_sessions").select("session_version,expires_at,revoked_at").eq("token_hash", await sha256(token)).eq("account_id", account.id).maybeSingle();
  if (error) throw error;
  return data && !data.revoked_at && new Date(data.expires_at).getTime() > Date.now() && Number(data.session_version) === Number(account.session_version) ? Number(data.session_version) : null;
}
async function internal(req: Request, accountId: string) {
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${SECRET}`) return true;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.length < 32 || token.length > 180) return false;
  const { data, error } = await db.from("catalog_notification_workers").select("token_hash").eq("account_id", accountId).maybeSingle();
  if (error || !data?.token_hash) return false;
  const actual = await sha256(token), expected = String(data.token_hash);
  if (actual.length !== expected.length) return false;
  let diff = 0; for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
async function config(accountId: string) {
  const { data, error } = await db.from("catalog_push_config").select("vapid_public_key,vapid_private_key,subject").eq("account_id", accountId).maybeSingle();
  if (error) throw error; return data;
}
function background(task: Promise<unknown>) { EdgeRuntime.waitUntil(task.catch(error => console.error("catalog-notify dispatch", { message: String(error) }))); }
const statusText: Record<string, string> = { new: "recibido", confirmed: "confirmado", preparing: "en preparación", dispatched: "despachado", delivered: "entregado", cancelled: "cancelado" };
const JOB_MAX_AGE_MS = 24 * 60 * 60_000;
function subscriberRetryMs(attempts: unknown) {
  // Waiting for a customer to opt in should not cause a database/worker call
  // every minute forever. A later subscription explicitly wakes pending jobs.
  const n = Math.max(1, Number(attempts) || 1);
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.min(n - 1, 6));
}
function message(job: Json, order: Json) {
  if (job.audience === "provider") return { title: "Nuevo pedido en Hakuna", body: `${order.customer_business || order.customer_name || "Cliente"} · ${order.order_number} · $${Number(order.total || 0).toFixed(2)}`, tag: `hakuna-provider-${order.id}`, url: "/panel" };
  const body = job.kind === "return" ? "Se registró una devolución en tu pedido." : job.kind === "edit" ? "Tu pedido fue actualizado. Revisa los cambios." : job.kind === "created" ? "Recibimos tu pedido. Toca para seguirlo." : `Tu pedido está ${statusText[order.status] || "actualizado"}.`;
  return { title: `Pedido ${order.order_number}`, body, tag: `hakuna-${order.id}`, url: `/pedido?ref=${order.public_token}` };
}
async function setJob(job: Json, status: "sent" | "pending", delayMs = 0, reason = "") {
  const now = Date.now();
  const { error } = await db.from("catalog_notification_jobs").update({ status, locked_until: null, available_at: new Date(now + delayMs).toISOString(), sent_at: status === "sent" ? new Date(now).toISOString() : null, last_error: reason.slice(0, 200) || null }).eq("event_key", job.event_key).eq("status", "processing");
  if (error) throw error;
}
async function dispatch(account: Json) {
  const { data: jobs, error } = await db.rpc("catalog_claim_notification_jobs", { p_account_id: account.id, p_limit: 20 });
  if (error) throw error;
  const cfg = await config(account.id);
  let processed = 0;
  for (const job of jobs || []) {
    try {
      const createdAt = Date.parse(String(job.created_at || ""));
      if (Number.isFinite(createdAt) && Date.now() - createdAt >= JOB_MAX_AGE_MS) {
        await setJob(job, "sent", 0, "notification_expired"); continue;
      }
      const { data: order, error: orderError } = await db.from("catalog_orders").select("id,public_token,order_number,status,revision,customer_business,customer_name,total").eq("id", job.order_id).eq("account_id", account.id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) { await setJob(job, "sent", 0, "superseded"); continue; }
      // A later payment edit also increments the revision, but it must not
      // suppress a confirmation while the order is still confirmed.
      let superseded = job.audience === "provider" && order.status !== "new";
      if (job.audience === "customer" && Number(job.revision) < Number(order.revision)) {
        if (job.kind === "created") superseded = order.status !== "new";
        else if (job.kind === "edit") superseded = order.status !== "new";
        else if (job.kind === "return") superseded = order.status !== "delivered";
        else if (job.kind === "status") {
          const { data: change, error: changeError } = await db.from("catalog_order_revisions").select("after_state").eq("order_id", order.id).eq("revision", job.revision).maybeSingle();
          if (changeError) throw changeError;
          superseded = !change || change.after_state?.order?.status !== order.status;
        }
      }
      if (superseded) { await setJob(job, "sent", 0, "superseded"); continue; }
      if (!cfg?.vapid_public_key || !cfg?.vapid_private_key || !cfg?.subject) { await setJob(job, "pending", 30 * 60_000, "push_not_configured"); continue; }
      let query = db.from("catalog_push_subscriptions").select("id,endpoint,p256dh,auth,provider_session_version").eq("account_id", account.id).eq("active", true);
      if (job.audience === "provider") query = query.eq("provider_enabled", true).eq("provider_session_version", account.session_version);
      else {
        const { data: bindings, error: bindingError } = await db.from("catalog_push_order_bindings").select("subscription_id").eq("account_id", account.id).eq("order_id", order.id);
        if (bindingError) throw bindingError;
        const ids = (bindings || []).map((x: Json) => x.subscription_id);
        if (!ids.length) { await setJob(job, "pending", subscriberRetryMs(job.attempts), "no_subscribers"); continue; }
        query = query.eq("customer_enabled", true).in("id", ids);
      }
      const { data: subscribers, error: subError } = await query; if (subError) throw subError;
      if (!subscribers?.length) { await setJob(job, "pending", subscriberRetryMs(job.attempts), "no_subscribers"); continue; }
      const { data: delivered, error: deliveredError } = await db.from("catalog_notification_deliveries").select("subscription_id").eq("event_key", job.event_key);
      if (deliveredError) throw deliveredError;
      const already = new Set((delivered || []).map((x: Json) => x.subscription_id)); let temporaryFailures = 0;
      for (const sub of subscribers) {
        if (already.has(sub.id)) continue;
        if (!safeEndpoint(sub.endpoint)) { await db.from("catalog_push_subscriptions").update({ active: false }).eq("id", sub.id); continue; }
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(message(job, order)), { TTL: 3600, urgency: "high", vapidDetails: { subject: cfg.subject, publicKey: cfg.vapid_public_key, privateKey: cfg.vapid_private_key } });
          const { error: saveError } = await db.from("catalog_notification_deliveries").upsert({ event_key: job.event_key, subscription_id: sub.id }, { onConflict: "event_key,subscription_id", ignoreDuplicates: true });
          if (saveError) throw saveError;
        } catch (err: any) {
          const code = Number(err?.statusCode || 0);
          if (code === 404 || code === 410) await db.from("catalog_push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("id", sub.id);
          else temporaryFailures++;
        }
      }
      await setJob(job, temporaryFailures ? "pending" : "sent", temporaryFailures ? Math.min(30 * 60_000, 30_000 * 2 ** Math.min(Number(job.attempts || 1), 6)) : 0, temporaryFailures ? "temporary_push_failure" : "");
      processed++;
    } catch (error) {
      console.error("catalog-notify job", { event: job.event_key, message: String(error) });
      try { await setJob(job, "pending", 60_000, "processing_failed"); } catch { /* lease expires and can be claimed again */ }
    }
  }
  return { processed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return out(req, { error: "method_not_allowed" }, 405);
  try {
    const body = await req.json() as Json, slug = slugify(body.slug || "hakuna-matata");
    if (!slug) return out(req, { error: "invalid_slug" }, 400);
    const account = await route(slug); if (!account) return out(req, { error: "account_not_found" }, 404);
    const action = String(body.action || "");
    if (action === "public_key") { const cfg = await config(account.id); return out(req, { public_key: cfg?.vapid_public_key || null }); }
    if (action === "subscribe") {
      const sub = body.subscription && typeof body.subscription === "object" ? body.subscription : {};
      const endpoint = clean(sub.endpoint, 1800), p256dh = clean(sub.keys?.p256dh, 300), auth = clean(sub.keys?.auth, 200), audience = String(body.audience || "customer");
      if (!safeEndpoint(endpoint) || p256dh.length < 30 || auth.length < 10 || !["customer", "provider"].includes(audience)) return out(req, { error: "invalid_subscription" }, 400);
      const version = audience === "provider" ? await providerVersion(req, account) : null;
      if (audience === "provider" && version === null) return out(req, { error: "session_expired" }, 401);
      const { data, error } = await db.rpc("catalog_register_push_subscription", { p_slug: slug, p_audience: audience, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: clean(req.headers.get("user-agent"), 500), p_provider_version: version });
      if (error) throw error;
      if (audience === "provider") {
        await db.from("catalog_notification_jobs").update({ available_at: new Date().toISOString() }).eq("account_id", account.id).eq("audience", "provider").eq("status", "pending");
        background(dispatch(account));
      }
      return out(req, { ok: true, subscription_id: data.subscription_id });
    }
    if (action === "bind_order") {
      const id = uuid(body.subscription_id), token = uuid(body.order_public_token); let endpoint = clean(body.endpoint, 1800);
      if (!id || !token) return out(req, { error: "invalid_request" }, 400);
      // Older installed clients used the unguessable subscription id and order
      // token; keep them functional while they update to send their endpoint.
      if (!endpoint) {
        const { data } = await db.from("catalog_push_subscriptions").select("endpoint").eq("id", id).eq("account_id", account.id).eq("customer_enabled", true).maybeSingle();
        endpoint = data?.endpoint || "";
      }
      if (!safeEndpoint(endpoint)) return out(req, { error: "invalid_subscription" }, 400);
      const { error } = await db.rpc("catalog_bind_push_order", { p_slug: slug, p_subscription_id: id, p_endpoint: endpoint, p_order_public_token: token });
      if (error) return out(req, { error: "binding_failed" }, 400);
      const { data: order } = await db.from("catalog_orders").select("id").eq("account_id", account.id).eq("public_token", token).maybeSingle();
      if (order) await db.from("catalog_notification_jobs").update({ available_at: new Date().toISOString() }).eq("order_id", order.id).eq("audience", "customer").eq("status", "pending");
      background(dispatch(account)); return out(req, { ok: true });
    }
    if (action === "unsubscribe") {
      const endpoint = clean(body.endpoint, 1800);
      if (safeEndpoint(endpoint)) await db.from("catalog_push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("account_id", account.id).eq("endpoint", endpoint);
      return out(req, { ok: true });
    }
    if (!(await internal(req, account.id))) return out(req, { error: "forbidden" }, 403);
    if (action === "dispatch") return out(req, { ok: true, ...(await dispatch(account)) });
    // Compatibility while an older catalog-api version is running.
    if (action === "notify_provider" || action === "notify_customer") {
      const id = uuid(body.order_id); if (!id) return out(req, { error: "invalid_order" }, 400);
      const { data: order } = await db.from("catalog_orders").select("id").eq("id", id).eq("account_id", account.id).maybeSingle();
      if (!order) return out(req, { error: "order_not_found" }, 404);
      const { error } = await db.rpc("catalog_queue_order_notification", { p_order_id: id, p_kind: action === "notify_provider" ? "created" : "status" });
      if (error) throw error;
      return out(req, { ok: true, ...(await dispatch(account)) });
    }
    return out(req, { error: "unknown_action" }, 400);
  } catch (error) {
    console.error("catalog-notify", { message: String(error) });
    return out(req, { error: "notify_failed" }, 500);
  }
});
