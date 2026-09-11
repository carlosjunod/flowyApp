import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENV } from '@/lib/env';
import { exchangeGoogleIdentity, googleAuthMessage, type GoogleAuthOutcome } from '@/lib/googleAuth';
import { requestGoogleIdentity, type GoogleIdentity } from '@/lib/googleSignIn';

interface Props {
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}

export function GoogleSignIn({ disabled, onBusyChange }: Props) {
  const { signInWithSession } = useAuth();
  const [busy, setBusy] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const identity = useRef<GoogleIdentity | null>(null);
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

  const apply = async (result: GoogleAuthOutcome) => {
    if (!mounted.current) return;
    if (result.type === 'consent') {
      identity.current = result.identity;
      setAccepted(false);
      setConsentVisible(true);
    } else if (result.type === 'session') {
      identity.current = null;
      await signInWithSession(result.session);
      if (mounted.current) router.replace('/inbox');
    } else if (result.type === 'error') {
      identity.current = null;
      setConsentVisible(false);
      setError(result.message);
    }
  };
  const run = async (consent: boolean) => {
    if (running.current || (consent && !accepted)) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const credential = consent ? identity.current : await requestGoogleIdentity();
      if (!mounted.current || !credential) return;
      await apply(await exchangeGoogleIdentity(credential, api.authGoogle, consent));
    } catch (err) {
      identity.current = null;
      if (mounted.current) {
        setConsentVisible(false);
        setError(googleAuthMessage(err));
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
    setConsentVisible(false);
    setError(null);
  };

  if (Platform.OS !== 'ios') return null;
  return (
    <>
      <Button title="Continue with Google" variant="secondary" disabled={disabled || consentVisible} loading={busy} onPress={() => run(false)} />
      {error ? <Text accessibilityRole="alert" className="text-danger text-sm">{error}</Text> : null}
      <Modal visible={consentVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cancel}>
        <SafeAreaView className="flex-1 bg-bg">
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
            <View accessibilityViewIsModal className="gap-5">
              <Text accessibilityRole="header" className="text-3xl text-fg" style={{ fontFamily: 'InstrumentSerif_400Regular' }}>Create your Flowy account</Text>
              <Text className="text-muted">One more step before creating your account with Google.</Text>
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Accept AI processing" accessibilityState={{ checked: accepted, disabled: busy }} disabled={busy} onPress={() => setAccepted(!accepted)} className="flex-row items-start gap-3 py-2">
                <View className="h-6 w-6 rounded border border-border items-center justify-center"><Text className="text-fg">{accepted ? '✓' : ''}</Text></View>
                <Text className="flex-1 text-fg leading-6">I agree that Flowy may send my saved content and chat requests to Anthropic, OpenAI, and Voyage AI to summarize, transcribe, search, and answer questions.</Text>
              </Pressable>
              <View className="flex-row gap-5">
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/privacy`)} className="text-accent underline">Privacy Policy</Text>
                <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${ENV.API_BASE_URL}/terms`)} className="text-accent underline">Terms of Service</Text>
              </View>
              <Button title="Create account" disabled={!accepted} loading={busy} onPress={() => run(true)} />
              <Button title="Cancel" variant="ghost" disabled={busy} onPress={cancel} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
