-- ClearPath initial schema migration
-- Run with: psql $DATABASE_URL -f src/db/migrations/001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (mirrors Supabase auth.users with additional fields)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  kyc_status    TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'failed')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'premium')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit cards table
CREATE TABLE IF NOT EXISTS credit_cards (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname              TEXT NOT NULL,
  last_four             CHAR(4) NOT NULL,
  provider              TEXT NOT NULL DEFAULT '',
  balance               BIGINT NOT NULL DEFAULT 0,        -- pence
  credit_limit          BIGINT NOT NULL DEFAULT 0,        -- pence
  apr                   NUMERIC(5,2) NOT NULL CHECK (apr > 0),
  minimum_payment       BIGINT NOT NULL DEFAULT 0,        -- pence
  payment_due_date      DATE,
  connection_type       TEXT NOT NULL DEFAULT 'manual' CHECK (connection_type IN ('open_banking', 'screenshot', 'manual')),
  truelayer_account_id  TEXT,
  truelayer_access_token_enc TEXT,  -- AES-256 encrypted
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_apr ON credit_cards(user_id, apr DESC);

-- Repayment plans table
CREATE TABLE IF NOT EXISTS repayment_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method                TEXT NOT NULL CHECK (method IN ('avalanche', 'snowball')),
  monthly_budget        BIGINT NOT NULL,  -- pence
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  projected_payoff_date DATE,
  total_interest_saved  BIGINT NOT NULL DEFAULT 0,  -- pence
  total_interest_paid   BIGINT NOT NULL DEFAULT 0,  -- pence
  payoff_months         INTEGER NOT NULL DEFAULT 0,
  narrative             TEXT,
  allocations           JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_repayment_plans_user_id ON repayment_plans(user_id, generated_at DESC);

-- Virtual cards table
CREATE TABLE IF NOT EXISTS virtual_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  modulr_card_id  TEXT NOT NULL,
  routing_mode    TEXT NOT NULL DEFAULT 'minimise_cost' CHECK (routing_mode IN ('maximise_rewards', 'minimise_cost', 'protect_score')),
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  is_frozen       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table (virtual card routing history)
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  virtual_card_id     UUID REFERENCES virtual_cards(id) ON DELETE SET NULL,
  amount              BIGINT NOT NULL,  -- pence
  merchant_name       TEXT NOT NULL DEFAULT '',
  merchant_category   TEXT NOT NULL DEFAULT '',
  allocated_to_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  allocation_reason   TEXT NOT NULL DEFAULT '',
  reward_earned       BIGINT NOT NULL DEFAULT 0,  -- pence
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id, created_at DESC);

-- Credit score records
CREATE TABLE IF NOT EXISTS credit_score_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 999),
  provider    TEXT NOT NULL CHECK (provider IN ('experian', 'transunion', 'equifax')),
  factors     JSONB NOT NULL DEFAULT '[]',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_score_records_user_id ON credit_score_records(user_id, recorded_at DESC);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_credit_cards_updated_at') THEN
    CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON credit_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_virtual_cards_updated_at') THEN
    CREATE TRIGGER update_virtual_cards_updated_at BEFORE UPDATE ON virtual_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
