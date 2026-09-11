import { router, useLocalSearchParams } from 'expo-router';
import { ItemReader } from '@/components/inbox/ItemReader';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemReader key={id} id={id}
    onClose={() => { if (router.canGoBack()) router.back(); else router.replace('/inbox'); }}
    onOpenItem={itemId => router.push(`/item/${itemId}`)} />;
}
