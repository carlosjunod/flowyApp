/** Shared server contract for GET/POST/DELETE /api/integrations/instagram. */
export interface InstagramConnection {
  enabled: boolean;
  referralEnabled?: boolean;
  connected: boolean;
  linkedAt?: number | null;
  code?: string;
  expiresAt?: number;
}
