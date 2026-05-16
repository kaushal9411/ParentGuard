-- AlterTable
ALTER TABLE "app_usage_logs" ADD COLUMN     "launch_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "browsing_history" ADD COLUMN     "browser_app" TEXT,
ADD COLUMN     "visit_count" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "call_logs" ADD COLUMN     "sim_slot" INTEGER;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "groups" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "gallery_items" ADD COLUMN     "album" TEXT,
ADD COLUMN     "local_path" TEXT;

-- AlterTable
ALTER TABLE "location_logs" ADD COLUMN     "activity_type" TEXT,
ADD COLUMN     "is_moving" BOOLEAN;

-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN     "big_text" TEXT,
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "remote_commands" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "remote_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofences" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_m" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geofence_alerts" (
    "id" TEXT NOT NULL,
    "geofence_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofence_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_block_rules" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_block_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remote_commands_device_id_issued_at_idx" ON "remote_commands"("device_id", "issued_at" DESC);

-- CreateIndex
CREATE INDEX "remote_commands_device_id_status_idx" ON "remote_commands"("device_id", "status");

-- CreateIndex
CREATE INDEX "geofences_device_id_idx" ON "geofences"("device_id");

-- CreateIndex
CREATE INDEX "geofence_alerts_geofence_id_triggered_at_idx" ON "geofence_alerts"("geofence_id", "triggered_at" DESC);

-- CreateIndex
CREATE INDEX "geofence_alerts_device_id_triggered_at_idx" ON "geofence_alerts"("device_id", "triggered_at" DESC);

-- CreateIndex
CREATE INDEX "app_block_rules_device_id_idx" ON "app_block_rules"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_block_rules_device_id_package_name_key" ON "app_block_rules"("device_id", "package_name");

-- AddForeignKey
ALTER TABLE "remote_commands" ADD CONSTRAINT "remote_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_block_rules" ADD CONSTRAINT "app_block_rules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;
