import { IconMenu, IconMoon, IconSun, Logo } from "@/components/icons";
import { ProviderSwitcher } from "@/components/ProviderSwitcher";
import type { ProviderId, ProviderInfo } from "@/types";

interface HeaderProps {
  dark: boolean;
  onToggleDark: () => void;
  onMenu: () => void;
  onReset: () => void;
  providers: ProviderInfo[];
  selectedProvider: ProviderId | null;
  onSelectProvider: (id: ProviderId) => void;
}

export function Header({
  dark,
  onToggleDark,
  onMenu,
  onReset,
  providers,
  selectedProvider,
  onSelectProvider,
}: HeaderProps) {
  return (
    <header className="shrink-0 flex items-center justify-between h-14 px-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenu}
          aria-label="Quellen öffnen"
          className="md:hidden -ml-1 p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <IconMenu className="w-5 h-5" />
        </button>
        <button
          onClick={onReset}
          aria-label="Zum Start — neuer Chat"
          title="Zum Start"
          className="flex items-center gap-2.5 rounded-lg -ml-1 px-1 py-0.5 hover:opacity-80 transition-opacity"
        >
          <Logo className="w-6 h-6" />
          <span className="text-[15px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
            NotebookLM <span className="font-normal text-zinc-400 dark:text-zinc-500">Clone</span>
          </span>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <ProviderSwitcher
          providers={providers}
          selected={selectedProvider}
          onSelect={onSelectProvider}
        />
        <button
          onClick={onToggleDark}
          aria-label="Theme wechseln"
          className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {dark ? <IconSun className="w-[18px] h-[18px]" /> : <IconMoon className="w-[18px] h-[18px]" />}
        </button>
      </div>
    </header>
  );
}
