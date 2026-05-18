CREATE TABLE "fcm_tokens" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fcm_tokens_token_key"   ON "fcm_tokens"("token");
CREATE INDEX        "fcm_tokens_user_id_idx" ON "fcm_tokens"("user_id");

ALTER TABLE "fcm_tokens"
    ADD CONSTRAINT "fcm_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
