-- Add ON DELETE CASCADE to all Device → child table relationships
-- and to the User → Device relationship.
-- This lets us delete a Device (or User) in one statement and have
-- the DB clean up every related row automatically.

-- User → Device
ALTER TABLE "devices" DROP CONSTRAINT IF EXISTS "devices_user_id_fkey";
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → LocationLog
ALTER TABLE "location_logs" DROP CONSTRAINT IF EXISTS "location_logs_device_id_fkey";
ALTER TABLE "location_logs" ADD CONSTRAINT "location_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → AppUsageLog
ALTER TABLE "app_usage_logs" DROP CONSTRAINT IF EXISTS "app_usage_logs_device_id_fkey";
ALTER TABLE "app_usage_logs" ADD CONSTRAINT "app_usage_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → NotificationLog
ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "notification_logs_device_id_fkey";
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → DeviceStatusLog
ALTER TABLE "device_status_logs" DROP CONSTRAINT IF EXISTS "device_status_logs_device_id_fkey";
ALTER TABLE "device_status_logs" ADD CONSTRAINT "device_status_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → CallLog
ALTER TABLE "call_logs" DROP CONSTRAINT IF EXISTS "call_logs_device_id_fkey";
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → Contact
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_device_id_fkey";
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → GalleryItem
ALTER TABLE "gallery_items" DROP CONSTRAINT IF EXISTS "gallery_items_device_id_fkey";
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → BrowsingHistory
ALTER TABLE "browsing_history" DROP CONSTRAINT IF EXISTS "browsing_history_device_id_fkey";
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → RemoteCommand
ALTER TABLE "remote_commands" DROP CONSTRAINT IF EXISTS "remote_commands_device_id_fkey";
ALTER TABLE "remote_commands" ADD CONSTRAINT "remote_commands_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → Geofence (GeofenceAlert already cascades from Geofence)
ALTER TABLE "geofences" DROP CONSTRAINT IF EXISTS "geofences_device_id_fkey";
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Device → AppBlockRule
ALTER TABLE "app_block_rules" DROP CONSTRAINT IF EXISTS "app_block_rules_device_id_fkey";
ALTER TABLE "app_block_rules" ADD CONSTRAINT "app_block_rules_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE CASCADE ON UPDATE CASCADE;
