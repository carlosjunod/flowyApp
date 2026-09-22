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
import { useI18n } from "@/lib/i18n";
import {
  availableDigestCadences,
  DIGEST_CADENCE_LABEL_KEYS,
  DIGEST_MONTH_DAYS,
  dateInZone,
  DIGEST_DAY_KEYS,
  DIGEST_DAY_SHORT_KEYS,
  DIGEST_TYPE_KEYS,
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
  const { t, tKey, locale, formatDateTime } = useI18n();
  const [view, setView] = useState<DigestSettings | null>(null);
  const [draft, setDraft] = useState<DigestPreferences | null>(null);
  // Status line and errors are translation keys so a language switch updates
  // whatever is currently on screen.
  const [messageKey, setMessageKey] = useState("");
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
      t('digest.settings.leaveTitle'),
      t('digest.settings.leaveBody'),
      [
        { text: t('digest.settings.keepEditing'), style: "cancel" },
        {
          text: t('digest.settings.discard'),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  async function load() {
    setLoading(true);
    setMessageKey("");
    try {
      const result = await api.getDigestSettings();
      if (result.error || !result.data.settings) {
        setMessageKey('digest.settings.loadFailed');
        return;
      }
      setView(result.data);
      setDraft(result.data.settings);
      setConflict(false);
    } catch {
      setMessageKey('digest.settings.loadFailed');
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
    setMessageKey("");
  }
  async function save() {
    if (!draft || !view || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessageKey("");
    try {
      const result = await api.patchDigestSettings({
        ...draft,
        expected_revision: view.revision || 0,
      });
      if (result.error) {
        setConflict(result.error.status === 409);
        setMessageKey(
          result.error.status === 409
            ? 'digest.settings.conflict'
            : 'digest.settings.saveFailed',
        );
        return;
      }
      setView(result.data);
      setDraft(result.data.settings || draft);
      setConflict(false);
      setMessageKey('digest.settings.savedNotice');
    } catch {
      setMessageKey('digest.settings.connectFailed');
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
              // A real bullet is AI output in the report language; the fallback
              // caption is interface copy.
              text:
                row.content.tldr?.bullets[0]?.text ||
                t('digest.settings.previewFallback'),
            }
          : { id: "", text: t('digest.settings.previewExampleText') },
      );
    } catch {
      setMessageKey('digest.settings.previewFailed');
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
      setMessageKey('digest.settings.excludeTooLong');
      return;
    }
    const next = toggleExclusion(draft[key], value);
    if (next.length > 30) {
      setMessageKey('digest.settings.excludeTooMany');
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
    Object.keys(DIGEST_TYPE_KEYS),
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
            accessibilityLabel={t('digest.settings.back')}
            disabled={busy}
            onPress={() => router.back()}
            className="min-h-12 min-w-12 flex-row items-center gap-2"
            style={{ opacity: 1 }}
          >
            <AppIcon name="arrow-left" color={colors.fg} />
            <Text className="font-sans text-base text-fg">{t('digest.settings.back')}</Text>
          </Pressable>
          {view && (
            <Text className="text-xs font-semibold text-muted uppercase tracking-widest flex-shrink text-right">
              {t('digest.settings.planLine', {
                // `effectivePlan` is a server-defined plan name, shown verbatim.
                plan: view.betaAccessEndsAt
                  ? t('digest.settings.planBeta')
                  : view.effectivePlan || t('digest.settings.planYour'),
                cadences: view.canEnableDaily
                  ? view.settings?.monthly_enabled !== undefined
                    ? t('digest.settings.planCadencesFullMonthly')
                    : t('digest.settings.planCadencesFull')
                  : t('digest.settings.planCadencesWeekly'),
              })}
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
              {t('digest.settings.eyebrow')}
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
              {t('digest.settings.title')}
            </Text>
            <Text className="font-sans text-sm text-muted leading-5 mt-2">
              {t('digest.settings.intro')}
            </Text>
            {view?.monthlyReportQuota && (
              <View className="mt-3 gap-1">
                <Text className="font-sans text-sm text-fg">
                  {t('digest.settings.quotaUsed', {
                    used: view.monthlyReportQuota.used,
                    limit: view.monthlyReportQuota.limit,
                  })}
                  {view.monthlyReportQuota.reserved > 0
                    ? t('digest.settings.quotaReserved', { count: view.monthlyReportQuota.reserved })
                    : ''}
                </Text>
                <Text className="font-sans text-xs text-muted">
                  {t('digest.settings.quotaResets', {
                    date: formatDateTime(view.monthlyReportQuota.resetsAt),
                  })}
                </Text>
                {view.monthlyReportQuota.remaining === 0 && (
                  <Text accessibilityRole="alert" className="font-sans text-sm text-muted">
                    {t('digest.settings.quotaExhausted')}
                  </Text>
                )}
              </View>
            )}
          </View>
          {loading ? (
            <View className="py-12 items-center gap-3">
              <ActivityIndicator color={colors.accent} />
              <Text className="font-sans text-muted">
                {t('digest.settings.loading')}
              </Text>
            </View>
          ) : !draft || !view ? (
            <View className="gap-2">
              <Text accessibilityRole="alert" className="font-sans text-fg">
                {messageKey ? tKey(messageKey) : ''}
              </Text>
              <DigestAction title={t('digest.settings.tryAgain')} onPress={() => void load()} />
            </View>
          ) : (
            <>
              {!view.capabilities?.enabled && (
                <Text className="font-sans text-sm text-muted leading-5">
                  {t('digest.settings.unavailable')}
                </Text>
              )}
              <PushNotificationSettings />
              <DigestSection
                title={t('digest.settings.scheduleTitle')}
                subtitle={t('digest.settings.scheduleSubtitle')}
              >
                {availableDigestCadences(draft).map((cadence) => {
                  const enabledKey = `${cadence}_enabled` as const;
                  const enabled = !!draft[enabledKey];
                  const locked = cadence !== "weekly" && !view.canEnableDaily;
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
                            name={cadence === "daily" ? "sun" : "calendar"}
                            color={colors.accent}
                          />
                        </View>
                        <View className="flex-1 gap-1">
                          <Text className="text-base text-fg font-semibold">
                            {tKey(DIGEST_CADENCE_LABEL_KEYS[cadence])}
                          </Text>
                          <Text className="font-sans text-sm text-muted">
                            {locked
                              ? t('digest.settings.lockedHint')
                              : cadence === "weekly"
                                ? t('digest.settings.weeklyHint')
                                : cadence === "monthly"
                                  ? t('digest.settings.monthlyHint')
                                  : t('digest.settings.dailyHint')}
                          </Text>
                        </View>
                        <Switch
                          thumbColor="#FFFFFF"
                          accessibilityLabel={t('digest.settings.cadenceToggle', { cadence: tKey(`digest.history.${cadence}`) })}
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
                                {t('digest.settings.publicationDay')}
                              </Text>
                              <View
                                className="flex-row flex-wrap gap-0.5 -mx-1.5"
                                accessibilityRole="radiogroup"
                                accessibilityLabel={t('digest.settings.weeklyDayGroup')}
                              >
                                {DIGEST_DAY_KEYS.map((dayKey, index) => (
                                  <DigestChip
                                    key={dayKey}
                                    // A Spanish abbreviation is not the first
                                    // three letters of the full name, so the
                                    // short form is its own key.
                                    label={tKey(DIGEST_DAY_SHORT_KEYS[index] ?? dayKey)}
                                    accessibilityLabel={tKey(dayKey)}
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
                          {cadence === "monthly" && (
                            <View className="gap-2">
                              <Text className="font-sans text-sm text-muted">{t('digest.settings.publicationDayOfMonth')}</Text>
                              <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup" accessibilityLabel={t('digest.settings.monthlyDayGroup')}>
                                {DIGEST_MONTH_DAYS.map(day => (
                                  <DigestChip key={day} label={String(day)} accessibilityLabel={t('digest.settings.monthlyDayLabel', { day })}
                                    compact role="radio" selected={(draft.monthly_day ?? 1) === day} disabled={busy}
                                    onPress={() => change("monthly_day", day)} />
                                ))}
                              </View>
                              <Text className="font-sans text-xs text-muted">{t('digest.settings.monthlyDaysHint')}</Text>
                            </View>
                          )}
                          <View className="gap-1 border-t border-border pt-3">
                            <Text className="font-sans text-sm text-muted">
                              {t('digest.settings.publicationTime')}
                            </Text>
                            <DigestDateField
                              label={t('digest.settings.publicationTimeLabel', { cadence: tKey(`digest.history.${cadence}`) })}
                              mode="time"
                              value={draft[`${cadence}_local_time`] ?? "08:00"}
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
                              ? t('digest.settings.windowWeekly', {
                                  day: tKey(DIGEST_DAY_KEYS[draft.weekly_day - 1] ?? DIGEST_DAY_KEYS[0]!),
                                  time: displayTime(draft.weekly_local_time, locale),
                                })
                              : cadence === "monthly"
                                ? t('digest.settings.windowMonthly', {
                                    day: draft.monthly_day ?? 1,
                                    time: displayTime(draft.monthly_local_time ?? "08:00", locale),
                                  })
                                : t('digest.settings.windowDaily', {
                                    time: displayTime(draft.daily_local_time, locale),
                                  })}
                          </Text>
                          {!dirty && !paused && next?.enabled && (
                            <Text className="font-sans text-xs text-muted">
                              {t('digest.settings.nextScheduled', {
                                date: new Date(next.next_run_at).toLocaleString(
                                  locale,
                                  {
                                    timeZone: draft.timezone,
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  },
                                ),
                              })}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
                {draft.daily_enabled && draft.weekly_enabled && !draft.monthly_enabled && (
                  <Text className="font-sans text-sm text-muted leading-5">
                    {t('digest.settings.weeklyReplacesDaily')}
                  </Text>
                )}
                {draft.monthly_enabled && (draft.weekly_enabled || draft.daily_enabled) && (
                  <Text className="font-sans text-sm text-muted leading-5">
                    {t('digest.settings.monthlyPriority')}
                  </Text>
                )}
                <View className="gap-2 pt-1">
                  <Text className="font-sans text-sm text-muted">
                    {t('digest.settings.timezone')}
                  </Text>
                  <DigestTimezone
                    value={draft.timezone}
                    onChange={(value) => change("timezone", value)}
                    disabled={busy}
                  />
                  <Text className="font-sans text-xs text-muted leading-5">
                    {deviceTimezone === draft.timezone
                      ? t('digest.settings.timezoneMatches')
                      : t('digest.settings.timezoneDiffers', {
                          timezone: deviceTimezone.replaceAll("_", " "),
                        })}
                  </Text>
                </View>
              </DigestSection>
              <DigestSection
                title={t('digest.settings.contentTitle')}
                subtitle={t('digest.settings.contentSubtitle')}
              >
                <View className="bg-surface rounded-xl border border-border p-5 gap-5">
                  <View className="gap-3">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <Text className="text-base text-fg font-semibold">
                        {t('digest.settings.categories')}
                      </Text>
                      <Text className="font-sans text-xs text-muted">
                        {draft.excluded_categories.length
                          ? t('digest.settings.excludedCount', { count: draft.excluded_categories.length })
                          : t('digest.settings.allIncluded')}
                      </Text>
                    </View>
                    {categoryState === "loading" && (
                      <Text className="font-sans text-sm text-muted">
                        {t('digest.settings.categoriesLoading')}
                      </Text>
                    )}
                    {categoryState === "error" && (
                      <View>
                        <Text className="font-sans text-sm text-muted">
                          {t('digest.settings.categoriesFailed')}
                        </Text>
                        <DigestAction
                          title={t('digest.settings.categoriesRetry')}
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
                        {t('digest.settings.categoriesEmpty')}
                      </Text>
                    )}
                    <Text className="font-sans text-xs text-muted">
                      {t('digest.settings.categoriesAuto')}
                    </Text>
                  </View>
                  <View className="gap-3 border-t border-border pt-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-2">
                      <Text className="text-base text-fg font-semibold">
                        {t('digest.settings.contentTypes')}
                      </Text>
                      <Text className="font-sans text-xs text-muted">
                        {draft.excluded_types.length
                          ? t('digest.settings.excludedCount', { count: draft.excluded_types.length })
                          : t('digest.settings.allIncluded')}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      {visibleTypes.map((type) => (
                        <DigestChip
                          key={type}
                          // An unknown type from a newer server falls back to
                          // its raw enum value rather than an empty chip.
                          label={DIGEST_TYPE_KEYS[type] ? tKey(DIGEST_TYPE_KEYS[type]) : type}
                          selected={!draft.excluded_types.includes(type)}
                          disabled={busy}
                          onPress={() => toggleFilter("excluded_types", type)}
                        />
                      ))}
                    </View>
                    <DigestAction
                      title={
                        moreTypes
                          ? t('digest.settings.showFewerTypes')
                          : t('digest.settings.showAllTypes', { count: allTypes.length })
                      }
                      disabled={busy}
                      onPress={() => setMoreTypes(!moreTypes)}
                    />
                    <Text className="font-sans text-xs text-muted leading-5">
                      {t('digest.settings.typesHint')}
                    </Text>
                  </View>
                </View>
              </DigestSection>
              {/* D-041: this is the language the REPORT is generated in, a
                  server-side preference. It is intentionally separate from the
                  app's interface language and is never changed by it. */}
              <DigestSection
                title={t('digest.settings.languageTitle')}
                subtitle={t('digest.settings.languageSubtitle')}
              >
                <View
                  className="flex-row flex-wrap gap-2"
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t('digest.settings.languageGroup')}
                >
                  <DigestChip
                    label={t('common.language.english')}
                    role="radio"
                    selected={draft.locale === "en"}
                    disabled={busy}
                    onPress={() => change("locale", "en")}
                  />
                  <DigestChip
                    label={t('common.language.spanish')}
                    role="radio"
                    selected={draft.locale === "es"}
                    disabled={busy}
                    onPress={() => change("locale", "es")}
                  />
                </View>
                <Text className="font-sans text-xs text-muted leading-5">
                  {t('digest.settings.languageNote')}
                </Text>
              </DigestSection>
              <DigestSection
                title={t('digest.settings.deliveryTitle')}
                subtitle={t('digest.settings.deliverySubtitle')}
              >
                {draft.weekly_enabled || draft.daily_enabled || draft.monthly_enabled ? (
                  <View className="bg-surface rounded-xl border border-border p-5 gap-4">
                    {availableDigestCadences(draft)
                      .filter((cadence) => draft[`${cadence}_enabled`])
                      .map((cadence) => (
                        <View key={cadence} className="gap-3">
                          <Text className="text-base text-fg font-semibold">
                            {tKey(DIGEST_CADENCE_LABEL_KEYS[cadence])}
                          </Text>
                          {(["push", "email"] as const).map((channel) => {
                            const key =
                              `${cadence}_${channel}_enabled` as const;
                            const channelLabel = channel === "push"
                              ? t('digest.settings.channelPush')
                              : t('digest.settings.channelEmail');
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
                                  {channelLabel}
                                </Text>
                                <Switch
                                  thumbColor="#FFFFFF"
                                  accessibilityLabel={t('digest.settings.channelToggle', { cadence: tKey(`digest.history.${cadence}`), channel: channelLabel })}
                                  value={!!draft[key]}
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
                        {t('digest.settings.pushUnavailable')}
                      </Text>
                    )}
                    {!view.hasPushDevice && view.capabilities?.push && (
                      <View>
                        <Text className="font-sans text-sm text-muted">
                          {t('digest.settings.pushNoDevice')}
                        </Text>
                        <DigestAction
                          title={t('digest.settings.pushEnable')}
                          disabled={busy}
                          onPress={() => {
                            void registerPushForCurrentUser(true, t('settings.notifications.channelName'))
                              .then((result) => setMessageKey(result.messageKey))
                              .catch(() => setMessageKey('digest.settings.pushEnableFailed'));
                          }}
                        />
                      </View>
                    )}
                    <Text className="font-sans text-sm text-muted leading-5">
                      {!view.capabilities?.email
                        ? t('digest.settings.emailUnavailable')
                        : !view.emailVerified
                          ? t('digest.settings.emailUnverified')
                          : t('digest.settings.emailGoesTo', {
                              address: view.emailAddress || t('digest.settings.emailVerifiedAddress'),
                            })}
                      {view.emailSuppressed ? t('digest.settings.emailSuppressed') : ""}
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-sm text-muted">
                    {t('digest.settings.deliveryNone')}
                  </Text>
                )}
              </DigestSection>
              <DigestSection
                title={t('digest.settings.pauseTitle')}
                subtitle={t('digest.settings.pauseSubtitle')}
              >
                {paused ? (
                  <View className="bg-surface border border-border rounded-xl p-5 gap-2">
                    <Text className="text-base text-fg font-semibold">
                      {t('digest.settings.paused')}
                    </Text>
                    <Text className="font-sans text-sm text-muted">
                      {t('digest.settings.resumeOn')}
                    </Text>
                    <DigestDateField
                      label={t('digest.settings.resumeField')}
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
                      {t('digest.settings.resumeHint', {
                        date: new Date(draft.paused_until!).toLocaleString(locale, {
                          timeZone: draft.timezone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                        timezone: draft.timezone.replaceAll("_", " "),
                      })}
                    </Text>
                    <DigestAction
                      title={t('digest.settings.resumeNow')}
                      disabled={busy}
                      onPress={() => change("paused_until", null)}
                    />
                  </View>
                ) : (
                  <DigestAction
                    title={t('digest.settings.pauseWeek')}
                    disabled={
                      busy || (!draft.daily_enabled && !draft.weekly_enabled && !draft.monthly_enabled)
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
                  title={t('digest.settings.turnOff')}
                  disabled={
                    busy || (!draft.daily_enabled && !draft.weekly_enabled && !draft.monthly_enabled)
                  }
                  onPress={() => {
                    setDraft({
                      ...draft,
                      daily_enabled: false,
                      weekly_enabled: false,
                      ...(draft.monthly_enabled !== undefined ? { monthly_enabled: false } : {}),
                    });
                    setMessageKey("");
                  }}
                />
              </DigestSection>
              <View className="border-t border-border pt-3 gap-3">
                <DigestAction
                  title={previewBusy ? t('digest.settings.previewLoading') : t('digest.settings.preview')}
                  disabled={busy || previewBusy}
                  onPress={() => void showPreview()}
                />
                {preview && (
                  <View className="bg-surface border border-border rounded-xl p-5 gap-3">
                    <Text className="text-sm text-fg font-semibold">
                      {preview.id
                        ? t('digest.settings.previewPublished')
                        : t('digest.settings.previewExample')}
                    </Text>
                    <Text className="font-sans text-base text-muted leading-6">
                      {preview.text}
                    </Text>
                    {preview.id && (
                      <>
                        <DigestAction
                          title={t('digest.settings.openReport')}
                          onPress={() => router.push(`/digest/${preview.id}`)}
                        />
                        <DigestAction
                          title={t('digest.settings.emailReport')}
                          disabled={
                            busy ||
                            !view.capabilities?.email ||
                            !view.emailVerified
                          }
                          onPress={() => {
                            void api
                              .testDigestEmail(preview.id)
                              .then((result) =>
                                setMessageKey(
                                  result.error
                                    ? 'digest.settings.testRateLimited'
                                    : 'digest.settings.testQueued',
                                ),
                              )
                              .catch(() => setMessageKey('digest.settings.testFailed'));
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
            {!!messageKey && (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                className="font-sans text-sm text-fg"
              >
                {tKey(messageKey)}
              </Text>
            )}
            {conflict && (
              <DigestAction
                title={t('digest.settings.reloadSaved')}
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    t('digest.settings.reloadTitle'),
                    t('digest.settings.reloadBody'),
                    [
                      { text: t('digest.settings.keepEditing'), style: "cancel" },
                      { text: t('digest.settings.reload'), onPress: () => void load() },
                    ],
                  )
                }
              />
            )}
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="font-sans text-xs text-muted flex-shrink">
                {busy
                  ? t('digest.settings.statusSaving')
                  : dirty
                    ? t('digest.settings.statusDirty')
                    : paused
                      ? t('digest.settings.statusPaused')
                      : draft.weekly_enabled || draft.daily_enabled || draft.monthly_enabled
                        ? t('digest.settings.statusScheduled')
                        : t('digest.settings.statusOff')}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="active:opacity-70"
                accessibilityLabel={t('digest.settings.save')}
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
                    {dirty ? t('digest.settings.save') : t('digest.settings.saved')}
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
