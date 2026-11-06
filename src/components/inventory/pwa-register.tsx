"use client";

import { useEffect } from "react";

/** Регистрация service worker для офлайн-режима и установки на гл. экран. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      // NEXT_PUBLIC_BASE_PATH инлайнится на этапе сборки (GitHub Pages)
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => undefined);
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
