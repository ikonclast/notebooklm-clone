"use client";

import { Header } from "@/components/Header";
import { useTheme } from "@/hooks/useTheme";

// Shell (Block 9). Sidebar und Chat folgen in Block 10/11.
export function App() {
  const { dark, toggle } = useTheme();

  return (
    <div className="h-full flex flex-col">
      <Header dark={dark} onToggleDark={toggle} onMenu={() => {}} />

      <div className="flex-1 flex min-h-0">
        <div className="hidden md:block w-[304px] shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="p-4 text-[13px] text-zinc-400 dark:text-zinc-500">Quellen</div>
        </div>

        <main className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900">
          <div className="flex-1 grid place-items-center text-[13px] text-zinc-400 dark:text-zinc-500">
            Chat
          </div>
        </main>
      </div>
    </div>
  );
}
