import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/lib/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';
import { exchangeGoogleIdentity, googleAuthMessage, type GoogleAuthOutcome } from '@/lib/googleAuth';
import { requestGoogleIdentity } from '@/lib/googleSignIn';

interface SocialIdentity {
  idToken: string;
  email?: string;
  authorizationCode?: string;
}

interface Props {
  disabled?: boolean;
  provider?: 'Google' | 'Apple';
  onBusyChange: (busy: boolean) => void;
}

export function SocialSignIn({ disabled, onBusyChange, provider = 'Google' }: Props) {
  const { resolved } = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (provider !== 'Apple' || Platform.OS !== 'ios') return;
    let active = true;
    AppleAuthentication.isAvailableAsync().then(value => { if (active) setAppleAvailable(value); }).catch(() => {});
    return () => { active = false; };
  }, [provider]);
  const { signInWithSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identity = useRef<SocialIdentity | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; identity.current = null; };
  }, []);
  useEffect(() => {
    onBusyChange(busy || consentVisible);
    return () => onBusyChange(false);
  }, [busy, consentVisible, onBusyChange]);

  const apply = async (result: GoogleAuthOutcome<SocialIdentity>) => {
    if (!mounted.current) return;
    if (result.type === 'consent') {
      identity.current = result.identity;
      setAccepted(false);
      setTermsAccepted(false);
      setConsentVisible(true);
    } else if (result.type === 'session') {
      identity.current = null;
      await signInWithSession(result.session);
      if (mounted.current) router.replace('/inbox');
    } else if (result.type === 'error') {
      identity.current = null;
      setConsentVisible(false);
      setError(provider === 'Apple' ? result.message.replaceAll('Google', 'Apple') : result.message);
    }
  };
  const run = async (consent: boolean) => {
    if (running.current || disabled || (consent && (!accepted || !termsAccepted))) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const credential = consent ? identity.current : provider === 'Google' ? await requestGoogleIdentity() : await (async () => {
        const apple = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
        if (!apple.identityToken) throw new Error('INVALID_TOKEN');
        return { idToken: apple.identityToken, email: apple.email ?? undefined, authorizationCode: apple.authorizationCode ?? undefined };
      })();
      if (!mounted.current || !credential) return;
      identity.current = credential;
      const exchange = provider === 'Google' ? api.authGoogle : (token: string, email?: string, accepted?: boolean) => api.authApple(token, email, identity.current?.authorizationCode, accepted);
      await apply(await exchangeGoogleIdentity(credential, exchange, consent));
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return;
      identity.current = null;
      if (mounted.current) {
        setConsentVisible(false);
        setError(googleAuthMessage(err).replaceAll('Google', provider));
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const cancel = () => {
    if (running.current) return;
    identity.current = null;
    setAccepted(false);
    setTermsAccepted(false);
    setConsentVisible(false);
    setError(null);
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (provider === 'Apple' && !appleAvailable) return null;
  return (
    <>
      {provider === 'Google' ? <Button title="Continue with Google" variant="secondary" disabled={disabled || consentVisible} loading={busy} onPress={() => run(false)} /> : (
        <View pointerEvents={disabled || consentVisible || busy ? 'none' : 'auto'} accessibilityState={{ disabled: disabled || consentVisible || busy }}>
          <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={resolved === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={12} style={{ height: 44, width: '100%', opacity: disabled || busy ? 0.6 : 1 }} onPress={() => run(false)} />
        </View>
      )}
      {error ? <Text accessibilityRole="alert" className="text-danger text-sm">{error}</Text> : null}
      <Modal visible={consentVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
        <SafeAreaView className="flex-1 bg-bg">
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
            <View accessibilityViewIsModal className="gap-5">
              <Text accessibilityRole="header" className="text-3xl text-fg" style={{ fontFamily: 'InstrumentSerif_400Regular' }}>Create your Flowy account</Text>
              <Text className="text-muted">One more step before creating your account with {provider}.</Text>
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Accept Terms of Service and Privacy Policy" accessibilityState={{ checked: termsAccepted, disabled: busy }} disabled={busy} onPress={() => setTermsAccepted(!termsAccepted)} className="flex-row items-start gap-3 py-2" style={{ minHeight: 44 }}>
                <View className="h-6 w-6 rounded border border-border items-center justify-center"><Text className="text-fg">{termsAccepted ? '✓' : ''}</Text></View>
                <Text className="flex-1 text-fg leading-6">I agree to the Terms of Service and Privacy Policy.</Text>
              </Pressable>
              <View className="flex-row gap-5">
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/privacy`)} className="text-accent underline">Privacy Policy</Text>
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/terms`)} className="text-accent underline">Terms of Service</Text>
              </View>
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Accept AI processing" accessibilityState={{ checked: accepted, disabled: busy }} disabled={busy} onPress={() => setAccepted(!accepted)} className="flex-row items-start gap-3 py-2" style={{ minHeight: 44 }}>
                <View className="h-6 w-6 rounded border border-border items-center justify-center"><Text className="text-fg">{accepted ? '✓' : ''}</Text></View>
                <Text className="flex-1 text-fg leading-6">I agree that Flowy may send my saved content and chat requests to Anthropic, OpenAI, and Voyage AI to summarize, transcribe, search, and answer questions.</Text>
              </Pressable>
              <Button title="Create account" disabled={!accepted || !termsAccepted} loading={busy} onPress={() => run(true)} />
              <Button title="Cancel" variant="ghost" disabled={busy} onPress={cancel} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
