import { useEffect } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LabelChange, LabelKind } from "@/types/labels";

/**
 * Label failures are thrown, not returned, because React Query owns this
 * boundary. The *message* is a translation key: `LabelSection` renders it, so a
 * sentence here would be stuck in English on a Spanish screen.
 */
export class LabelError extends Error {
  constructor(readonly messageKey: string) {
    super(messageKey);
    this.name = "LabelError";
  }
}

export function useLabels() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["labels", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const result = await api.listLabels();
      if (result.error) throw new LabelError("inbox.labels.loadFailed");
      return result.data;
    },
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && user?.id)
        void qc.invalidateQueries({ queryKey: ["labels", user.id] });
    });
    return () => subscription.remove();
  }, [user?.id, qc]);
  async function preview(kind: LabelKind, name: string) {
    const result = await api.previewLabel(kind, name);
    if (result.error) throw new LabelError("inbox.labels.reviewFailed");
    return result.data;
  }
  async function change(input: LabelChange) {
    const result = await api.changeLabel(input);
    if (result.error)
      throw new LabelError(
        result.error.code === "LABEL_CHANGED"
          ? "inbox.labels.changedElsewhere"
          : "inbox.labels.updateFailed",
      );
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["labels"] }),
      qc.invalidateQueries({ queryKey: ["items"] }),
      qc.invalidateQueries({ queryKey: ["item"] }),
    ]);
    return result.data;
  }
  return { query, preview, change };
}
