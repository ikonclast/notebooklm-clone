import { IconAlert, IconCheck, IconClose } from "@/components/icons";
import type { Toast } from "@/hooks/useToasts";

interface ToastsProps {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

export function Toasts({ toasts, dismiss }: ToastsProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[330px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in flex items-start gap-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg shadow-black/5 px-3.5 py-3"
        >
          <span
            className={
              "shrink-0 mt-px " +
              (t.type === "error" ? "text-rose-500" : "text-emerald-500")
            }
          >
            {t.type === "error" ? (
              <IconAlert className="w-5 h-5" />
            ) : (
              <IconCheck className="w-5 h-5" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-medium text-zinc-800 dark:text-zinc-100 leading-snug">
              {t.title}
            </p>
            {t.body && (
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                {t.body}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Schließen"
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
