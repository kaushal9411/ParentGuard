CREATE TABLE "payments" (
    "id"                      TEXT             NOT NULL,
    "user_id"                 TEXT             NOT NULL,
    "plan_id"                 TEXT             NOT NULL,
    "razorpay_order_id"       TEXT,
    "razorpay_payment_id"     TEXT,
    "razorpay_payment_link_id" TEXT,
    "amount"                  DOUBLE PRECISION NOT NULL,
    "currency"                TEXT             NOT NULL DEFAULT 'INR',
    "status"                  TEXT             NOT NULL DEFAULT 'created',
    "type"                    TEXT             NOT NULL DEFAULT 'checkout',
    "created_at"              TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_razorpay_order_id_key" ON "payments"("razorpay_order_id");
CREATE        INDEX "payments_user_id_idx"             ON "payments"("user_id");

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
