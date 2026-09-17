export interface InstagramDestination {
  id: string;
  handle: string;
  language: "en" | "es";
  connected: boolean;
  linkedAt?: number | null;
}
export interface InstagramConnection {
  enabled: boolean;
  referralEnabled?: boolean;
  connected: boolean;
  linkedAt?: number | null;
  account?: string;
  handle?: string;
  language?: "en" | "es";
  accounts?: InstagramDestination[];
  code?: string;
  expiresAt?: number;
}
