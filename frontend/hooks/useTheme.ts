"use client";

import { useEffect, useState } from "react";

/**
 * Liest das initiale Theme aus der <html>-Klasse (vom No-Flash-Script gesetzt)
 * und persistiert Wechsel in localStorage.
 */
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {
        /* localStorage nicht verfügbar — Theme bleibt nur für die Session */
      }
      return next;
    });
  };

  return { dark, toggle };
}
