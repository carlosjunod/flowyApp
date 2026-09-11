import { pb } from "./pb";
import { ENV } from "./env";
import { sharedSecureStore } from "./secureStore";
const CURRENT = "flowy.push.device";
const PENDING = "flowy.push.pending-unlink";
type Device = { account: string; token: string; revocation: string };
let serial: Promise<void> = Promise.resolve();

export class PushDeviceError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(code);
    this.name = "PushDeviceError";
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseError(response: Response): Promise<PushDeviceError> {
  let code = "PUSH_REGISTRATION_FAILED";
  try {
    const value: unknown = await response.json();
    if (
      value &&
      typeof value === "object" &&
      "error" in value &&
      typeof value.error === "string"
    )
      code = value.error;
  } catch {
    // Preserve the stable fallback when the server did not return JSON.
  }
  return new PushDeviceError(code, response.status);
}
function ordered(work: () => Promise<void>): Promise<void> {
  const next = serial.then(work, work);
  serial = next.catch(() => undefined);
  return next;
}
async function current(): Promise<Device | null> {
  try {
    return JSON.parse(
      (await sharedSecureStore.getItem(CURRENT)) || "null",
    ) as Device | null;
  } catch {
    return null;
  }
}
async function flush() {
  const pending = JSON.parse(
    (await sharedSecureStore.getItem(PENDING)) || "[]",
  ) as string[];
  const remaining: string[] = [];
  for (const revocation of pending) {
    try {
      const response = await fetchWithTimeout(ENV.API_BASE_URL + "/api/push/device", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revocation }),
      }, 5000);
      if (!response.ok) remaining.push(revocation);
    } catch {
      remaining.push(revocation);
    }
  }
  await sharedSecureStore.setItem(PENDING, JSON.stringify(remaining));
}
async function unlink() {
  const device = await current();
  if (device) {
    const pending = JSON.parse(
      (await sharedSecureStore.getItem(PENDING)) || "[]",
    ) as string[];
    await sharedSecureStore.setItem(
      PENDING,
      JSON.stringify([...new Set([...pending, device.revocation])]),
    );
    await sharedSecureStore.removeItem(CURRENT);
  }
  await flush();
}
export function flushPushUnlinks() {
  return ordered(flush);
}
export function unlinkPushDevice() {
  return ordered(unlink);
}
export function savePushDevice(account: string, token: string) {
  return ordered(async () => {
    await flush();
    if (pb.authStore.model?.id !== account) return;
    const device = await current();
    if (device && device.account !== account) await unlink();
    // Refresh server association even when the OS token is unchanged.
    const response = await fetchWithTimeout(ENV.API_BASE_URL + "/api/push/device", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + pb.authStore.token,
      },
      body: JSON.stringify({ token }),
    }, 10000);
    if (!response.ok) throw await responseError(response);
    const value: unknown = await response.json();
    const data = value && typeof value === "object" && "data" in value ? value.data : null;
    if (!data || typeof data !== "object" || !("revocation" in data) ||
        typeof data.revocation !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.revocation))
      throw new PushDeviceError("INVALID_PUSH_REGISTRATION", response.status);
    await sharedSecureStore.setItem(
      CURRENT,
      JSON.stringify({ account, token, revocation: data.revocation }),
    );
    if (pb.authStore.model?.id !== account) await unlink();
  });
}
