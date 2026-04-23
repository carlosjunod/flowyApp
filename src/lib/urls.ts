export type ParsedUrls = {
  valid: string[];
  invalid: string[];
  duplicates: number;
};

const SPLIT = /[\s,;]+/;

const normalize = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/[<>]/g, '');
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const parsePastedUrls = (raw: string): ParsedUrls => {
  const tokens = raw.split(SPLIT);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const tok of tokens) {
    if (!tok) continue;
    const norm = normalize(tok);
    if (!norm) {
      invalid.push(tok);
      continue;
    }
    if (seen.has(norm)) {
      duplicates += 1;
      continue;
    }
    seen.add(norm);
    valid.push(norm);
  }

  return { valid, invalid, duplicates };
};
