"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  AssistantMessage,
  Composer,
  EmptyChat,
  ErrorMessage,
  UserMessage,
} from "@/components/Chat";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { Toasts } from "@/components/Toasts";
import { useChat } from "@/hooks/useChat";
import { useDocuments } from "@/hooks/useDocuments";
import { useProviders } from "@/hooks/useProviders";
import { useSuggestions } from "@/hooks/useSuggestions";
import { useTheme } from "@/hooks/useTheme";
import { useToasts } from "@/hooks/useToasts";

export function App() {
  const { dark, toggle } = useTheme();
  const { toasts, toast, dismiss } = useToasts();
  const { docs, uploadFiles, remove } = useDocuments({
    onError: (title, body) => toast("error", title, body),
  });
  const { providers, selected: provider, setSelected: setProvider } = useProviders();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawer, setDrawer] = useState(false);

  // Nur bereite Dokumente sind chatbar.
  const selectedReady = useMemo(
    () =>
      selectedIds.filter((id) =>
        docs.some((d) => d.document_id === id && d.status === "ready"),
      ),
    [selectedIds, docs],
  );
  const readyCount = docs.filter((d) => d.status === "ready").length;

  const { messages, input, setInput, streaming, runQuery, stop, retry } =
    useChat(selectedReady, provider);

  // Datengetriebene Vorschläge: nur bei leerem Chat und gewählten Quellen.
  const { questions: suggestions, loading: loadingSuggestions } = useSuggestions(
    selectedReady,
    provider,
    messages.length === 0,
  );

  const composerDisabled = selectedReady.length === 0;
  const composerHint = composerDisabled
    ? readyCount === 0
      ? "Lade zuerst eine Quelle hoch."
      : "Wähle mindestens ein Dokument aus, um zu fragen."
    : null;

  const onToggleSelect = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onDelete = (id: string) => {
    remove(id);
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  // Autoscroll ans Ende bei neuen/aktualisierten Nachrichten.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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
      <Header
        dark={dark}
        onToggleDark={toggle}
        onMenu={() => setDrawer(true)}
        providers={providers}
        selectedProvider={provider}
        onSelectProvider={setProvider}
      />

      <div className="flex-1 flex min-h-0">
        <div className="hidden md:block w-[304px] shrink-0">{sidebar()}</div>

        <main className="flex-1 min-w-0 flex flex-col bg-white dark:bg-zinc-900">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyChat
                onAsk={runQuery}
                disabled={composerDisabled}
                suggestions={suggestions}
                loadingSuggestions={loadingSuggestions}
              />
            ) : (
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-7 space-y-7">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserMessage key={m.id} text={m.text} />
                  ) : m.role === "error" ? (
                    <ErrorMessage
                      key={m.id}
                      text={m.text}
                      onRetry={() => retry(m.retryQuery ?? "")}
                    />
                  ) : (
                    <AssistantMessage key={m.id} msg={m} />
                  ),
                )}
              </div>
            )}
          </div>
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => runQuery(input)}
            onStop={stop}
            disabled={composerDisabled}
            streaming={streaming}
            hint={composerHint}
          />
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
