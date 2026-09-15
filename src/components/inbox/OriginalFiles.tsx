import { FileTextPreview } from "./FileTextPreview";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { pb } from "@/lib/pb";
import type { Item } from "@/types";
import {
  analysisLabel,
  formatFileBytes,
  type OriginalFile,
} from "@/types/files";
export function OriginalFiles({ item }: { item: Item }) {
  const [files, setFiles] = useState<OriginalFile[]>([]),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const token = pb.authStore.token;
    setFiles([]);
    setError("");
    if (item.r2_key || item.document_processing)
      void api.listOriginalFiles(item.id).then((result) => {
        if (cancelled || pb.authStore.token !== token) return;
        if (result.error) setError("Could not load original files.");
        else setFiles(result.data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.user, item.updated, version]);
  async function download(id: string) {
    setBusy(true);
    setError("");
    const token = pb.authStore.token;
    try {
      const result = await api.downloadOriginal(id);
      if (result.error || !result.data) throw new Error();
      if (pb.authStore.token !== token) return;
      await Linking.openURL(result.data.url);
    } catch {
      setError("Could not open the original. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!files.length && !error) return null;
  return (
    <View
      accessibilityLabel="Original files"
      className="my-4 border-y border-border py-4"
    >
      <Text className="mb-2 font-semibold text-fg">Original files</Text>
      {files.map((file) => (
        <View key={file.id} className="flex-row items-start gap-3 py-2">
          <View className="flex-1">
            <Text className="text-fg">{file.name}</Text>
            <Text className="mt-1 text-xs text-muted">
              {file.originalAvailable === false && file.analysis.state !== 'uploading'
                ? file.removalPending
                  ? "Original awaiting cleanup · "
                  : "Original removed · "
                : ""}
              {formatFileBytes(file.size)} ·{" "}
              {analysisLabel(file.analysis.state)}
            </Text>
            {file.analysis.pages !== undefined ? (
              <Text className="mt-1 text-xs text-muted">
                {file.analysis.processedPages || 0} of {file.analysis.pages}{" "}
                pages processed
              </Text>
            ) : null}
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
            <Text className="text-accent">Download</Text>
          </Pressable>
        </View>
      ))}
      {item.document_processing?.state === "partial" ? (
        <Text className="my-2 text-sm text-muted">
          The analysis covers part of these documents. Available originals can
          be downloaded in full.
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
                if (result.error) setError("Could not restart analysis.");
                else setVersion((v) => v + 1);
              })
              .finally(() => setBusy(false));
          }}
          className="min-h-[44px] justify-center"
        >
          <Text className="text-accent">Retry analysis</Text>
        </Pressable>
      ) : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert" className="text-muted">
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setVersion((v) => v + 1)}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-accent">Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
