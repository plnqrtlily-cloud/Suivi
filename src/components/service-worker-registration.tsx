"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencieux : l'absence de service worker ne doit jamais bloquer l'usage
        // normal de l'app, seulement l'installation en PWA.
      });
    }
  }, []);
  return null;
}
