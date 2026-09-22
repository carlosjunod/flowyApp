import { FileTextPreview } from "./FileTextPreview";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { pb } from "@/lib/pb";
import type { Item } from "@/types";
import {
  analysisLabelKey,
  formatFileBytes,
  type OriginalFile,
} from "@/types/files";
export function OriginalFiles({ item }: { item: Item }) {
  const { t, tKey, locale, formatNumber } = useI18n();
  const [files, setFiles] = useState<OriginalFile[]>([]),
    // A translation key, so a language switch relabels a visible failure.
    [errorKey, setErrorKey] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const token = pb.authStore.token;
    setFiles([]);
    setErrorKey("");
    if (item.r2_key || item.document_processing)
      void api.listOriginalFiles(item.id).then((result) => {
        if (cancelled || pb.authStore.token !== token) return;
        if (result.error) setErrorKey("inbox.files.loadFailed");
        else setFiles(result.data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.user, item.updated, version]);
  async function download(id: string) {
    setBusy(true);
    setErrorKey("");
    const token = pb.authStore.token;
    try {
      const result = await api.downloadOriginal(id);
      if (result.error || !result.data) throw new Error();
      if (pb.authStore.token !== token) return;
      await Linking.openURL(result.data.url);
    } catch {
      setErrorKey("inbox.files.openFailed");
    } finally {
      setBusy(false);
    }
  }
  if (!files.length && !errorKey) return null;
  return (
    <View
      accessibilityLabel={t("inbox.files.heading")}
      className="my-4 border-y border-border py-4"
    >
      <Text className="mb-2 font-semibold text-fg">{t("inbox.files.heading")}</Text>
      {files.map((file) => (
        <View key={file.id} className="flex-row items-start gap-3 py-2">
          <View className="flex-1">
            {/* The filename is the user's own. */}
            <Text className="text-fg">{file.name}</Text>
            <Text className="mt-1 text-xs text-muted">
              {file.originalAvailable === false && file.analysis.state !== 'uploading'
                ? file.removalPending
                  ? t("inbox.files.cleanupPrefix")
                  : t("inbox.files.removedPrefix")
                : ""}
              {formatFileBytes(file.size, locale)} ·{" "}
              {tKey(analysisLabelKey(file.analysis.state))}
            </Text>
            {file.analysis.pages !== undefined ? (
              <Text className="mt-1 text-xs text-muted">
                {t("inbox.files.pagesProcessed", {
                  processed: formatNumber(file.analysis.processedPages || 0),
                  total: formatNumber(file.analysis.pages),
                })}
              </Text>
            ) : null}
            {/* Worker-supplied detail, shown as received. */}
            {file.analysis.message ? (
              <Text className="mt-1 text-xs text-muted">
                {file.analysis.message}
              </Text>
            ) : null}
            <FileTextPreview id={file.id} />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={
              busy ||
              file.originalAvailable === false ||
              file.analysis.state === "uploading"
            }
            onPress={() => void download(file.id)}
            className="min-h-[44px] justify-center px-2"
          >
            <Text className="text-accent">{t("inbox.files.download")}</Text>
          </Pressable>
        </View>
      ))}
      {item.document_processing?.state === "partial" ? (
        <Text className="my-2 text-sm text-muted">
          {t("inbox.files.partialAnalysis")}
        </Text>
      ) : null}
      {files.some(
        (f) =>
          f.originalAvailable !== false &&
          ["partial", "error"].includes(f.analysis.state),
      ) ? (
        <Pressable
          accessibilityRole="button"
          disabled={
            busy || item.status === "pending" || item.status === "processing"
          }
          onPress={() => {
            setBusy(true);
            void api
              .reloadItem(item.id)
              .then((result) => {
                if (result.error) setErrorKey("inbox.files.restartFailed");
                else setVersion((v) => v + 1);
              })
              .finally(() => setBusy(false));
          }}
          className="min-h-[44px] justify-center"
        >
          <Text className="text-accent">{t("inbox.files.retryAnalysis")}</Text>
        </Pressable>
      ) : null}
      {errorKey ? (
        <View>
          <Text accessibilityRole="alert" className="text-muted">
            {tKey(errorKey)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVersion((v) => v + 1)}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-accent">{t("inbox.files.tryAgain")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
