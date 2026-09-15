import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdaptivePane } from '@/components/navigation/AdaptiveTabs';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function ChatScreen() {
  const { visible } = useAdaptivePane();
  return <SafeAreaView className="flex-1 bg-bg" edges={['top']}><ChatPanel focused={visible} /></SafeAreaView>;
}
