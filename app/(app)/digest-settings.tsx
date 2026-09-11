import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  DigestAction,
  DigestChip,
  DigestSection,
  DigestTimezone,
} from "@/components/digest/DigestControls";
import { DigestDateField } from "@/components/digest/DigestDateField";
import { api } from "@/lib/api";
import { useDigestColors, useDigestVars } from "@/lib/digestAppearance";
import { useDigestCategories } from "@/hooks/useDigestCategories";
import { registerPushForCurrentUser } from "@/hooks/usePushRegistration";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";
import {
  dateInZone,
  DIGEST_DAYS,
  DIGEST_TYPES,
  displayTime,
  exclusionChoices,
  preferencesChanged,
  resumeAtDate,
  suggestedResumeDate,
  toggleExclusion,
} from "@/lib/digestSettings";
import type { DigestPreferences, DigestSettings } from "@/types";

export default function DigestSettingsScreen() {
  const colors = useDigestColors();
  const appearance = useDigestVars();
  const navigation = useNavigation();
  const [view, setView] = useState<DigestSettings | null>(null);
  const [draft, setDraft] = useState<DigestPreferences | null>(null);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const categoryQuery = useDigestCategories();
  const categories = categoryQuery.data ?? [];
  const categoryState = categoryQuery.isPending
    ? "loading"
    : categoryQuery.isError
      ? "error"
      : "ready";
  const [moreTypes, setMoreTypes] = useState(false);
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  const saving = useRef(false);
  const dirty = preferencesChanged(view?.settings, draft);

  usePreventRemove(dirty || busy, ({ data }) => {
    if (saving.current) return;
    Alert.alert(
      "Leave without saving?",
      "Your digest choices have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const result = await api.getDigestSettings();
      if (result.error || !result.data.settings) {
        setMessage("Could not load digest settings. Please try again.");
        return;
      }
      setView(result.data);
      setDraft(result.data.settings);
      setConflict(false);
    } catch {
      setMessage("Could not load digest settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function change<K extends keyof DigestPreferences>(
    key: K,
    value: DigestPreferences[K],
  ) {
    if (saving.current) return;
    setDraft((old) => (old ? { ...old, [key]: value } : old));
    setMessage("");
  }
  async function save() {
    if (!draft || !view || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await api.patchDigestSettings({
        ...draft,
        expected_revision: view.revision || 0,
      });
      if (result.error) {
        setConflict(result.error.status === 409);
        setMessage(
          result.error.status === 409
            ? "Changed on another device. Your edits are still here. Reload to get the saved choices."
            : "Could not save your choices. Your edits are still here. Please try again.",
        );
        return;
      }
      setView(result.data);
      setDraft(result.data.settings || draft);
      setConflict(false);
      setMessage("Your digest choices are saved.");
    } catch {
      setMessage(
        "Could not connect. Your edits are still here. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function showPreview() {
    setPreviewBusy(true);
    try {
      const result = await api.listDigestPage(null);
      const row = result.items[0];
      setPreview(
        row
          ? {
              id: row.id,
              text:
                row.content.tldr?.bullets[0]?.text || "Your published report",
            }
          : {
              id: "",
              text: "Two articles explored how short breaks support focus. Compare their evidence by opening the sources.",
            },
      );
    } catch {
      setMessage("Could not load the preview. Please try again.");
    } finally {
      setPreviewBusy(false);
    }
  }
  function toggleFilter(
    key: "excluded_types" | "excluded_categories",
    value: string,
  ) {
    if (!draft) return;
    if (
      value.length > (key === "excluded_categories" ? 64 : 40) &&
      !draft[key].includes(value)
    ) {
      setMessage(
        "This saved label is too long to exclude. Rename it in your library first.",
      );
      return;
    }
    const next = toggleExclusion(draft[key], value);
    if (next.length > 30) {
      setMessage(
        "You can exclude up to 30 choices in each group. Include one before excluding another.",
      );
      return;
    }
    change(key, next);
  }
  const paused =
    !!draft?.paused_until && Date.parse(draft.paused_until) > Date.now();
  const allCategories = exclusionChoices(
    categories,
    draft?.excluded_categories ?? [],
  );
  const allTypes = exclusionChoices(
    Object.keys(DIGEST_TYPES),
    draft?.excluded_types ?? [],
  );
  const visibleTypes = moreTypes
    ? allTypes
    : allTypes.filter(
        (key) =>
          [
            "url",
            "youtube",
            "pdf",
            "audio",
            "receipt",
            "email",
            "note",
          ].includes(key) || draft?.excluded_types.includes(key),
      );
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <SafeAreaView
      className="flex-1 bg-bg"
      style={appearance}
      edges={["top", "left", "right", "bottom"]}
    >
      <View
        style={{ width: "100%", maxWidth: 672, alignSelf: "center", flex: 1 }}
      >
        <View className="px-5 pt-1 pb-2 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            disabled={busy}
            onPress={() => router.back()}
            className="min-h-12 min-w-12 flex-row items-center gap-2"
            style={{ opacity: 1 }}
          >
            <AppIcon name="arrow-left" color={colors.fg} />
            <Text className="font-sans text-base text-fg">Back</Text>
          </Pressable>
          {view && (
            <Text className="text-xs font-semibold text-muted uppercase tracking-widest flex-shrink text-right">
              {view.betaAccessEndsAt ? "Beta Pro" : view.effectivePlan || "Your plan"} ·{" "}
              {view.canEnableDaily ? "Daily + weekly" : "Weekly"}
            </Text>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32,
            gap: 24,
          }}
        >
          <View className="gap-1">
            <Text
              className="text-xs font-medium uppercase text-muted"
              style={{ letterSpacing: 1.92 }}
            >
              Settings
            </Text>
            <Text
              accessibilityRole="header"
              className="text-fg"
              style={{
                fontFamily: "InstrumentSerif_400Regular",
                fontSize: 36,
                lineHeight: 40,
                letterSpacing: -0.36,
              }}
            >
              Digests
            </Text>
            <Text className="font-sans text-sm text-muted leading-5 mt-2">
              A few ideas worth keeping. Choose your rhythm, then save your
              choices.
            </Text>
          </View>
          {loading ? (
            <View className="py-12 items-center gap-3">
              <ActivityIndicator color={colors.accent} />
              <Text className="font-sans text-muted">
                Loading your choices…
              </Text>
            </View>
          ) : !draft || !view ? (
            <View className="gap-2">
              <Text accessibilityRole="alert" className="font-sans text-fg">
                {message}
              </Text>
              <DigestAction title="Try again" onPress={() => void load()} />
            </View>
          ) : (
            <>
              {!view.capabilities?.enabled && (
                <Text className="font-sans text-sm text-muted leading-5">
                  Digest subscriptions are temporarily unavailable. You can
                  still update your preferences or turn off existing digests.
                </Text>
              )}
              <PushNotificationSettings />
              <DigestSection
                title="Schedule"
                subtitle="Choose when to bring your saved ideas back."
              >
                {(["weekly", "daily"] as const).map((cadence) => {
                  const enabledKey = `${cadence}_enabled` as const;
                  const enabled = draft[enabledKey];
                  const locked = cadence === "daily" && !view.canEnableDaily;
                  const next = view.next?.find(
                    (entry) => entry.cadence === cadence,
                  );
                  return (
                    <View
                      key={cadence}
                      className="bg-surface rounded-xl border border-border p-5 gap-4"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-xl border border-accent/20 bg-accent/10 items-center justify-center">
                          <AppIcon
                            name={cadence === "weekly" ? "calendar" : "sun"}
                            color={colors.accent}
                          />
                        </View>
                        <View className="flex-1 gap-1">
                          <Text className="text-base text-fg font-semibold">
                            {cadence === "weekly"
                              ? "Weekly digest"
                              : "Daily digest"}
                          </Text>
                          <Text className="font-sans text-sm text-muted">
                            {locked
                              ? "Available on paid plans"
                              : cadence === "weekly"
                                ? "A little perspective, once a week"
                                : "A moment for yesterday’s ideas"}
                          </Text>
                        </View>
                        <Switch
                          thumbColor="#FFFFFF"
                          accessibilityLabel={`${cadence} digest`}
                          value={enabled}
                          trackColor={{ true: colors.accent }}
                          disabled={
                            busy ||
                            ((!view.capabilities?.enabled || locked) &&
                              !enabled)
                          }
                          onValueChange={(value) => change(enabledKey, value)}
                        />
                      </View>
                      {enabled && (
                        <>
                          {cadence === "weekly" && (
                            <View className="gap-2">
                              <Text className="font-sans text-sm text-muted">
                                Publication day
                              </Text>
                              <View
                                className="flex-row flex-wrap gap-0.5 -mx-1.5"
                                accessibilityRole="radiogroup"
                                accessibilityLabel="Weekly publication day"
                              >
                                {DIGEST_DAYS.map((day, index) => (
                                  <DigestChip
                                    key={day}
                                    label={day.slice(0, 3)}
                                    accessibilityLabel={day}
                                    compact
                                    role="radio"
                                    selected={draft.weekly_day === index + 1}
                                    disabled={busy}
                                    onPress={() =>
                                      change("weekly_day", index + 1)
                                    }
                                  />
                                ))}
                              </View>
                            </View>
                          )}
                          <View className="gap-1 border-t border-border pt-3">
                            <Text className="font-sans text-sm text-muted">
                              Publication time
                            </Text>
                            <DigestDateField
                              label={`${cadence} publication time`}
                              mode="time"
                              value={draft[`${cadence}_local_time`]}
                              disabled={busy}
                              onChange={(value) =>
                                change(`${cadence}_local_time`, value)
                              }
                            />
                            <Text className="font-sans text-xs text-muted">
                              {draft.timezone.replaceAll("_", " ")}
                            </Text>
                          </View>
                          <Text className="font-sans text-sm text-muted leading-5">
                            {cadence === "weekly"
                              ? `Every ${DIGEST_DAYS[draft.weekly_day - 1]} at ${displayTime(draft.weekly_local_time)} · the previous 7 complete days.`
                              : `Every day at ${displayTime(draft.daily_local_time)} · the previous complete day.`}
                          </Text>
                          {!dirty && !paused && next?.enabled && (
                            <Text className="font-sans text-xs text-muted">
                              Next scheduled:{" "}
                              {new Date(next.next_run_at).toLocaleString(
                                undefined,
                                {
                                  timeZone: draft.timezone,
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
                {draft.daily_enabled && draft.weekly_enabled && (
                  <Text className="font-sans text-sm text-muted leading-5">
                    On your weekly digest day, it replaces the daily one. You’ll
                    receive at most one report per day.
                  </Text>
                )}
                <View className="gap-2 pt-1">
                  <Text className="font-sans text-sm text-muted">
                    Schedule timezone
                  </Text>
                  <DigestTimezone
                    value={draft.timezone}
                    onChange={(value) => change("timezone", value)}
                    disabled={busy}
                  />
                  <Text className="font-sans text-xs text-muted leading-5">
                    {deviceTimezone === draft.timezone
                      ? "Matches this device. Your schedule stays in this timezone when you travel."
                      : `This device uses ${deviceTimezone.replaceAll("_", " ")}. Your digest follows the timezone above.`}
                  </Text>
                </View>
              </DigestSection>
              <DigestSection
                title="What goes in"
                subtitle="Checked tags are included. Tap to exclude; tap again to include."
              >
                <View className="bg-surface rounded-xl border border-border p-5 gap-5">
                  <View className="gap-3">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <Text className="text-base text-fg font-semibold">
                        Categories
                      </Text>
                      <Text className="font-sans text-xs text-muted">
                        {draft.excluded_categories.length
                          ? `${draft.excluded_categories.length} excluded`
                          : "All included"}
                      </Text>
                    </View>
                    {categoryState === "loading" && (
                      <Text className="font-sans text-sm text-muted">
                        Loading your library categories…
                      </Text>
                    )}
                    {categoryState === "error" && (
                      <View>
                        <Text className="font-sans text-sm text-muted">
                          Could not load your categories. Your saved exclusions
                          are preserved.
                        </Text>
                        <DigestAction
                          title="Retry categories"
                          onPress={() => void categoryQuery.refetch()}
                          disabled={busy}
                        />
                      </View>
                    )}
                    <View className="flex-row flex-wrap gap-2">
                      {allCategories.map((category) => (
                        <DigestChip
                          key={category}
                          label={category}
                          selected={
                            !draft.excluded_categories.includes(category)
                          }
                          disabled={busy}
                          onPress={() =>
                            toggleFilter("excluded_categories", category)
                          }
                        />
                      ))}
                    </View>
                    {categoryState === "ready" && !allCategories.length && (
                      <Text className="font-sans text-sm text-muted leading-5">
                        All categories are included. As you save items, their
                        categories will appear here.
                      </Text>
                    )}
                    <Text className="font-sans text-xs text-muted">
                      New categories are included automatically.
                    </Text>
                  </View>
                  <View className="gap-3 border-t border-border pt-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <Text className="text-base text-fg font-semibold">
                        Content types
                      </Text>
                      <Text className="font-sans text-xs text-muted">
                        {draft.excluded_types.length
                          ? `${draft.excluded_types.length} excluded`
                          : "All included"}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {visibleTypes.map((type) => (
                        <DigestChip
                          key={type}
                          label={DIGEST_TYPES[type] || type}
                          selected={!draft.excluded_types.includes(type)}
                          disabled={busy}
                          onPress={() => toggleFilter("excluded_types", type)}
                        />
                      ))}
                    </View>
                    <DigestAction
                      title={
                        moreTypes
                          ? "Show fewer types"
                          : `Show all ${allTypes.length} types`
                      }
                      disabled={busy}
                      onPress={() => setMoreTypes(!moreTypes)}
                    />
                    <Text className="font-sans text-xs text-muted leading-5">
                      Receipts, emails and private notes start excluded. Only
                      include what you want resurfaced.
                    </Text>
                  </View>
                </View>
              </DigestSection>
              <DigestSection
                title="Language"
                subtitle="The language your digest is written in."
              >
                <View
                  className="flex-row flex-wrap gap-2"
                  accessibilityRole="radiogroup"
                  accessibilityLabel="Digest language"
                >
                  <DigestChip
                    label="English"
                    role="radio"
                    selected={draft.locale === "en"}
                    disabled={busy}
                    onPress={() => change("locale", "en")}
                  />
                  <DigestChip
                    label="Español"
                    role="radio"
                    selected={draft.locale === "es"}
                    disabled={busy}
                    onPress={() => change("locale", "es")}
                  />
                </View>
              </DigestSection>
              <DigestSection
                title="How it reaches you"
                subtitle="Every published digest is saved in the app. Notifications and email are optional."
              >
                {draft.weekly_enabled || draft.daily_enabled ? (
                  <View className="bg-surface rounded-xl border border-border p-5 gap-4">
                    {(["weekly", "daily"] as const)
                      .filter((cadence) => draft[`${cadence}_enabled`])
                      .map((cadence) => (
                        <View key={cadence} className="gap-3">
                          <Text className="text-base text-fg font-semibold">
                            {cadence === "weekly"
                              ? "Weekly digest"
                              : "Daily digest"}
                          </Text>
                          {(["push", "email"] as const).map((channel) => {
                            const key =
                              `${cadence}_${channel}_enabled` as const;
                            return (
                              <View
                                key={channel}
                                className="flex-row items-center gap-3 min-h-12"
                              >
                                <AppIcon
                                  name={channel === "push" ? "bell" : "mail"}
                                  color={colors.muted}
                                />
                                <Text className="font-sans text-base text-fg flex-1">
                                  {channel === "push"
                                    ? "Push notification"
                                    : "Email"}
                                </Text>
                                <Switch
                                  thumbColor="#FFFFFF"
                                  accessibilityLabel={`${cadence} ${channel}`}
                                  value={draft[key]}
                                  trackColor={{ true: colors.accent }}
                                  disabled={
                                    busy ||
                                    ((!view.capabilities?.[channel] ||
                                      (channel === "email" &&
                                        !view.emailVerified)) &&
                                      !draft[key])
                                  }
                                  onValueChange={(value) => change(key, value)}
                                />
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    {!view.capabilities?.push && (
                      <Text className="font-sans text-sm text-muted">
                        Push delivery is temporarily unavailable.
                      </Text>
                    )}
                    {!view.hasPushDevice && view.capabilities?.push && (
                      <View>
                        <Text className="font-sans text-sm text-muted">
                          Enable notifications on this device to receive push
                          alerts.
                        </Text>
                        <DigestAction
                          title="Enable device notifications"
                          disabled={busy}
                          onPress={() => {
                            void registerPushForCurrentUser(true)
                              .then((result) => setMessage(result.message))
                              .catch(() =>
                                setMessage(
                                  "Could not enable notifications. Please try again.",
                                ),
                              );
                          }}
                        />
                      </View>
                    )}
                    <Text className="font-sans text-sm text-muted leading-5">
                      {!view.capabilities?.email
                        ? "Email delivery is temporarily unavailable."
                        : !view.emailVerified
                          ? "Verify your account email to enable email delivery."
                          : `Email goes to ${view.emailAddress || "your verified address"}.`}
                      {view.emailSuppressed
                        ? " Email delivery is currently suppressed for this address."
                        : ""}
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-sm text-muted">
                    Turn on a digest above to choose its delivery channels.
                  </Text>
                )}
              </DigestSection>
              <DigestSection
                title="Need a break?"
                subtitle="Pause delivery while keeping your schedule and history."
              >
                {paused ? (
                  <View className="bg-surface border border-border rounded-xl p-5 gap-2">
                    <Text className="text-base text-fg font-semibold">
                      Digests paused
                    </Text>
                    <Text className="font-sans text-sm text-muted">
                      Resume on
                    </Text>
                    <DigestDateField
                      label="Resume digests on"
                      mode="date"
                      value={dateInZone(
                        new Date(draft.paused_until!),
                        draft.timezone,
                      )}
                      minimumDate={suggestedResumeDate(draft.timezone, 1)}
                      disabled={busy}
                      onChange={(value) =>
                        change(
                          "paused_until",
                          resumeAtDate(value, draft.timezone),
                        )
                      }
                    />
                    <Text className="font-sans text-xs text-muted leading-5">
                      From{" "}
                      {new Date(draft.paused_until!).toLocaleString(undefined, {
                        timeZone: draft.timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      in {draft.timezone.replaceAll("_", " ")}, your regular
                      schedule resumes.
                    </Text>
                    <DigestAction
                      title="Resume now"
                      disabled={busy}
                      onPress={() => change("paused_until", null)}
                    />
                  </View>
                ) : (
                  <DigestAction
                    title="Pause for a week…"
                    disabled={
                      busy || (!draft.daily_enabled && !draft.weekly_enabled)
                    }
                    onPress={() =>
                      change(
                        "paused_until",
                        resumeAtDate(
                          suggestedResumeDate(draft.timezone),
                          draft.timezone,
                        ),
                      )
                    }
                  />
                )}
                <DigestAction
                  title="Turn off all digests"
                  disabled={
                    busy || (!draft.daily_enabled && !draft.weekly_enabled)
                  }
                  onPress={() => {
                    setDraft({
                      ...draft,
                      daily_enabled: false,
                      weekly_enabled: false,
                    });
                    setMessage("");
                  }}
                />
              </DigestSection>
              <View className="border-t border-border pt-3 gap-3">
                <DigestAction
                  title={previewBusy ? "Loading preview…" : "Preview a digest"}
                  disabled={busy || previewBusy}
                  onPress={() => void showPreview()}
                />
                {preview && (
                  <View className="bg-surface border border-border rounded-xl p-5 gap-3">
                    <Text className="text-sm text-fg font-semibold">
                      {preview.id
                        ? "Your published report · saved settings"
                        : "Fictional example · no personal content"}
                    </Text>
                    <Text className="font-sans text-base text-muted leading-6">
                      {preview.text}
                    </Text>
                    {preview.id && (
                      <>
                        <DigestAction
                          title="Open report"
                          onPress={() => router.push(`/digest/${preview.id}`)}
                        />
                        <DigestAction
                          title="Email this report to me"
                          disabled={
                            busy ||
                            !view.capabilities?.email ||
                            !view.emailVerified
                          }
                          onPress={() => {
                            void api
                              .testDigestEmail(preview.id)
                              .then((result) =>
                                setMessage(
                                  result.error
                                    ? "Could not queue a test email. Save your email choice first; limit 1/hour and 3/day."
                                    : "Test email queued.",
                                ),
                              )
                              .catch(() =>
                                setMessage(
                                  "Could not queue a test email. Please try again.",
                                ),
                              );
                          }}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
        {draft && view && (
          <View className="px-5 pt-3 pb-3 bg-bg border-t border-border gap-2">
            {!!message && (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="font-sans text-sm text-fg"
              >
                {message}
              </Text>
            )}
            {conflict && (
              <DigestAction
                title="Reload saved choices"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    "Replace your edits?",
                    "Reloading replaces your unsaved choices with the settings from your other device.",
                    [
                      { text: "Keep editing", style: "cancel" },
                      { text: "Reload", onPress: () => void load() },
                    ],
                  )
                }
              />
            )}
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-sans text-xs text-muted flex-shrink">
                {busy
                  ? "Saving your choices…"
                  : dirty
                    ? "Unsaved changes"
                    : paused
                      ? "Digests are paused"
                      : draft.weekly_enabled || draft.daily_enabled
                        ? "Your schedule is saved"
                        : "Digests are off"}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="active:opacity-70"
                accessibilityLabel="Save choices"
                accessibilityState={{
                  disabled: busy || !dirty || conflict,
                  busy,
                }}
                disabled={busy || !dirty || conflict}
                onPress={() => void save()}
                style={{
                  minHeight: 48,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  backgroundColor: dirty ? colors.primary : colors.surface,
                  opacity: busy || conflict ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text
                    style={{
                      color: dirty ? colors.bg : colors.muted,
                      fontWeight: "600",
                      fontSize: 14,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    {dirty ? "Save choices" : "Saved"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
