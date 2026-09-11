import React from "react";
import { useTheme } from "@/lib/theme";
import { useDigestColors } from "@/lib/digestAppearance";
import type { DigestDateFieldProps } from "./DigestDateField";

export function DigestDateField({
  label,
  mode,
  value,
  onChange,
  minimumDate,
  disabled,
}: DigestDateFieldProps) {
  const colors = useDigestColors();
  const { resolved } = useTheme();
  return React.createElement("input", {
    "aria-label": label,
    type: mode,
    value,
    min: minimumDate,
    disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.value && event.target.validity.valid)
        onChange(event.target.value);
    },
    style: {
      minHeight: 48,
      maxWidth: "100%",
      padding: "8px 12px",
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      color: colors.fg,
      background: colors.bg,
      fontFamily: "Inter_400Regular",
      fontSize: 16,
      colorScheme: resolved,
    },
  });
}
