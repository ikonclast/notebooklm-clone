"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, deleteDocument, getStatus, listDocuments, uploadDocument } from "@/lib/api";
import { ACCEPTED_EXT, MAX_BYTES } from "@/lib/labels";
import type { JobStatus } from "@/types";

const POLL_INTERVAL_MS = 1200;
const isActive = (d: JobStatus) => d.status === "pending" || d.status === "processing";

interface UseDocumentsOptions {
  onError?: (title: string, body?: string) => void;
}

export function useDocuments({ onError }: UseDocumentsOptions = {}) {
  const [docs, setDocs] = useState<JobStatus[]>([]);
  const docsRef = useRef<JobStatus[]>(docs);
  docsRef.current = docs;

  // onError über Ref halten: so muss es NICHT in Effekt-/Callback-Deps und
  // löst keinen Re-Render-Loop aus (onError ist bei jedem Render eine neue Fn).
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const upsert = useCallback((next: JobStatus) => {
    setDocs((prev) =>
      prev.map((d) => (d.document_id === next.document_id ? next : d)),
    );
  }, []);

  // Initiales Laden — genau einmal beim Mount.
  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch(() => onErrorRef.current?.("Dokumente konnten nicht geladen werden."));
  }, []);

  // Ein einziger Poll-Timer für die Lebensdauer; liest den aktuellen Stand per Ref.
  // Pollt nur Dokumente in pending/processing, bis ready|failed.
  useEffect(() => {
    const timer = setInterval(() => {
      const active = docsRef.current.filter(isActive);
      active.forEach(async (d) => {
        try {
          upsert(await getStatus(d.document_id));
        } catch {
          /* transient — nächster Tick versucht es erneut */
        }
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [upsert]);

  // Client-Vorvalidierung (sofortiges Feedback); das Backend ist der echte Gate.
  const upload = useCallback(
    async (file: File) => {
      const name = file.name || "datei";
      if (!ACCEPTED_EXT.test(name)) {
        onErrorRef.current?.("Nicht unterstützter Dateityp", `„${name}" — nur PDF & TXT sind erlaubt.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        onErrorRef.current?.("Datei zu groß (max. 20 MB)", `„${name}" überschreitet das Limit.`);
        return;
      }
      try {
        const { job_id, status } = await uploadDocument(file);
        const optimistic: JobStatus = {
          document_id: job_id,
          filename: name,
          status,
          stage: "queued",
          pages: 0,
          chunks: 0,
          error_message: null,
        };
        setDocs((prev) => [optimistic, ...prev]);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Upload fehlgeschlagen.";
        onErrorRef.current?.(msg, name);
      }
    },
    [],
  );

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((f) => void upload(f));
    },
    [upload],
  );

  // Optimistisches Entfernen; DELETE läuft im Hintergrund (Hard Delete im Backend).
  const remove = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.document_id !== id));
    deleteDocument(id).catch(() => onErrorRef.current?.("Löschen fehlgeschlagen."));
  }, []);

  return { docs, uploadFiles, remove };
}
