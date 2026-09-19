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
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  // Holds a translation key, so a language switch re-renders the error too.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // PocketBase returns its own prose for a rejected credential; there is no
  // stable code to map, so it is shown verbatim rather than mistranslated.
  const [serverError, setServerError] = useState<string | null>(null);
  const onSubmit = async () => {
    if (loading || appleLoading || googleBusy) return;
    setServerError(null);
    if (!email || !password) {
      setErrorKey('auth.login.missingCredentials');
      return;
    }
    setLoading(true);
    setErrorKey(null);
    const res = await signIn(email.trim(), password);
    setLoading(false);
    if (res.error) {
      setServerError(res.error.message);
      return;
    }
    router.replace('/inbox');
  };

  const error = errorKey ? t(errorKey as Parameters<typeof t>[0]) : serverError;

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
              {t('common.brand.name')}
            </Text>
            <Text className="text-base text-muted mb-8">{t('auth.login.subtitle')}</Text>

            <View className="gap-3">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.fields.email')}
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
                placeholder={t('auth.fields.password')}
                placeholderTextColor={colors.muted}
                secureTextEntry
                textContentType="password"
                className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
              />
              {error ? (
                <Text accessibilityRole="alert" className="text-danger text-sm">{error}</Text>
              ) : null}
              <Button
                title={t('auth.login.submit')}
                accessibilityLabel={loading ? t('auth.login.submitting') : t('auth.login.submit')}
                loading={loading}
                disabled={appleLoading || googleBusy}
                onPress={onSubmit}
                className="mt-2"
              />

              <View className="mt-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 h-px bg-border" />
                  <Text className="text-xs text-muted">{t('auth.social.divider')}</Text>
                  <View className="flex-1 h-px bg-border" />
                </View>
                <SocialSignIn provider="Apple" disabled={loading || googleBusy} onBusyChange={setAppleLoading} />
                {Platform.OS === 'ios' || Platform.OS === 'android' ? (
                  <SocialSignIn disabled={loading || appleLoading} onBusyChange={setGoogleBusy} />
                ) : (
                  <Pressable onPress={() => { setServerError(null); setErrorKey('auth.login.googleUnavailable'); }} accessibilityRole="button" className="h-11 rounded-xl border border-border bg-card items-center justify-center">
                    <Text className="text-fg text-sm font-medium">{t('auth.social.continueGoogle')}</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-muted text-sm">{t('auth.login.noAccount')}</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/(auth)/signup')}
                hitSlop={8}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text className="text-accent text-sm font-medium">{t('auth.login.createOne')}</Text>
              </Pressable>
            </View>

            {/* The selector lives here as well as in Settings: someone whose
                phone put them in the wrong language must be able to change it
                before they can sign in. */}
            <View className="mt-8">
              <Text className="mb-2 px-1 text-xs uppercase tracking-wide text-muted">
                {t('common.language.label')}
              </Text>
              <LanguageSelector compact />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
