package com.parentalmonitor.child.services

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.Size
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class GalleryService(private val ctx: Context) {

    fun getGalleryItems(sinceTimestamp: Long = 0L): String {
        val result = JSONArray()
        try {
            collectImages(sinceTimestamp, result)
            collectVideos(sinceTimestamp, result)
        } catch (e: Exception) {
            android.util.Log.e("GalleryService", "Failed to collect gallery: ${e.message}", e)
        }
        return result.toString()
    }

    private fun collectImages(since: Long, out: JSONArray) {
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        else MediaStore.Images.Media.EXTERNAL_CONTENT_URI

        val selection = if (since > 0) "${MediaStore.Images.Media.DATE_ADDED} > ?" else null
        val selArgs   = if (since > 0) arrayOf((since / 1000).toString()) else null

        // NOTE: Do NOT put LIMIT inside the sortOrder string — not part of the
        // ContentProvider API and throws on many Android versions. Limit manually.
        ctx.contentResolver.query(
            uri,
            arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
                MediaStore.Images.Media.DATE_TAKEN,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
            ),
            selection, selArgs,
            "${MediaStore.Images.Media.DATE_ADDED} DESC",
        )?.use { c ->
            val dataIdx     = c.getColumnIndex(MediaStore.Images.Media.DATA)
            val dateAddedIdx = c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
            var count = 0
            while (c.moveToNext() && count < 500) {
                val id = c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                val localPath = if (dataIdx >= 0) c.getString(dataIdx) ?: "" else ""
                // DATE_ADDED is in seconds; convert to ms for consistency with other timestamps
                val dateAddedMs = c.getLong(dateAddedIdx) * 1000L
                val imgUri = ContentUris.withAppendedId(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
                out.put(JSONObject().apply {
                    put("id",        "img_$id")
                    put("fileName",  c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)) ?: "")
                    put("mimeType",  c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)) ?: "image/jpeg")
                    put("sizeBytes", c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)))
                    put("width",     c.getInt(c.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)))
                    put("height",    c.getInt(c.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)))
                    put("takenAt",   c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN)))
                    put("dateAdded", dateAddedMs)
                    put("localPath", localPath)
                    put("album",     c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)) ?: "")
                    put("thumbnail", loadThumbnail(imgUri))
                })
                count++
            }
        }
    }

    private fun collectVideos(since: Long, out: JSONArray) {
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        else MediaStore.Video.Media.EXTERNAL_CONTENT_URI

        val selection = if (since > 0) "${MediaStore.Video.Media.DATE_ADDED} > ?" else null
        val selArgs   = if (since > 0) arrayOf((since / 1000).toString()) else null

        ctx.contentResolver.query(
            uri,
            arrayOf(
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.WIDTH,
                MediaStore.Video.Media.HEIGHT,
                MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.DATE_TAKEN,
                MediaStore.Video.Media.DATE_ADDED,
                MediaStore.Video.Media.DATA,
                MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
            ),
            selection, selArgs,
            "${MediaStore.Video.Media.DATE_ADDED} DESC",
        )?.use { c ->
            val dataIdx      = c.getColumnIndex(MediaStore.Video.Media.DATA)
            val dateAddedIdx = c.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_ADDED)
            var count = 0
            while (c.moveToNext() && count < 500) {
                val id  = c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media._ID))
                val dur = c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION))
                val localPath   = if (dataIdx >= 0) c.getString(dataIdx) ?: "" else ""
                val dateAddedMs = c.getLong(dateAddedIdx) * 1000L
                val vidUri = ContentUris.withAppendedId(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
                out.put(JSONObject().apply {
                    put("id",        "vid_$id")
                    put("fileName",  c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)) ?: "")
                    put("mimeType",  c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE)) ?: "video/mp4")
                    put("sizeBytes", c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)))
                    put("width",     c.getInt(c.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH)))
                    put("height",    c.getInt(c.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT)))
                    put("duration",  (dur / 1000).toInt())
                    put("takenAt",   c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_TAKEN)))
                    put("dateAdded", dateAddedMs)
                    put("localPath", localPath)
                    put("album",     c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)) ?: "")
                    put("thumbnail", loadThumbnail(vidUri))
                })
                count++
            }
        }
    }

    /** Small 200×200 thumbnail used only in the grid list. */
    private fun loadThumbnail(uri: android.net.Uri): String {
        return try {
            val isVideo = uri.toString().contains("video")
            val bmp: Bitmap? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    ctx.contentResolver.loadThumbnail(uri, Size(200, 200), null)
                } catch (_: Exception) { null }
            } else {
                val id = uri.lastPathSegment?.toLongOrNull() ?: return ""
                if (isVideo) {
                    @Suppress("DEPRECATION")
                    MediaStore.Video.Thumbnails.getThumbnail(
                        ctx.contentResolver, id,
                        MediaStore.Video.Thumbnails.MINI_KIND, null)
                } else {
                    @Suppress("DEPRECATION")
                    MediaStore.Images.Thumbnails.getThumbnail(
                        ctx.contentResolver, id,
                        MediaStore.Images.Thumbnails.MINI_KIND, null)
                }
            }
            if (bmp == null) return ""
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 60, out)
            bmp.recycle()
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            android.util.Log.w("GalleryService", "thumbnail failed for $uri: ${e.message}")
            ""
        }
    }

    /**
     * Reads the actual video file and returns raw bytes as base64.
     * Skips files larger than [maxSizeMb] MB (returns empty string).
     * Called on-demand by the upload pipeline for video items only.
     */
    fun getRawVideoData(itemId: String, maxSizeMb: Int = 50): String {
        val numId = itemId.removePrefix("vid_").toLongOrNull() ?: return ""
        val uri   = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, numId)
        return try {
            val sizeBytes = ctx.contentResolver.query(
                uri, arrayOf(MediaStore.Video.Media.SIZE), null, null, null
            )?.use { c -> if (c.moveToFirst()) c.getLong(0) else 0L } ?: 0L

            if (sizeBytes > maxSizeMb * 1_048_576L) {
                android.util.Log.w("GalleryService", "Video $itemId too large (${sizeBytes / 1_048_576} MB), skipping")
                return ""
            }

            ctx.contentResolver.openInputStream(uri)?.use { input ->
                Base64.encodeToString(input.readBytes(), Base64.NO_WRAP)
            } ?: ""
        } catch (e: Exception) {
            android.util.Log.w("GalleryService", "getRawVideoData failed for $uri: ${e.message}")
            ""
        }
    }

    /**
     * Reads the actual image/video file and returns a base64-encoded JPEG
     * scaled to at most 1920px on the longer side at quality 85.
     * Called on-demand by the upload pipeline, not during list collection.
     */
    fun getImageData(itemId: String): String {
        val numId = itemId.removePrefix("img_").removePrefix("vid_").toLongOrNull() ?: return ""
        val isVid = itemId.startsWith("vid_")
        val uri = ContentUris.withAppendedId(
            if (isVid) MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            else       MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            numId)
        return if (isVid) readVideoFrame(uri) else readImageFile(uri)
    }

    private fun readImageFile(uri: android.net.Uri): String {
        return try {
            // First pass: read bounds only to compute inSampleSize
            val boundsOpts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
            ctx.contentResolver.openInputStream(uri)?.use {
                android.graphics.BitmapFactory.decodeStream(it, null, boundsOpts)
            }

            val maxDim = 1920
            val sampleSize = run {
                var s = 1
                while (boundsOpts.outWidth / s > maxDim * 2 || boundsOpts.outHeight / s > maxDim * 2) s *= 2
                s
            }

            val decodeOpts = android.graphics.BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val raw: Bitmap = ctx.contentResolver.openInputStream(uri)?.use {
                android.graphics.BitmapFactory.decodeStream(it, null, decodeOpts)
            } ?: return ""

            val w = raw.width; val h = raw.height
            val bmp = if (w > maxDim || h > maxDim) {
                val scale = maxDim.toFloat() / maxOf(w, h)
                val s = Bitmap.createScaledBitmap(raw, (w * scale).toInt(), (h * scale).toInt(), true)
                raw.recycle(); s
            } else raw

            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
            bmp.recycle()
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            android.util.Log.w("GalleryService", "readImageFile failed for $uri: ${e.message}")
            ""
        }
    }

    private fun readVideoFrame(uri: android.net.Uri): String {
        return try {
            val bmp: Bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ctx.contentResolver.loadThumbnail(uri, Size(1920, 1920), null)
            } else {
                val id = uri.lastPathSegment?.toLongOrNull() ?: return ""
                @Suppress("DEPRECATION")
                MediaStore.Video.Thumbnails.getThumbnail(
                    ctx.contentResolver, id,
                    MediaStore.Video.Thumbnails.FULL_SCREEN_KIND, null) ?: return ""
            }
            val out = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
            bmp.recycle()
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            android.util.Log.w(TAG, "readVideoFrame failed for $uri: ${e.message}")
            ""
        }
    }

    /** Uploads new gallery items (images + videos) since last sync to /api/events/batch. */
    fun syncGallery(token: String, deviceId: String, baseUrl: String) {
        val permOk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_IMAGES) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED ||
            ctx.checkSelfPermission(android.Manifest.permission.READ_MEDIA_VIDEO) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            ctx.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        if (!permOk) {
            android.util.Log.w(TAG, "SKIP — storage permission not granted")
            return
        }

        val prefs        = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val sinceMs      = prefs.getLong(KEY_LAST, 0L)
        android.util.Log.d(TAG, "Syncing gallery since epoch $sinceMs …")

        val items = try { JSONArray(getGalleryItems(sinceMs)) } catch (_: Exception) { return }
        if (items.length() == 0) {
            android.util.Log.d(TAG, "No new gallery items since last sync")
            return
        }
        android.util.Log.d(TAG, "Found ${items.length()} new gallery item(s) — uploading in chunks …")

        var uploaded        = 0
        var latestDateAdded = sinceMs
        val chunkSize       = 30

        for (start in 0 until items.length() step chunkSize) {
            val end    = minOf(start + chunkSize, items.length())
            val events = JSONArray()
            for (i in start until end) {
                val item      = items.getJSONObject(i)
                val dateAdded = item.optLong("dateAdded", 0L)
                if (dateAdded > latestDateAdded) latestDateAdded = dateAdded
                events.put(JSONObject().apply {
                    put("id",      "${deviceId}_gallery_${item.optString("id")}")
                    put("type",    "galleryItem")
                    put("payload", item)
                })
            }
            val body = JSONObject().apply {
                put("deviceId", deviceId)
                put("events",   events)
            }.toString().toByteArray(Charsets.UTF_8)
            try {
                val conn = (URL("$baseUrl/api/events/batch").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type",  "application/json")
                    doOutput       = true
                    connectTimeout = 15_000
                    readTimeout    = 60_000
                    setFixedLengthStreamingMode(body.size.toLong())
                }
                conn.outputStream.use { it.write(body) }
                val code = conn.responseCode
                conn.disconnect()
                if (code == 200 || code == 201) {
                    uploaded += (end - start)
                } else {
                    android.util.Log.w(TAG, "Gallery chunk HTTP $code")
                }
            } catch (e: Exception) {
                android.util.Log.w(TAG, "Gallery chunk upload failed: ${e.message}")
            }
        }

        if (uploaded > 0) {
            prefs.edit().putLong(KEY_LAST, latestDateAdded).apply()
            android.util.Log.d(TAG, "Synced $uploaded gallery items ✓")
        }
    }

    companion object {
        private const val TAG      = "GalleryService"
        private const val PREFS    = "pm_gallery"
        private const val KEY_LAST = "last_gallery_ts"
    }
}
