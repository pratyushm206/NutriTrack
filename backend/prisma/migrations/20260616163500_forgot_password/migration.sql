ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "reset_password_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "reset_password_expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_reset_password_token_hash_idx"
  ON "User"("reset_password_token_hash");
