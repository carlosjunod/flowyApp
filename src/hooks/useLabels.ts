import { useEffect } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { LabelChange, LabelKind } from "@/types/labels";
export function useLabels() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["labels", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const result = await api.listLabels();
      if (result.error) throw new Error("Could not load labels. Try again.");
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
    if (result.error)
      throw new Error("Could not review this change. Try again.");
    return result.data;
  }
  async function change(input: LabelChange) {
    const result = await api.changeLabel(input);
    if (result.error)
      throw new Error(
        result.error.code === "LABEL_CHANGED"
          ? "Your library changed. Review the updated count and confirm again."
          : "Could not update labels. Try again.",
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
