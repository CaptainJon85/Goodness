-- Migration 002: TrueLayer token storage and unique constraint
-- Run after 001_initial_schema.sql

-- Add refresh token storage to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS truelayer_refresh_token_enc TEXT;

-- Add unique constraint for TrueLayer account sync (prevents duplicates on re-sync)
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS truelayer_account_id_unique TEXT
  GENERATED ALWAYS AS (
    CASE WHEN truelayer_account_id IS NOT NULL THEN (user_id::text || ':' || truelayer_account_id) ELSE NULL END
  ) STORED;

-- Create unique index on the computed column (nulls not constrained)
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_cards_truelayer_unique
  ON credit_cards (user_id, truelayer_account_id)
  WHERE truelayer_account_id IS NOT NULL;
