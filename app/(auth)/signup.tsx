import { Link, router } from 'expo-router';
import React, { useState } from 'react';
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
import { useResolvedColors } from '@/lib/theme';

const friendlyError = (code: string): string => {
  switch (code) {
    case 'EMAIL_TAKEN':
      return 'That email is already in use. Try signing in instead.';
    case 'INVALID_EMAIL':
      return 'Please enter a valid email address.';
    case 'WEAK_PASSWORD':
      return 'Password must be at least 8 characters.';
    default:
      return 'Could not create account. Please try again.';
  }
};

export default function SignupScreen() {
  const { signInWithSession } = useAuth();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const res = await api.registerEmail(email.trim().toLowerCase(), password);
    setLoading(false);
    if (res.error) {
      setError(friendlyError(res.error.code));
      return;
    }
    await signInWithSession(res.data);
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
            Create account
          </Text>
          <Text className="text-base text-muted mb-8">Join Flowy</Text>

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
              placeholder="Password (min 8 chars)"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="newPassword"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="newPassword"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            {error ? <Text className="text-danger text-sm">{error}</Text> : null}
            <Button
              title="Create account"
              loading={loading}
              onPress={onSubmit}
              className="mt-2"
            />
          </View>

          <View className="flex-row items-center justify-center mt-6 gap-1">
            <Text className="text-muted text-sm">Already have an account?</Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-accent text-sm font-medium">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
