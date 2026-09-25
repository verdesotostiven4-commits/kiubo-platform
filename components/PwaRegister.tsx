"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    const resetLegacyWorker = async () => {
      try {
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
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch {
        // PWA is an enhancement; the application remains usable without it.
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void resetLegacyWorker();
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
