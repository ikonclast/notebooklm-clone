"use client";

import { useState } from "react";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Toasts } from "@/components/Toasts";
import { useDocuments } from "@/hooks/useDocuments";
import { useTheme } from "@/hooks/useTheme";
import { useToasts } from "@/hooks/useToasts";

export function App() {
  const { dark, toggle } = useTheme();
  const { toasts, toast, dismiss } = useToasts();
  const { docs, uploadFiles, remove } = useDocuments({
    onError: (title, body) => toast("error", title, body),
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);

  const onToggleSelect = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onDelete = (id: string) => {
    remove(id);
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  const sidebar = (isMobile = false) => (
    <Sidebar
      docs={docs}
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onDelete={onDelete}
      onFiles={uploadFiles}
      isMobile={isMobile}
      onClose={() => setDrawer(false)}
    />
  );

  return (
    <div className="h-full flex flex-col">
      <Header dark={dark} onToggleDark={toggle} onMenu={() => setDrawer(true)} />

      <div className="flex-1 flex min-h-0">
        <div className="hidden md:block w-[304px] shrink-0">{sidebar()}</div>

        <main className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900">
          <div className="flex-1 grid place-items-center text-[13px] text-zinc-400 dark:text-zinc-500">
            Chat folgt (Block 11) · {selectedIds.length} Quelle(n) ausgewählt
          </div>
        </main>
      </div>

      {drawer && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={() => setDrawer(false)}
          />
          <div
            className="absolute inset-y-0 left-0 w-[86%] max-w-[330px] shadow-2xl"
            style={{ animation: "fade-up .25s both" }}
          >
            {sidebar(true)}
          </div>
        </div>
      )}

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
