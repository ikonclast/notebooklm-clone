import type { ProcessingStage } from "@/types";

// Verarbeitungsschritte → deutsche Labels für die Statuszeile.
export const STAGE_LABEL: Record<ProcessingStage, string> = {
  queued: "In Warteschlange",
  parsing: "Wird gelesen…",
  chunking: "Segmentierung…",
  embedding: "Embedding…",
  storing: "Wird gespeichert…",
  done: "Fertig",
};

// Upload-Constraints (Spiegel der Backend-Validierung).
export const MAX_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_EXT = /\.(pdf|txt)$/i;
