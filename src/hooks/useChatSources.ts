import { useQuery } from '@tanstack/react-query';
import { loadChatSources } from '@/lib/pb';

export function useChatSources(userId: string | undefined, ids: string[]) {
  return useQuery({
    queryKey: ['items', userId, 'chat-sources', ...ids],
    enabled: Boolean(userId),
    queryFn: ({ signal }) => loadChatSources(userId!, ids, signal),
  });
}
