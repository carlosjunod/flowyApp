import { router, useLocalSearchParams } from 'expo-router';
import { ItemReader } from '@/components/inbox/ItemReader';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemReader key={id} id={id}
    onClose={() => { if (router.canGoBack()) router.back(); else router.replace('/inbox'); }}
    // Keep one reader entry, so a single back gesture returns to the inbox.
    onOpenItem={itemId => router.replace(`/item/${itemId}`)} />;
}
