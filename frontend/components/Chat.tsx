"use client";

import { useEffect, useRef, useState } from "react";

import {
  IconAlert,
  IconChevron,
  IconDoc,
  IconQuote,
  IconRetry,
  IconSearch,
  IconSend,
  IconStop,
  Logo,
} from "@/components/icons";
import { EXAMPLE_QUESTIONS } from "@/lib/labels";
import type { ChatMessage, Source } from "@/types";

// **fett** innerhalb des Antworttexts rendern
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-zinc-900 dark:text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
      <span className="w-8 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <span
          className="block h-full bg-accent-500/70 dark:bg-accent-400/70"
          style={{ width: Math.round(score * 100) + "%" }}
        />
      </span>
      {Math.round(score * 100)}%
    </span>
  );
}

function ExcerptCard({ src }: { src: Source }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/70 bg-zinc-50/80 dark:bg-zinc-800/40 overflow-hidden animate-expand">
      <div className="flex items-start gap-2.5 px-3.5 pt-3 pb-2">
        <span className="shrink-0 mt-px text-accent-500/70 dark:text-accent-400/60">
          <IconQuote className="w-4 h-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          {src.excerpt}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-zinc-200/70 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-900/30">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400 min-w-0">
          <span className="truncate">{src.filename}</span>
          <span className="text-zinc-400 dark:text-zinc-600 shrink-0">· S. {src.page}</span>
        </span>
        <ScorePill score={src.score} />
      </div>
    </div>
  );
}

// Zitate — Chip-Stil: dezente Inline-Chips, die per Klick den Beleg aufklappen.
function SourceCitations({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {sources.map((s, i) => {
          const isOpen = open.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={
                "group inline-flex items-center gap-1.5 rounded-lg border pl-2 pr-1.5 py-1 text-[12.5px] transition-all duration-150 " +
                (isOpen
                  ? "border-accent-300 dark:border-accent-500/40 bg-accent-50 dark:bg-accent-600/15 text-accent-700 dark:text-accent-300"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800")
              }
            >
              <IconDoc className="w-3.5 h-3.5 opacity-70" />
              <span className="font-medium max-w-[160px] truncate">{s.filename}</span>
              <span className="text-zinc-400 dark:text-zinc-500">· S. {s.page}</span>
              <IconChevron
                className={
                  "w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 " +
                  (isOpen ? "rotate-180" : "")
                }
              />
            </button>
          );
        })}
      </div>
      {open.size > 0 && (
        <div className="mt-2.5 space-y-2">
          {sources.map((s, i) => (open.has(i) ? <ExcerptCard key={i} src={s} /> : null))}
        </div>
      )}
    </div>
  );
}

function Avatar({ muted }: { muted?: boolean }) {
  return (
    <div
      className={
        "shrink-0 w-7 h-7 rounded-lg grid place-items-center " +
        (muted
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700")
      }
    >
      <Logo className="w-[18px] h-[18px]" />
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[78%] rounded-2xl rounded-br-md bg-accent-600 text-white px-4 py-2.5 text-[14.5px] leading-relaxed shadow-sm">
        {text}
      </div>
    </div>
  );
}

export function AssistantMessage({ msg }: { msg: ChatMessage }) {
  const streaming = msg.state === "streaming";

  // "nicht gefunden" — sichtbar anders, gedämpft, ohne Zitate
  if (msg.notFound) {
    return (
      <div className="flex gap-3 animate-fade-up">
        <Avatar muted />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="inline-flex items-start gap-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/30 px-3.5 py-3 max-w-[80%]">
            <span className="shrink-0 mt-px text-zinc-400 dark:text-zinc-500">
              <IconSearch className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[14px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {msg.text}
                {streaming && <span className="caret" />}
              </p>
              {!streaming && (
                <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Versuche eine andere Frage oder lade passende Quellen hoch.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-up">
      <Avatar />
      <div className="flex-1 min-w-0 pt-0.5">
        <div
          className={
            "text-[14.5px] leading-[1.72] text-zinc-700 dark:text-zinc-200 " +
            (streaming ? "caret" : "")
          }
          style={{ "--caret": "#6366f1" } as React.CSSProperties}
        >
          {renderRich(msg.text)}
        </div>
        {!streaming && msg.sources && <SourceCitations sources={msg.sources} />}
        {streaming && msg.sources && msg.sources.length > 0 && (
          <div className="mt-2.5 text-[12px] text-zinc-400 dark:text-zinc-500 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse" />
            {msg.sources.length} {msg.sources.length === 1 ? "Beleg" : "Belege"} gefunden
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorMessage({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex gap-3 animate-fade-up">
      <Avatar muted />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="inline-flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 max-w-[80%]">
          <span className="shrink-0 text-rose-500">
            <IconAlert className="w-5 h-5" />
          </span>
          <span className="text-[13.5px] text-rose-700 dark:text-rose-300 leading-snug">
            {text}
          </span>
          <button
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1 text-[13px] font-medium text-rose-700 dark:text-rose-300 hover:underline"
          >
            <IconRetry className="w-4 h-4" /> Erneut
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyChat({
  onAsk,
  disabled,
}: {
  onAsk: (q: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-6 rounded-full bg-accent-500/10 blur-2xl" />
        <Logo className="relative w-16 h-16" />
      </div>
      <h2 className="text-[26px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-100 text-balance">
        Antworten, die du belegen kannst
      </h2>
      <p className="text-[14.5px] text-zinc-500 dark:text-zinc-400 mt-2.5 mb-8 max-w-md text-balance leading-relaxed">
        Die KI antwortet nur aus deinen hochgeladenen Dokumenten und zeigt zu jeder Aussage die
        Fundstelle. Findet sie nichts, sagt sie es ehrlich.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-md mx-auto">
        {EXAMPLE_QUESTIONS.map((q, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onAsk(q)}
            className="group flex items-center justify-between gap-3 text-left rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/40 px-4 py-3 text-[14px] text-zinc-700 dark:text-zinc-200 hover:border-accent-300 dark:hover:border-accent-500/40 hover:bg-accent-50/50 dark:hover:bg-accent-600/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span>{q}</span>
            <IconChevron className="w-4 h-4 -rotate-90 text-zinc-300 dark:text-zinc-600 group-hover:text-accent-500 transition-colors" />
          </button>
        ))}
      </div>
      {disabled && (
        <p className="mt-6 text-[12.5px] text-amber-600 dark:text-amber-400/90">
          Wähle zuerst mindestens eine bereite Quelle in der Seitenleiste aus.
        </p>
      )}
    </div>
  );
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  disabled: boolean;
  streaming: boolean;
  hint: string | null;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  streaming,
  hint,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const canSend = !disabled && value.trim().length > 0 && !streaming;
  return (
    <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-white dark:from-zinc-900 to-transparent">
      <div className="max-w-3xl mx-auto">
        {hint && (
          <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-amber-600 dark:text-amber-400/90">
            <IconAlert className="w-3.5 h-3.5" /> {hint}
          </div>
        )}
        <div
          className={
            "relative flex items-end gap-2 rounded-2xl border bg-white dark:bg-zinc-800/60 pl-4 pr-2 py-2 transition-colors " +
            (disabled
              ? "border-zinc-200 dark:border-zinc-700 opacity-80"
              : "border-zinc-300 dark:border-zinc-700 focus-within:border-accent-400 dark:focus-within:border-accent-500/60 focus-within:ring-4 focus-within:ring-accent-500/10")
          }
        >
          <textarea
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder={
              disabled ? "Wähle zuerst eine Quelle aus…" : "Frage zu deinen Dokumenten stellen…"
            }
            className="flex-1 resize-none bg-transparent outline-none text-[14.5px] leading-relaxed text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 py-1.5 max-h-40 no-scrollbar"
          />
          {streaming ? (
            <button
              onClick={onStop}
              aria-label="Stopp"
              className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:opacity-90 transition"
            >
              <IconStop className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSend}
              aria-label="Senden"
              className={
                "shrink-0 grid place-items-center w-9 h-9 rounded-xl transition-all " +
                (canSend
                  ? "bg-accent-600 text-white hover:bg-accent-700 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-300 dark:text-zinc-500 cursor-not-allowed")
              }
            >
              <IconSend className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
        <p className="text-center text-[11px] text-zinc-300 dark:text-zinc-600 mt-2">
          Antworten basieren ausschließlich auf deinen Quellen.
        </p>
      </div>
    </div>
  );
}
