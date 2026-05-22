-- DropForeignKey
ALTER TABLE "app_block_rules" DROP CONSTRAINT "app_block_rules_device_id_fkey";

-- DropForeignKey
ALTER TABLE "app_usage_logs" DROP CONSTRAINT "app_usage_logs_device_id_fkey";

-- DropForeignKey
ALTER TABLE "browsing_history" DROP CONSTRAINT "browsing_history_device_id_fkey";

-- DropForeignKey
ALTER TABLE "call_logs" DROP CONSTRAINT "call_logs_device_id_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_device_id_fkey";

-- DropForeignKey
ALTER TABLE "device_status_logs" DROP CONSTRAINT "device_status_logs_device_id_fkey";

-- DropForeignKey
ALTER TABLE "gallery_items" DROP CONSTRAINT "gallery_items_device_id_fkey";

-- DropForeignKey
ALTER TABLE "geofences" DROP CONSTRAINT "geofences_device_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_device_id_fkey";

-- DropForeignKey
ALTER TABLE "remote_commands" DROP CONSTRAINT "remote_commands_device_id_fkey";

-- DropForeignKey
ALTER TABLE "sms_logs" DROP CONSTRAINT "sms_logs_device_id_fkey";

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "app_usage_logs" ADD CONSTRAINT "app_usage_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_status_logs" ADD CONSTRAINT "device_status_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_commands" ADD CONSTRAINT "remote_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_block_rules" ADD CONSTRAINT "app_block_rules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;
