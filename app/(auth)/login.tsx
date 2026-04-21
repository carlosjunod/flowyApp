import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useResolvedColors } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    router.replace('/inbox');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <Text
            className="text-5xl text-fg mb-2"
            style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -1 }}
          >
            Flowy
          </Text>
          <Text className="text-base text-muted mb-8">Sign in to your inbox</Text>

          <View className="gap-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="password"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            {error ? (
              <Text className="text-danger text-sm">{error}</Text>
            ) : null}
            <Button
              title="Sign in"
              loading={loading}
              onPress={onSubmit}
              className="mt-2"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
