/**
 * Receipt content type — structured payload stored as `Item.structured_content`
 * when `Item.type === 'receipt'`. Mirrors `apps/web/types/receipt.ts` so the
 * worker's Claude Vision output renders identically on both platforms.
 *
 * Money convention: every monetary value is an INTEGER representing whole
 * units in the user's chosen currency (no decimal subunits). The renderer
 * formats them via `lib/currency.formatCurrency`.
 */

export type ReceiptUserCategory =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'household'
  | 'health'
  | 'entertainment'
  | 'education'
  | 'other';

export type ReceiptPaymentMethod =
  | 'cash'
  | 'credit'
  | 'debit'
  | 'nequi'
  | 'daviplata'
  | 'transfer'
  | 'other';

export interface ReceiptItem {
  id: string;
  name: string;
  /** Decimal allowed for weighed goods (e.g. 1.35 kg). Treat as opaque display value. */
  quantity: number;
  /** Integer whole-unit amount. */
  unitPrice: number;
  /** Integer whole-unit amount. */
  totalPrice: number;
  /** Sub-category set by AI (e.g. "dairy", "produce"); user-editable. */
  category?: string;
  /** 0..1 — surface to user when below 0.95. */
  ocrConfidence: number;
}

export interface ReceiptStore {
  name: string;
  address?: string;
  /** Tax ID — NIT for Colombian receipts, EIN for US, etc. */
  taxId?: string;
  phone?: string;
  /** Normalized lowercase brand slug — used for recurring detection + auto-categorization. */
  chain?: string;
}

export interface ReceiptPayment {
  method: ReceiptPaymentMethod;
  provider?: string;
  /** Last four digits of the card used. Never store more than 4. */
  last4?: string;
}

export interface ReceiptData {
  store: ReceiptStore;
  payment: ReceiptPayment;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  tipAmount?: number;
  discountAmount?: number;
  discountLabel?: string;
  total: number;
  /** ISO date — extracted FROM the receipt, not the upload timestamp. */
  receiptDate: string;
  /** Local 24h time on the receipt, e.g. "14:34". */
  receiptTime?: string;
  originalPhotoUrl?: string;
  /** 0..1 — overall confidence score from the vision model. */
  ocrOverallConfidence: number;
  userCategory: ReceiptUserCategory;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly';
}
