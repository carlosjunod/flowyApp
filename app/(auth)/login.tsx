import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SocialSignIn } from '@/components/auth/SocialSignIn';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useResolvedColors } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async () => {
    if (loading || appleLoading || googleBusy) return;
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
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View style={{ width: '100%', maxWidth: 440 }}>
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
                disabled={appleLoading || googleBusy}
                onPress={onSubmit}
                className="mt-2"
              />

              <View className="mt-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 h-px bg-border" />
                  <Text className="text-xs text-muted">or</Text>
                  <View className="flex-1 h-px bg-border" />
                </View>
                <SocialSignIn provider="Apple" disabled={loading || googleBusy} onBusyChange={setAppleLoading} />
                {Platform.OS === 'ios' || Platform.OS === 'android' ? (
                  <SocialSignIn disabled={loading || appleLoading} onBusyChange={setGoogleBusy} />
                ) : (
                  <Pressable onPress={() => setError('Google sign-in is being set up — use email for now.')} accessibilityRole="button" className="h-11 rounded-xl border border-border bg-card items-center justify-center">
                    <Text className="text-fg text-sm font-medium">Continue with Google</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-muted text-sm">No account?</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/(auth)/signup')}
                hitSlop={8}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text className="text-accent text-sm font-medium">Create one</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
