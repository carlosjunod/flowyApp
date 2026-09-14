export type LabelKind = "category" | "tag";
export interface LabelCount {
  name: string;
  count: number;
}
export interface LabelFacets {
  categories: LabelCount[];
  tags: LabelCount[];
  totalItems: number;
}
export interface LabelPreview {
  count: number;
  revision: string;
}
export interface LabelChange {
  kind: LabelKind;
  name: string;
  replacement: string | null;
  revision: string;
}
