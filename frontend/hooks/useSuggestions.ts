"use client";

import { useEffect, useRef, useState } from "react";

import { getSuggestions } from "@/lib/api";
import type { ProviderId } from "@/types";

// Generiert Fragen-Vorschläge aus den gewählten Dokumenten — nur wenn der Chat
// leer ist (active) und mindestens eine bereite Quelle gewählt wurde.
// Der Provider wird per Ref gelesen, damit ein bloßer Modellwechsel keine neue
// (teure) Generierung auslöst; neu geladen wird nur bei geänderter Auswahl.
export function useSuggestions(
  readyIds: string[],
  provider: ProviderId | null,
  active: boolean,
) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const key = readyIds.join(",");
  useEffect(() => {
    if (!active || readyIds.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    getSuggestions(readyIds, providerRef.current, ctrl.signal)
      .then((qs) => setQuestions(qs))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // readyIds wird über `key` (stabiler String) abgedeckt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  return { questions, loading };
}
