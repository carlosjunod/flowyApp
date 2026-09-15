import type { ChatMessage, CitedItem } from '../types';

export function answerSources(message: ChatMessage): { items: CitedItem[]; cited: boolean } {
  if (message.role !== 'assistant') return { items: [], cited: false };
  const byId = new Map((message.citations ?? []).map(item => [item.id, item]));
  const ids = [...new Set(Array.from(message.content.matchAll(/\[\[((?:item_)?[a-z0-9]{6,32})\]\]/gi), match => match[1]!))];
  const cited = ids.map(id => byId.get(id)).filter((item): item is CitedItem => Boolean(item));
  return { items: cited.length ? cited : [...byId.values()], cited: cited.length > 0 };
}
