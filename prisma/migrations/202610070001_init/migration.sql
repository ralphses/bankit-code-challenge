CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "TransactionStatus" AS ENUM (
  'SUCCESS',
  'FAILED_INSUFFICIENT_FUNDS',
  'FAILED_ACCOUNT_NOT_FOUND',
  'FAILED_CURRENCY_MISMATCH',
  'FAILED_INVALID_REQUEST',
  'FAILED_SYSTEM'
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "account_number" VARCHAR(10) NOT NULL,
  "balance_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "sender_account_id" UUID,
  "recipient_account_id" UUID,
  "amount_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "TransactionStatus" NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
  "key" VARCHAR(255) NOT NULL,
  "request_hash" TEXT NOT NULL,
  "reference" TEXT,
  "http_status" INTEGER,
  "response_json" JSONB,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");
CREATE INDEX "accounts_account_number_idx" ON "accounts"("account_number");
CREATE INDEX "transactions_sender_history_idx" ON "transactions"("sender_account_id", "created_at" DESC, "id" DESC);
CREATE INDEX "transactions_recipient_history_idx" ON "transactions"("recipient_account_id", "created_at" DESC, "id" DESC);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_balance_minor_check" CHECK ("balance_minor" >= 0);
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_currency_check" CHECK ("currency" = upper("currency") AND char_length("currency") = 3);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_minor_check" CHECK ("amount_minor" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_check" CHECK ("currency" = upper("currency") AND char_length("currency") = 3);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accounts_distinct_check" CHECK ("sender_account_id" IS NULL OR "recipient_account_id" IS NULL OR "sender_account_id" <> "recipient_account_id");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sender_account_id_fkey" FOREIGN KEY ("sender_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recipient_account_id_fkey" FOREIGN KEY ("recipient_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
