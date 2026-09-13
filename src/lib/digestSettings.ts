import { DIGEST_TIMEZONES } from "./digestTimezones";
import type { DigestCadence, DigestPreferences } from "@/types";
import { itemTypeLabel } from "./itemIcons";

export const DIGEST_CADENCE_LABELS: Record<DigestCadence, string> = {
  daily: 'Daily digest', weekly: 'Weekly digest', monthly: 'Monthly digest',
};
export const DIGEST_MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1);

/** Older servers do not expose monthly settings; never send new opt-in fields to them. */
export function availableDigestCadences(settings: DigestPreferences): DigestCadence[] {
  return settings.monthly_enabled === undefined ? ['weekly', 'daily'] : ['weekly', 'daily', 'monthly'];
}

export function nextDigestCadence(cadence?: DigestCadence): DigestCadence | undefined {
  return cadence === undefined ? 'weekly' : cadence === 'weekly' ? 'daily' : cadence === 'daily' ? 'monthly' : undefined;
}

export const DIGEST_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export const DIGEST_TYPES: Record<string, string> = {
  ...itemTypeLabel,
  note: "Private notes",
};

export function exclusionChoices(
  available: string[],
  excluded: string[],
): string[] {
  return [...new Set([...available, ...excluded])].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Checked means included; preserve every other exclusion, including older values. */
export function toggleExclusion(excluded: string[], value: string): string[] {
  return excluded.includes(value)
    ? excluded.filter((entry) => entry !== value)
    : [...excluded, value];
}

export function preferencesChanged(
  saved: DigestPreferences | undefined,
  draft: DigestPreferences | null,
): boolean {
  if (!saved || !draft) return false;
  return ([...new Set([...Object.keys(saved), ...Object.keys(draft)])] as (keyof DigestPreferences)[]).some((key) => {
    const before = saved[key],
      after = draft[key];
    return Array.isArray(before) && Array.isArray(after)
      ? JSON.stringify([...before].sort()) !== JSON.stringify([...after].sort())
      : before !== after;
  });
}

// Recurring times are wall-clock values, not instants. UTC is only a neutral
// carrier for the picker: travel and a device's DST must never shift HH:MM.
export function timePickerDate(value: string): Date {
  const [hour, minute] = value.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 1, hour, minute));
}
export function timePickerValue(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
export function displayTime(value: string): string {
  return timePickerDate(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
export function dateInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function datePickerDate(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}
/** Start of the chosen local day, respecting the schedule's IANA timezone. */
export function resumeAtDate(value: string, timezone: string): string {
  const midnight = Date.parse(`${value}T00:00:00Z`) / 60000;
  let low = midnight - 36 * 60,
    high = midnight + 36 * 60;
  // Find the first valid minute of the date. Some regions skip midnight when
  // DST starts; a nonexistent 00:00 must resume at 01:00, never the prior day.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dateInZone(new Date(middle * 60000), timezone) < value)
      low = middle + 1;
    else high = middle;
  }
  return new Date(low * 60000).toISOString();
}
export function suggestedResumeDate(timezone: string, days = 7): string {
  const date = datePickerDate(dateInZone(new Date(), timezone));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function digestTimezones(current: string): string[] {
  const runtime = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  return exclusionChoices((runtime.supportedValuesOf?.("timeZone") ?? [...DIGEST_TIMEZONES]).filter((zone) => {
    try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
    catch { return false; }
  }), [
    "Etc/UTC",
    current,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ]);
}
