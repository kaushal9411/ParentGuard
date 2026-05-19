CREATE TABLE "subscription_requests" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "plan_id"    TEXT         NOT NULL,
    "message"    TEXT,
    "status"     TEXT         NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_requests_user_id_key" ON "subscription_requests"("user_id");
CREATE        INDEX "subscription_requests_plan_id_idx" ON "subscription_requests"("plan_id");

ALTER TABLE "subscription_requests"
    ADD CONSTRAINT "subscription_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_requests"
    ADD CONSTRAINT "subscription_requests_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
