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
  const id =
    value.type === "digest"
      ? value.digestId
      : value.type === "item"
        ? value.itemId
        : null;
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id)) return null;
  return {
    key:
      typeof value.deliveryId === "string" &&
      /^[a-z0-9]{15}$/.test(value.deliveryId)
        ? value.deliveryId
        : key,
    path: value.type === "digest" ? `/digest/${id}` : `/item/${id}`,
  };
}
