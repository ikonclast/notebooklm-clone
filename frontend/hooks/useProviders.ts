"use client";

import { useEffect, useState } from "react";

import { getProviders } from "@/lib/api";
import type { ProviderId, ProviderInfo } from "@/types";

// Lädt die verfügbaren LLM-Provider einmal und hält die aktuelle Auswahl.
// Vorauswahl: Server-Default falls verfügbar, sonst der erste verfügbare.
export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selected, setSelected] = useState<ProviderId | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProviders()
      .then((res) => {
        if (cancelled) return;
        setProviders(res.providers);
        const pick =
          res.providers.find((p) => p.id === res.default && p.available) ??
          res.providers.find((p) => p.available);
        setSelected(pick ? pick.id : null);
      })
      .catch(() => {
        /* ohne Provider-Liste rendert die UI weiter, nur ohne Umschalter */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { providers, selected, setSelected };
}
