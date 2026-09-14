import { router, useLocalSearchParams } from 'expo-router';
import { ItemReader } from '@/components/inbox/ItemReader';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemReader key={id} id={id}
    onClose={() => router.dismissTo('/inbox')}
    onOpenItem={itemId => router.push(`/item/${itemId}`)} />;
}
