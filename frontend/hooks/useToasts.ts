"use client";

import { useCallback, useState } from "react";

export type ToastType = "error" | "success";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
}

let _tid = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, body?: string) => {
      const id = `t${++_tid}`;
      setToasts((ts) => [...ts, { id, type, title, body }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return { toasts, toast, dismiss };
}
