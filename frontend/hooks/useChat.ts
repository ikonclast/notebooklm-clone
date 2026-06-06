"use client";

import { useCallback, useRef, useState } from "react";

import { streamChat } from "@/lib/api";
import type { ChatMessage, ProviderId } from "@/types";

let _mid = 0;
const nextId = () => `m${++_mid}`;

export function useChat(selectedReadyIds: string[], provider: ProviderId | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  // Aktuelle Auswahl/Provider per Ref → runQuery bleibt eine stabile Funktion.
  const idsRef = useRef(selectedReadyIds);
  idsRef.current = selectedReadyIds;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const runQuery = useCallback((rawQuery: string) => {
    const query = rawQuery.trim();
    const ids = idsRef.current;
    if (!query || ids.length === 0) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", text: query };
    const aId = nextId();
    const assistantMsg: ChatMessage = {
      id: aId,
      role: "assistant",
      text: "",
      sources: null,
      state: "streaming",
      notFound: false,
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const patch = (fn: (x: ChatMessage) => ChatMessage) =>
      setMessages((m) => m.map((x) => (x.id === aId ? fn(x) : x)));

    const controller = new AbortController();
    ctrl.current = controller;

    void streamChat(
      query,
      ids,
      providerRef.current,
      {
        onSources: (sources) => patch((x) => ({ ...x, sources })),
        onToken: (text) => patch((x) => ({ ...x, text: x.text + text })),
        onDone: () => {
          // Leere Quellen → "nicht gefunden"-Antwort des Backends.
          patch((x) => ({
            ...x,
            state: "done",
            notFound: !(x.sources && x.sources.length > 0),
          }));
          setStreaming(false);
        },
        onError: (message) => {
          setMessages((m) =>
            m.map((x) =>
              x.id === aId
                ? { id: aId, role: "error", text: message, retryQuery: query }
                : x,
            ),
          );
          setStreaming(false);
        },
      },
      controller.signal,
    );
  }, []);

  const stop = useCallback(() => {
    ctrl.current?.abort();
    setMessages((m) =>
      m.map((x) => (x.state === "streaming" ? { ...x, state: "done" } : x)),
    );
    setStreaming(false);
  }, []);

  const retry = useCallback(
    (query: string) => {
      setMessages((m) => m.filter((x) => x.role !== "error"));
      setTimeout(() => runQuery(query), 50);
    },
    [runQuery],
  );

  // Zurück zum Start: laufenden Stream abbrechen, Verlauf und Eingabe leeren.
  const reset = useCallback(() => {
    ctrl.current?.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, []);

  return { messages, input, setInput, streaming, runQuery, stop, retry, reset };
}
