-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "ip_address" TEXT;

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phones" TEXT NOT NULL,
    "emails" TEXT NOT NULL DEFAULT '[]',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "taken_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browsing_history" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "visited_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browsing_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_logs_device_id_timestamp_idx" ON "call_logs"("device_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "contacts_device_id_idx" ON "contacts"("device_id");

-- CreateIndex
CREATE INDEX "gallery_items_device_id_taken_at_idx" ON "gallery_items"("device_id", "taken_at" DESC);

-- CreateIndex
CREATE INDEX "browsing_history_device_id_visited_at_idx" ON "browsing_history"("device_id", "visited_at" DESC);

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("device_id") ON DELETE RESTRICT ON UPDATE CASCADE;
