CREATE TABLE "subscription_plans" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "price"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration_days" INTEGER         NOT NULL DEFAULT 30,
    "features"     TEXT             NOT NULL,
    "is_active"    BOOLEAN          NOT NULL DEFAULT true,
    "sort_order"   INTEGER          NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

CREATE TABLE "user_subscriptions" (
    "id"          TEXT         NOT NULL,
    "user_id"     TEXT         NOT NULL,
    "plan_id"     TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'active',
    "started_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"  TIMESTAMP(3),
    "assigned_by" TEXT,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_subscriptions_user_id_key"  ON "user_subscriptions"("user_id");
CREATE        INDEX "user_subscriptions_plan_id_idx"  ON "user_subscriptions"("plan_id");

ALTER TABLE "user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Seed default plans ──────────────────────────────────────────────────────
INSERT INTO "subscription_plans" ("id","name","description","price","duration_days","features","is_active","sort_order","updated_at") VALUES
(
    'plan_free',
    'Free',
    'Basic monitoring — location and notifications only',
    0, 30,
    '{"maxDevices":1,"location":true,"notifications":true,"callLogs":false,"contacts":false,"appUsage":false,"gallery":false,"browsingHistory":false,"geofencing":false,"appBlocking":false,"remoteCommands":false,"historyDays":7}',
    true, 0, CURRENT_TIMESTAMP
),
(
    'plan_basic',
    'Basic',
    'Essential parenting tools for one family device',
    4.99, 30,
    '{"maxDevices":2,"location":true,"notifications":true,"callLogs":true,"contacts":true,"appUsage":false,"gallery":false,"browsingHistory":false,"geofencing":false,"appBlocking":false,"remoteCommands":false,"historyDays":30}',
    true, 1, CURRENT_TIMESTAMP
),
(
    'plan_standard',
    'Standard',
    'Full monitoring including media and browsing history',
    9.99, 30,
    '{"maxDevices":3,"location":true,"notifications":true,"callLogs":true,"contacts":true,"appUsage":true,"gallery":true,"browsingHistory":true,"geofencing":false,"appBlocking":false,"remoteCommands":false,"historyDays":60}',
    true, 2, CURRENT_TIMESTAMP
),
(
    'plan_premium',
    'Premium',
    'All features including remote commands and app blocking',
    19.99, 30,
    '{"maxDevices":5,"location":true,"notifications":true,"callLogs":true,"contacts":true,"appUsage":true,"gallery":true,"browsingHistory":true,"geofencing":true,"appBlocking":true,"remoteCommands":true,"historyDays":90}',
    true, 3, CURRENT_TIMESTAMP
);
