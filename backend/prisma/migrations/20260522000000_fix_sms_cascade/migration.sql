-- Fix: SMS migration accidentally reset all FKs to RESTRICT.
-- Restore CASCADE on every monitoring table → device.

ALTER TABLE "sms_logs"           DROP CONSTRAINT IF EXISTS "sms_logs_device_id_fkey";
ALTER TABLE "call_logs"          DROP CONSTRAINT IF EXISTS "call_logs_device_id_fkey";
ALTER TABLE "app_usage_logs"     DROP CONSTRAINT IF EXISTS "app_usage_logs_device_id_fkey";
ALTER TABLE "notification_logs"  DROP CONSTRAINT IF EXISTS "notification_logs_device_id_fkey";
ALTER TABLE "device_status_logs" DROP CONSTRAINT IF EXISTS "device_status_logs_device_id_fkey";
ALTER TABLE "contacts"           DROP CONSTRAINT IF EXISTS "contacts_device_id_fkey";
ALTER TABLE "gallery_items"      DROP CONSTRAINT IF EXISTS "gallery_items_device_id_fkey";
ALTER TABLE "browsing_history"   DROP CONSTRAINT IF EXISTS "browsing_history_device_id_fkey";
ALTER TABLE "remote_commands"    DROP CONSTRAINT IF EXISTS "remote_commands_device_id_fkey";
ALTER TABLE "geofences"          DROP CONSTRAINT IF EXISTS "geofences_device_id_fkey";
ALTER TABLE "app_block_rules"    DROP CONSTRAINT IF EXISTS "app_block_rules_device_id_fkey";

ALTER TABLE "sms_logs"           ADD CONSTRAINT "sms_logs_device_id_fkey"           FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_logs"          ADD CONSTRAINT "call_logs_device_id_fkey"           FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_usage_logs"     ADD CONSTRAINT "app_usage_logs_device_id_fkey"      FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs"  ADD CONSTRAINT "notification_logs_device_id_fkey"   FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_status_logs" ADD CONSTRAINT "device_status_logs_device_id_fkey"  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts"           ADD CONSTRAINT "contacts_device_id_fkey"            FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gallery_items"      ADD CONSTRAINT "gallery_items_device_id_fkey"       FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "browsing_history"   ADD CONSTRAINT "browsing_history_device_id_fkey"    FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remote_commands"    ADD CONSTRAINT "remote_commands_device_id_fkey"     FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geofences"          ADD CONSTRAINT "geofences_device_id_fkey"           FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_block_rules"    ADD CONSTRAINT "app_block_rules_device_id_fkey"     FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
