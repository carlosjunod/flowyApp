/**
 * Best-effort timestamp parser for stored transcript text.
 *
 * The worker currently flattens YouTube/Whisper transcripts into a single
 * space-joined string, so most items will have *no* timestamps. When timestamps
 * DO appear inline (e.g. some YouTube descriptions paste their own chapter list,
 * or a hand-edited entry), we want to render them as clickable segments.
 *
 * Supported timestamp shapes at line start, optionally surrounded by whitespace:
 *   "0:00", "1:23", "12:34", "1:23:45"
 *
 * Anything that doesn't parse cleanly returns null — caller should fall back
 * to plain-text rendering.
 *
 * Mirrors apps/web/lib/transcript.ts verbatim (pure functions, no DOM).
 */
export interface TimestampedSegment {
  /** Original timestamp string, e.g. "1:23" — preserve whatever the source used. */
  time: string;
  /** Seconds from start, used for YouTube `t=` deeplinks. */
  seconds: number;
  /** Text up to the next timestamp (or end of content). */
  text: string;
}

const TIMESTAMP_LINE_RE = /^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
const INLINE_TIMESTAMP_RE = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)\b/;

export function parseTimestampedSegments(
  content: string | undefined | null,
): TimestampedSegment[] | null {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  const segments: TimestampedSegment[] = [];

  for (const line of lines) {
    const m = line.match(TIMESTAMP_LINE_RE);
    if (!m) continue;
    const [, time, text] = m;
    if (!time || !text) continue;
    segments.push({ time, seconds: timeToSeconds(time), text: text.trim() });
  }

  if (segments.length >= 2) return segments;

  // Fallback: try to split a long single line on inline `m:ss text` patterns.
  if (lines.length === 1 && INLINE_TIMESTAMP_RE.test(lines[0]!)) {
    const single = lines[0]!;
    const re = /(\d{1,2}:\d{2}(?::\d{2})?)\s+/g;
    const parts: { idx: number; time: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(single)) !== null) {
      parts.push({ idx: match.index, time: match[1]! });
    }
    if (parts.length >= 2) {
      const out: TimestampedSegment[] = [];
      for (let i = 0; i < parts.length; i++) {
        const start = parts[i]!;
        const end = parts[i + 1]?.idx ?? single.length;
        const slice = single
          .slice(start.idx, end)
          .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s+/, '')
          .trim();
        if (slice) {
          out.push({
            time: start.time,
            seconds: timeToSeconds(start.time),
            text: slice,
          });
        }
      }
      if (out.length >= 2) return out;
    }
  }

  return null;
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? 0;
}

/**
 * Append `&t=<sec>` (or `?t=<sec>`) to a YouTube watch URL so the player jumps
 * to the chapter start when opened in a new tab.
 */
export function youtubeUrlAtSecond(baseUrl: string, seconds: number): string {
  if (seconds <= 0) return baseUrl;
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('t', String(seconds));
    return u.toString();
  } catch {
    return baseUrl;
  }
}
