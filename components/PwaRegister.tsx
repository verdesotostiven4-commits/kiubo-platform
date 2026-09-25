"use client";
import { useEffect } from "react";

const RESET_KEY = "kiubo.pwa.cache-reset.v3";
const RECOVERY_KEY = "kiubo.bundle-recovery.v1";
const SW_URL = "/sw.js?v=8";

function isAssetFailure(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return /ChunkLoadError|Loading chunk|dynamically imported module|CSS_CHUNK_LOAD_FAILED|page couldn't load|failed to fetch/i.test(message);
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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

    const resetLegacyWorker = async () => {
      try {
        // Remove old workers and only the shell caches. User data lives in
        // localStorage and is deliberately left untouched.
        const hadController = Boolean(navigator.serviceWorker.controller);
        await clearAppShell();

        // If an old worker was controlling this page, reload once so the
        // browser can leave the stale bundle before continuing.
        if (hadController && window.sessionStorage.getItem(RESET_KEY) !== "1") {
          window.sessionStorage.setItem(RESET_KEY, "1");
          window.location.reload();
          return;
        }

        window.sessionStorage.removeItem(RESET_KEY);
        // Re-enable the PWA after the migration. updateViaCache:none prevents
        // the browser from reusing an old service-worker script.
        await navigator.serviceWorker.register(SW_URL, { updateViaCache: "none" });
      } catch {
        // PWA is an enhancement; the application remains usable without it.
      }
    };

    void resetLegacyWorker();
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
