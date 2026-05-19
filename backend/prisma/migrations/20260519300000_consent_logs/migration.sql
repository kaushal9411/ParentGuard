CREATE TABLE "consent_logs" (
    "id"               TEXT         NOT NULL,
    "user_id"          TEXT         NOT NULL,
    "consent_version"  TEXT         NOT NULL DEFAULT '1.0',
    "items"            TEXT         NOT NULL,
    "ip_address"       TEXT,
    "user_agent"       TEXT,
    "purpose"          TEXT         NOT NULL DEFAULT 'app_download',
    "granted_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"       TIMESTAMP(3),
    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs"("user_id");

ALTER TABLE "consent_logs"
    ADD CONSTRAINT "consent_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
