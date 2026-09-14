import type { LabelCount } from "@/types/labels";
export type LabelOrder = "alphabetical" | "count";
export function orderLabels(
  labels: LabelCount[],
  order: LabelOrder,
): LabelCount[] {
  return [...labels].sort(
    (a, b) =>
      (order === "count" ? b.count - a.count : 0) ||
      a.name.localeCompare(b.name),
  );
}
