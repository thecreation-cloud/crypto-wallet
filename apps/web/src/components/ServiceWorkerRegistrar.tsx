"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
