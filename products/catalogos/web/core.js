const config = window.KIUBO_CATALOG_CONFIG;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function money(value, currency = "USD") {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

export function slugFromLocation() {
  const querySlug = new URLSearchParams(location.search).get("slug");
  const match = location.pathname.match(/^\/c\/([^/]+)/);
  return (querySlug || match?.[1] || config.defaultSlug).toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function initials(value = "") {
  return String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "HM";
}

export function productColor(product) {
  const colors = ["#d47749", "#b68545", "#5b8a6d", "#5e7897", "#8f6e98", "#c35f61", "#9a884b"];
  const input = `${product.category_id || ""}${product.name || ""}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export async function api(action, payload = {}, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 18000);
  const headers = { "Content-Type": "application/json", "X-Client-Version": config.version };
  if (options.providerToken) headers["X-Provider-Session"] = options.providerToken;
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({ error: "invalid_response" }));
    if (!response.ok) {
      const error = new Error(result.message || result.error || "request_failed");
      error.code = result.error || "request_failed";
      error.status = response.status;
      error.details = result.details;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("timeout");
      timeoutError.code = "timeout";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadApi(action, file, fields = {}, options = {}) {
  const form = new FormData();
  form.append("action", action);
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value ?? "")));
  const headers = { "X-Client-Version": config.version };
  if (options.providerToken) headers["X-Provider-Session"] = options.providerToken;
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  const response = await fetch(config.apiUrl, { method: "POST", headers, body: form });
  const result = await response.json().catch(() => ({ error: "invalid_response" }));
  if (!response.ok) {
    const error = new Error(result.message || result.error || "upload_failed");
    error.code = result.error || "upload_failed";
    throw error;
  }
  return result;
}

export function toast(message, type = "default", duration = 2600) {
  const stack = $("#toastStack");
  if (!stack) return;
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.append(item);
  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(8px)";
    setTimeout(() => item.remove(), 200);
  }, duration);
}

export function vibrate(pattern = 10) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function debounce(fn, wait = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function uid() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return `593${digits.slice(1)}`;
  return digits.length === 9 ? `593${digits}` : digits;
}

export function formatDate(value, withTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-EC", withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }
  ).format(new Date(value));
}

export function safeStorage(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return fallback; }
}

export function saveStorage(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* quota or privacy mode */ }
}

export { config };
