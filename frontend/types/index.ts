// Frontend-Typen — synchron mit den Pydantic-Schemas des Backends
// (backend/models/schemas.py).

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export type ProcessingStage =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "storing"
  | "done";

// GET /documents, GET /documents/{id}/status
export interface JobStatus {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  stage: ProcessingStage | null;
  pages: number;
  chunks: number;
  error_message: string | null;
}

// Im SSE "sources"-Event als Array
export interface Source {
  document_id: string;
  filename: string;
  page: number;
  excerpt: string;
  score: number;
}

// Antwort von POST /documents
export interface UploadResponse {
  job_id: string;
  status: DocumentStatus;
}

// ── LLM-Provider (Live-Umschaltung) ─────────────────────────────────────────
export type ProviderId = "ollama" | "groq" | "openai";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  model: string;
  available: boolean;
}

// GET /providers
export interface ProvidersResponse {
  default: ProviderId;
  providers: ProviderInfo[];
}

// ── Chat-UI-Modell (Frontend-intern) ────────────────────────────────────────
export type MessageRole = "user" | "assistant" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  sources?: Source[] | null;
  state?: "streaming" | "done";
  notFound?: boolean;
  retryQuery?: string;
}

// Events des SSE-Streams von POST /chat
export type ChatStreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
