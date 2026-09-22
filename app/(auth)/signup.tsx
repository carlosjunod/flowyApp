import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { ENV } from '@/lib/env';

/** Server error *codes* are the contract; only their human sentence is translated. */
const registerErrorKey = (code: string): string => {
  switch (code) {
    case 'EMAIL_TAKEN':
      return 'auth.registerErrors.EMAIL_TAKEN';
    case 'INVALID_EMAIL':
      return 'auth.registerErrors.INVALID_EMAIL';
    case 'WEAK_PASSWORD':
      return 'auth.registerErrors.WEAK_PASSWORD';
    default:
      return 'auth.registerErrors.DEFAULT';
  }
};

export default function SignupScreen() {
  const { signInWithSession } = useAuth();
  const { t, tKey } = useI18n();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [appleBusy, setAppleBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const onSubmit = async () => {
    if (loading || googleBusy || appleBusy) return;
    setErrorKey(null);
    if (!email.trim() || !password) {
      setErrorKey('auth.signup.missingCredentials');
      return;
    }
    if (password.length < 8) {
      setErrorKey('auth.signup.passwordTooShort');
      return;
    }
    if (password !== confirm) {
      setErrorKey('auth.signup.passwordMismatch');
      return;
    }
    if (!termsAccepted) {
      setErrorKey('auth.signup.termsRequired');
      return;
    }
    if (!aiConsent) {
      setErrorKey('auth.signup.consentRequired');
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await api.registerEmail(normalizedEmail, password, undefined, aiConsent);
      if (res.error) {
        setErrorKey(registerErrorKey(res.error.code));
        return;
      }
      await signInWithSession(res.data);
      router.replace('/inbox');
    } catch {
      setErrorKey('auth.signup.failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 }}>
          <Text
            className="text-5xl text-fg mb-2"
            style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -1 }}
          >
            {t('auth.signup.title')}
          </Text>
          <Text className="text-base text-muted mb-8">{t('auth.signup.subtitle')}</Text>

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
              placeholder={t('auth.fields.passwordMin')}
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="newPassword"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t('auth.fields.confirmPassword')}
              placeholderTextColor={colors.muted}
              secureTextEntry
              textContentType="newPassword"
              className="h-11 rounded-xl border border-border bg-card px-4 text-fg"
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={t('auth.consent.termsLabel')}
              accessibilityState={{ checked: termsAccepted, disabled: loading || googleBusy || appleBusy }}
              disabled={loading || googleBusy || appleBusy}
              onPress={() => setTermsAccepted((value) => !value)}
              className="flex-row items-start gap-3 py-2"
              style={{ minHeight: 44 }}
            >
              <View className="mt-0.5 h-5 w-5 items-center justify-center rounded border border-border" style={{ backgroundColor: termsAccepted ? colors.accent : 'transparent' }}>
                {termsAccepted ? <Text className="text-bg text-xs">✓</Text> : null}
              </View>
              <Text className="flex-1 text-muted text-sm leading-5">{t('auth.consent.terms')}</Text>
            </Pressable>
            <View className="flex-row gap-5">
              <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/terms`)} className="text-accent underline py-2">{t('auth.consent.termsLink')}</Text>
              <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/privacy`)} className="text-accent underline py-2">{t('auth.consent.privacyLink')}</Text>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={t('auth.consent.aiLabel')}
              accessibilityState={{ checked: aiConsent, disabled: loading || googleBusy || appleBusy }}
              disabled={loading || googleBusy || appleBusy}
              onPress={() => setAiConsent((value) => !value)}
              className="flex-row items-start gap-3 py-2"
              style={{ minHeight: 44 }}
            >
              <View className="mt-0.5 h-5 w-5 items-center justify-center rounded border border-border" style={{ backgroundColor: aiConsent ? colors.accent : 'transparent' }}>
                {aiConsent ? <Text className="text-bg text-xs">✓</Text> : null}
              </View>
              <Text className="flex-1 text-muted text-sm leading-5">{t('auth.consent.ai')}</Text>
            </Pressable>
            {errorKey ? <Text accessibilityRole="alert" className="text-danger text-sm">{tKey(errorKey)}</Text> : null}
            <Button
              title={t('auth.signup.submit')}
              accessibilityLabel={loading ? t('auth.signup.submitting') : t('auth.signup.submit')}
              loading={loading}
              disabled={googleBusy || appleBusy || !termsAccepted || !aiConsent}
              onPress={onSubmit}
              className="mt-2"
            />
            <SocialSignIn provider="Apple" disabled={loading || googleBusy} onBusyChange={setAppleBusy} />
            <SocialSignIn provider="Google" disabled={loading || appleBusy} onBusyChange={setGoogleBusy} />
          </View>

          <View className="flex-row items-center justify-center mt-6 gap-1">
            <Text className="text-muted text-sm">{t('auth.signup.haveAccount')}</Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text className="text-accent text-sm font-medium">{t('auth.signup.signIn')}</Text>
              </Pressable>
            </Link>
          </View>

          <View className="mt-8">
            <Text className="mb-2 px-1 text-xs uppercase tracking-wide text-muted">
              {t('common.language.label')}
            </Text>
            <LanguageSelector compact />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
