"use client";

import { useEffect, useRef, useState } from "react";

import { IconCheck, IconChevron } from "@/components/icons";
import type { ProviderId, ProviderInfo } from "@/types";

interface Props {
  providers: ProviderInfo[];
  selected: ProviderId | null;
  onSelect: (id: ProviderId) => void;
}

export function ProviderSwitcher({ providers, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Klick außerhalb schließt das Menü.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (providers.length === 0) return null;

  const current = providers.find((p) => p.id === selected) ?? null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 pl-2.5 pr-2 py-1.5 text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-medium max-w-[120px] truncate">
          {current ? current.label : "Modell wählen"}
        </span>
        <IconChevron
          className={"w-3.5 h-3.5 text-zinc-400 transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-60 z-50 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg dark:shadow-black/40 p-1 animate-fade-up"
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Antwort-Modell
          </p>
          {providers.map((p) => {
            const isSelected = p.id === selected;
            return (
              <button
                key={p.id}
                role="option"
                aria-selected={isSelected}
                disabled={!p.available}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors " +
                  (p.available
                    ? "hover:bg-zinc-100 dark:hover:bg-zinc-700/60 cursor-pointer"
                    : "opacity-50 cursor-not-allowed")
                }
              >
                <span className="w-4 shrink-0 text-accent-600 dark:text-accent-400">
                  {isSelected && <IconCheck className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-100 truncate">
                    {p.label}
                  </span>
                  <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
                    {p.model}
                  </span>
                </span>
                {!p.available && (
                  <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {p.id === "ollama" ? "offline" : "kein Key"}
                  </span>
                )}
              </button>
            );
          })}
          <p className="px-2.5 pt-1.5 pb-1.5 text-[10.5px] text-zinc-400 dark:text-zinc-500 leading-snug">
            Cloud-Modelle senden Inhalte an US-Server (DSGVO: AVV nötig).
          </p>
        </div>
      )}
    </div>
  );
}
