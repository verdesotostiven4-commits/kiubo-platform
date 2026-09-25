"use client";
import { useEffect } from "react";

const RESET_KEY = "kiubo.pwa.cache-reset.v3";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const resetLegacyWorker = async () => {
      try {
        // Remove old workers and only the shell caches. User data lives in
        // localStorage and is deliberately left untouched.
        const hadController = Boolean(navigator.serviceWorker.controller);
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

        // If an old worker was controlling this page, reload once so the
        // browser can leave the stale bundle before continuing.
        if (hadController && window.sessionStorage.getItem(RESET_KEY) !== "1") {
          window.sessionStorage.setItem(RESET_KEY, "1");
          window.location.reload();
          return;
        }

        window.sessionStorage.removeItem(RESET_KEY);
        // Keep the application network loaded while the deployment is being
        // stabilized. This avoids mixing chunks from different deployments.
      } catch {
        // PWA is an enhancement; the application remains usable without it.
      }
    };

    void resetLegacyWorker();
  }, []);

  return null;
}
