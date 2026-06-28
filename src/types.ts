/** Public types for the CardOS API. Money amounts are minor units (cents) unless noted. */

export type Mode = 'test' | 'live';

export interface Product {
  product_code: string;
  currency: string;
  issue_min_minor: string;
  issue_max_minor: string;
  topup_min_minor: string;
  topup_max_minor: string;
  kyc_required: boolean;
  kyc_sort: string | null;
  email_required: boolean;
  validity_years_supported: boolean;
}

export interface Balance {
  external_user_ref: string;
  balance_micro: string;
  currency: string;
  mode: Mode;
}

export interface Card {
  card_id?: string;
  external_user_ref?: string;
  masked?: string;
  last4?: string;
  expiry_month?: number;
  expiry_year?: number;
  status?: 'active' | 'frozen' | 'closed' | string;
  product?: string;
  mode?: Mode;
}

export interface CardTransaction {
  id: string;
  type: string;
  status: string;
  amount_minor: string;
  currency: string;
  commission_minor?: string;
  tx_amount_minor?: string | null;
  tx_currency?: string | null;
  origin_tx_id?: string | null;
  auth_code?: string | null;
  decline_reason?: string | null;
  merchant?: string | null;
  mcc?: string | null;
  country?: string | null;
  at: string;
}

export interface Deposit {
  deposit_id: string;
  method: string;
  pay_address: string;
  pay_amount_micro: string;
  currency: string;
  expires_at: string;
  mode: Mode;
}

export interface Dispute {
  id: string;
  transaction_id: string;
  external_user_ref: string;
  reason: string;
  amount_minor: string;
  currency: string;
  status: string;
  note: string | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycSession {
  uuid: string;
  url_for_user: string;
  sort: string;
  status: 'pending' | 'approved' | 'declined' | string;
  external_user_ref: string;
}

export interface RevealLink {
  card_id: string;
  reveal_url: string;
  expires_at: string;
  single_use: boolean;
  mode: Mode;
}

export interface CardSession {
  card_id: string;
  manage_url: string;
  transactions_url: string;
  expires_at: string;
  mode: Mode;
}

export interface SpendControls {
  per_txn_max_minor?: number;
  daily_max_minor?: number;
  monthly_max_minor?: number;
  blocked_mcc?: string[];
  blocked_country?: string[];
}

export type DepositMethod = 'usdt_trc20' | 'usdt_ton';
export type DisputeReason = 'fraud' | 'not_received' | 'duplicate' | 'incorrect_amount' | 'other';
export type DisputeStatus = 'open' | 'under_review' | 'resolved_won' | 'resolved_lost' | 'withdrawn';
export type WebhookEvent = 'transaction' | 'balance' | 'issued' | 'card_status' | 'kyc';
