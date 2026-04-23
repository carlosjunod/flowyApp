import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResolvedColors, useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn, signInWithSession } = useAuth();
  const colors = useResolvedColors();
  const { resolved } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

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

  const onApple = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError('Apple sign-in failed: no identity token');
        return;
      }
      const res = await api.authApple(credential.identityToken, credential.email ?? undefined);
      if (res.error) {
        setError(res.error.message);
        return;
      }
      await signInWithSession(res.data);
      router.replace('/inbox');
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return;
      setError(err instanceof Error ? err.message : 'Apple sign-in failed');
    } finally {
      setAppleLoading(false);
    }
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

            {appleAvailable ? (
              <View className="mt-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 h-px bg-border" />
                  <Text className="text-xs text-muted">or</Text>
                  <View className="flex-1 h-px bg-border" />
                </View>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={
                    resolved === 'dark'
                      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={12}
                  style={{ height: 44, width: '100%', opacity: appleLoading ? 0.6 : 1 }}
                  onPress={onApple}
                />
              </View>
            ) : null}
          </View>

          <View className="flex-row items-center justify-center mt-8 gap-1">
            <Text className="text-muted text-sm">No account?</Text>
            <Link href="/signup" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-accent text-sm font-medium">Create one</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
