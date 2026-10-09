"use client";
import { useEffect } from "react";

const RECOVERY_KEY = "kiubo.bundle-recovery.v2";
const SW_URL = "/sw.js?v=10";
const CANONICAL_HOST = "kiubo-platform.vercel.app";

function isKiuboPreviewHost(host: string) {
  return host !== CANONICAL_HOST && host.includes("kiubo-platform") && host.endsWith(".vercel.app");
}

function isAssetFailure(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  // A general fetch failure may be a temporary loss of connectivity. Keep
  // the offline worker and database intact instead of unregistering it.
  return /ChunkLoadError|Loading chunk|dynamically imported module|CSS_CHUNK_LOAD_FAILED|page couldn't load/i.test(message);
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // A PWA installed from a Vercel deployment URL is permanently tied to
    // that old deployment. Move it to the public production origin so future
    // releases and Cloud synchronization reach the same application.
    const host = window.location.hostname;
    if (isKiuboPreviewHost(host)) {
      const canonical = new URL(window.location.href);
      canonical.protocol = window.location.protocol;
      canonical.hostname = CANONICAL_HOST;
      canonical.port = "";
      window.location.replace(canonical.toString());
      return;
    }

    const clearAppShell = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(key => key.startsWith("kiubo-shell-"))
            .map(key => caches.delete(key))
        );
      }
    };

    const recoverFromStaleAssets = async () => {
      try {
        if (!navigator.onLine) return;
        const alreadyRecovered = window.sessionStorage.getItem(RECOVERY_KEY) === "1";
        if (alreadyRecovered) return;
        window.sessionStorage.setItem(RECOVERY_KEY, "1");
        await clearAppShell();
        const url = new URL(window.location.href);
        url.searchParams.set("kiubo_asset_recovery", String(Date.now()));
        window.location.replace(url.toString());
      } catch {
        // If storage is blocked, a regular reload is still safer than a broken shell.
        window.location.reload();
      }
    };

    const onWindowError = (event: ErrorEvent) => {
      if (isAssetFailure(event.error) || isAssetFailure(event.message)) {
        void recoverFromStaleAssets();
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isAssetFailure(event.reason)) void recoverFromStaleAssets();
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    // Keep the recovery URL out of normal navigation/history after the fresh
    // shell has loaded. The session guard stays briefly to prevent a reload
    // loop if the deployment itself is still unhealthy.
    const recoveryUrl = new URL(window.location.href);
    if (recoveryUrl.searchParams.has("kiubo_asset_recovery")) {
      recoveryUrl.searchParams.delete("kiubo_asset_recovery");
      window.history.replaceState({}, "", recoveryUrl.pathname + recoveryUrl.search + recoveryUrl.hash);
      window.setTimeout(() => window.sessionStorage.removeItem(RECOVERY_KEY), 15_000);
    }

    const registerWorker = async () => {
      try {
        // Registering the same scope updates an old worker in place. The
        // worker activates with skipWaiting/clients.claim and clears obsolete
        // shell caches itself, so a normal F5 must never force a second reload.
        await navigator.serviceWorker.register(SW_URL, { updateViaCache: "none" });
      } catch {
        // PWA is an enhancement; the application remains usable without it.
      }
    };

    void registerWorker();
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
