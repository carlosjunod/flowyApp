/** Portable source identity; never infer an author from an arbitrary mention. */
export interface SourceMetadata {
  author?: { platform: 'instagram'; handle: string; name?: string; url: string };
  repository?: { owner: string; name: string; url: string; description?: string; homepage?: string; language?: string; stars?: number; license?: string };
}
export function instagramAuthor(handle: unknown, name?: unknown): SourceMetadata['author'] {
  if (typeof handle !== 'string') return undefined;
  const clean = handle.replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.]{0,29}$/.test(clean)) return undefined;
  return { platform: 'instagram', handle: clean.toLowerCase(), url: `https://www.instagram.com/${clean.toLowerCase()}/`, ...(typeof name === 'string' && name.trim() ? { name: name.slice(0, 200) } : {}) };
}
export function readAuthor(item: { type: string; source_metadata?: SourceMetadata; content?: string }) {
  if (item.type !== 'instagram') return undefined;
  const stored = item.source_metadata?.author;
  if (stored) return instagramAuthor(stored.handle, stored.name);
  // Compatibility for original processor headers, never arbitrary @mentions.
  const header = item.content?.match(/^Author: ([^\n]+)$/m)?.[1];
  return instagramAuthor(header?.match(/(?:^|\s)@([a-zA-Z0-9_.]+)\s*$/)?.[1]);
}
export function githubRepository(value?: string): { owner: string; name: string; url: string } | undefined {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port) return undefined;
    const match = url.pathname.match(/^\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/);
    if (!match || ['features','topics','collections','settings','marketplace','orgs','users'].includes(match[1]!.toLowerCase())) return undefined;
    return { owner: match[1]!, name: match[2]!, url: `https://github.com/${match[1]}/${match[2]}` };
  } catch { return undefined; }
}
