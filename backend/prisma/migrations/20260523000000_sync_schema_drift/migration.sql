-- DropForeignKey
ALTER TABLE "geofence_alerts" DROP CONSTRAINT "geofence_alerts_geofence_id_fkey";

-- DropForeignKey
ALTER TABLE "geofences" DROP CONSTRAINT "geofences_device_id_fkey";

-- AlterTable
ALTER TABLE "app_block_rules" ADD COLUMN     "rule_type" TEXT NOT NULL DEFAULT 'block';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "app_hidden" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geofence_alerts" ADD CONSTRAINT "geofence_alerts_geofence_id_fkey" FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
