"use client";

import { useRef, useState } from "react";

import {
  IconAlert,
  IconCheck,
  IconClose,
  IconDoc,
  IconTrash,
  IconUpload,
  Spinner,
} from "@/components/icons";
import { STAGE_LABEL } from "@/lib/labels";
import type { JobStatus } from "@/types";

// Leading-Slot: auswählbare Checkbox (ready) oder Status-Glyph (sonst)
function LeadingSlot({
  doc,
  selected,
  onToggle,
}: {
  doc: JobStatus;
  selected: boolean;
  onToggle: () => void;
}) {
  if (doc.status === "ready") {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? "Quelle abwählen" : "Quelle für Chat auswählen"}
        className={
          "shrink-0 w-[18px] h-[18px] mt-0.5 rounded-[6px] grid place-items-center transition-all duration-150 " +
          (selected
            ? "bg-accent-600 border border-accent-600 text-white shadow-sm"
            : "border border-zinc-300 dark:border-zinc-600 text-transparent hover:border-accent-500 dark:hover:border-accent-500")
        }
      >
        <IconCheck className="w-3 h-3" />
      </button>
    );
  }
  if (doc.status === "processing")
    return (
      <span className="shrink-0 mt-0.5 text-accent-600 dark:text-accent-400">
        <Spinner className="w-[18px] h-[18px]" />
      </span>
    );
  if (doc.status === "failed")
    return (
      <span className="shrink-0 mt-0.5 w-[18px] h-[18px] grid place-items-center text-rose-500">
        <IconAlert className="w-[17px] h-[17px]" />
      </span>
    );
  // pending
  return (
    <span className="shrink-0 mt-[7px] ml-[3px] mr-[3px] w-3 h-3 rounded-full border-[1.5px] border-zinc-300 dark:border-zinc-600" />
  );
}

function StatusLine({ doc }: { doc: JobStatus }) {
  const meta = "text-[12px] leading-tight";
  if (doc.status === "ready")
    return (
      <span className={meta + " flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Bereit · {doc.pages > 0 ? `${doc.pages} S.` : "Text"} · {doc.chunks} Abschnitte
      </span>
    );
  if (doc.status === "processing")
    return (
      <span className={meta + " text-accent-600 dark:text-accent-400 font-medium"}>
        {(doc.stage && STAGE_LABEL[doc.stage]) || "Wird verarbeitet…"}
      </span>
    );
  if (doc.status === "pending")
    return <span className={meta + " text-zinc-400 dark:text-zinc-500"}>In Warteschlange</span>;
  if (doc.status === "failed")
    return (
      <span className={meta + " text-rose-600 dark:text-rose-400"}>{doc.error_message}</span>
    );
  return null;
}

function SourceItem({
  doc,
  selected,
  onToggle,
  onDelete,
}: {
  doc: JobStatus;
  selected: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const clickable = doc.status === "ready";
  return (
    <li
      onClick={() => clickable && onToggle()}
      className={
        "group relative flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors duration-150 " +
        (clickable ? "cursor-pointer " : "cursor-default ") +
        (selected
          ? "bg-accent-50 dark:bg-accent-600/10 ring-1 ring-inset ring-accent-200 dark:ring-accent-500/30"
          : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50")
      }
    >
      <LeadingSlot doc={doc} selected={selected} onToggle={onToggle} />
      <span
        className={
          "shrink-0 mt-0.5 " +
          (doc.status === "failed"
            ? "text-zinc-400 dark:text-zinc-600"
            : "text-zinc-500 dark:text-zinc-400")
        }
      >
        <IconDoc className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={
            "text-[13.5px] font-medium leading-snug truncate " +
            (doc.status === "failed"
              ? "text-zinc-500 dark:text-zinc-500"
              : "text-zinc-800 dark:text-zinc-100")
          }
          title={doc.filename}
        >
          {doc.filename}
        </div>
        <div className="mt-0.5">
          <StatusLine doc={doc} />
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(doc.document_id);
        }}
        aria-label="Quelle löschen"
        className="shrink-0 -mr-1 mt-px p-1.5 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
      >
        <IconTrash className="w-[16px] h-[16px]" />
      </button>
    </li>
  );
}

function UploadZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="px-3 pt-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={
          "group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center cursor-pointer transition-all duration-150 " +
          (over
            ? "border-accent-500 bg-accent-50 dark:bg-accent-600/10 scale-[.99]"
            : "border-zinc-300 dark:border-zinc-700 hover:border-accent-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40")
        }
      >
        <span
          className={
            "grid place-items-center w-9 h-9 rounded-full transition-colors " +
            (over
              ? "bg-accent-600 text-white"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:text-accent-600")
          }
        >
          <IconUpload className="w-[18px] h-[18px]" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
            Datei hierher ziehen oder{" "}
            <span className="text-accent-600 dark:text-accent-400">auswählen</span>
          </div>
          <div className="text-[11.5px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            PDF oder TXT · max. 20 MB
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function EmptySources() {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto w-11 h-11 grid place-items-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-3">
        <IconDoc className="w-5 h-5" />
      </div>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-balance">
        Noch keine Quellen — lade ein PDF oder TXT hoch, um zu starten.
      </p>
    </div>
  );
}

interface SidebarProps {
  docs: JobStatus[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: (id: string) => void;
  onFiles: (files: FileList) => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({
  docs,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onFiles,
  onClose,
  isMobile,
}: SidebarProps) {
  const readyCount = docs.filter((d) => d.status === "ready").length;
  const allReadySelected = readyCount > 0 && selectedIds.length >= readyCount;
  return (
    <aside className="h-full flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Quellen
          </h2>
          {docs.length > 0 && (
            <span className="text-[12px] text-zinc-400 dark:text-zinc-600">{docs.length}</span>
          )}
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-1.5 -mr-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconClose className="w-5 h-5" />
          </button>
        )}
      </div>

      <UploadZone onFiles={onFiles} />

      {/* Alle auswählen/abwählen — direkt unter dem Upload, immer sichtbar
          (scrollt nicht mit der Quellenliste weg). */}
      {readyCount > 0 && (
        <div className="px-3 pt-2.5">
          <button
            onClick={allReadySelected ? onDeselectAll : onSelectAll}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-3 py-2 text-[12.5px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-accent-300 dark:hover:border-accent-500/40 hover:text-accent-700 dark:hover:text-accent-300 hover:bg-accent-50/50 dark:hover:bg-accent-600/10 transition-colors"
          >
            <IconCheck className="w-3.5 h-3.5" />
            {allReadySelected ? "Alle abwählen" : "Alle auswählen"}
          </button>
        </div>
      )}

      {docs.length > 0 ? (
        <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 min-h-0">
          {docs.map((d) => (
            <SourceItem
              key={d.document_id}
              doc={d}
              selected={selectedIds.includes(d.document_id)}
              onToggle={() => onToggleSelect(d.document_id)}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : (
        <div className="flex-1 min-h-0">
          <EmptySources />
        </div>
      )}

      {docs.length > 0 && (
        <div className="px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 text-[11.5px] text-zinc-400 dark:text-zinc-500">
          {selectedIds.length > 0 ? (
            <span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {selectedIds.length}
              </span>{" "}
              von {readyCount} ausgewählt
            </span>
          ) : (
            <span>Wähle Quellen für den Chat aus</span>
          )}
        </div>
      )}
    </aside>
  );
}
