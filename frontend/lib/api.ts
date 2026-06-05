// Typisierter API-Client. Keine fetch-Aufrufe direkt in Komponenten.

import type {
  ChatStreamEvent,
  JobStatus,
  Source,
  UploadResponse,
} from "@/types";

// Default: Same-Origin-Proxy (/api → Next-Rewrite → Backend). Override via Env
// nur nötig, wenn das Backend direkt (ohne Proxy) angesprochen werden soll.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "/api";

/** HTTP-Fehler mit Statuscode, damit die UI 413/415 unterscheiden kann. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function listDocuments(): Promise<JobStatus[]> {
  const res = await fetch(`${API_BASE}/documents`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "Dokumente konnten nicht geladen werden.");
  return (await res.json()) as JobStatus[];
}

export async function getStatus(documentId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(res.status, "Status konnte nicht geladen werden.");
  return (await res.json()) as JobStatus;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await parseDetail(res, "Upload fehlgeschlagen."));
  }
  return (await res.json()) as UploadResponse;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new ApiError(res.status, "Löschen fehlgeschlagen.");
  }
}

export interface ChatHandlers {
  onSources?: (sources: Source[]) => void;
  onToken?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

/**
 * Startet den Chat-SSE-Stream. EventSource unterstützt kein POST, daher
 * fetch + ReadableStream. `signal` erlaubt das Abbrechen (Stop-Button).
 */
export async function streamChat(
  query: string,
  documentIds: string[],
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, document_ids: documentIds }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError?.("Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.");
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(await parseDetail(res, "Die Antwort konnte nicht geladen werden."));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const dispatch = (raw: string) => {
    const event = parseSSE(raw);
    if (!event) return;
    switch (event.type) {
      case "sources":
        handlers.onSources?.(event.sources);
        break;
      case "token":
        handlers.onToken?.(event.text);
        break;
      case "error":
        handlers.onError?.(event.message);
        break;
      case "done":
        handlers.onDone?.();
        break;
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      // SSE-Nachrichten sind durch eine Leerzeile getrennt.
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatch(chunk);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError?.("Die Antwort wurde unterbrochen. Verbindung verloren.");
  }
}

/** Parst einen einzelnen SSE-Block ("event: x\ndata: {...}") in ein typisiertes Event. */
function parseSSE(raw: string): ChatStreamEvent | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!event) return null;
  const data = dataLines.join("\n");

  switch (event) {
    case "sources":
      return { type: "sources", sources: JSON.parse(data) as Source[] };
    case "token":
      return { type: "token", text: (JSON.parse(data) as { text: string }).text };
    case "error":
      return {
        type: "error",
        message: (JSON.parse(data) as { message: string }).message,
      };
    case "done":
      return { type: "done" };
    default:
      return null;
  }
}
