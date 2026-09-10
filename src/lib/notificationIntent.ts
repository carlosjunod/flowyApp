export interface NotificationIntent {
  key: string;
  path: `/digest/${string}` | `/item/${string}`;
}
export function notificationIntent(
  key: string,
  data: unknown,
): NotificationIntent | null {
  if (!data || typeof data !== "object" || !key || key.length > 200)
    return null;
  const value = data as Record<string, unknown>;
  // Accept notifications already sent by the pre-fix worker during rollout.
  // Unknown explicit types never fall back to item navigation.
  const type = value.type === undefined && typeof value.itemId === "string" ? "item" : value.type;
  const id =
    type === "digest"
      ? value.digestId
      : type === "item"
        ? value.itemId
        : null;
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id)) return null;
  return {
    key:
      typeof value.deliveryId === "string" &&
      /^[a-z0-9]{15}$/.test(value.deliveryId)
        ? value.deliveryId
        : key,
    path: type === "digest" ? `/digest/${id}` : `/item/${id}`,
  };
}
