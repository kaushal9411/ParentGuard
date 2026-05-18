package com.parentalmonitor.child.services

import android.content.ContentUris
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

/**
 * Streams video files directly to the backend — no base64, no Flutter method channel.
 * Called from [TrackingForegroundService] during the slow capture cycle.
 *
 * Tracks uploaded IDs in its own SharedPreferences file (pm_video_uploads) so it
 * is independent of the Flutter-side gallery uploaded-IDs list.
 */
class VideoUploadService(private val ctx: Context, private val baseUrl: String) {

    fun uploadPendingVideos(token: String, deviceId: String) {
        val prefs       = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val uploadedJson = prefs.getString(KEY_UPLOADED, "[]") ?: "[]"
        val uploadedSet  = jsonArrayToSet(uploadedJson).toMutableSet()

        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        else MediaStore.Video.Media.EXTERNAL_CONTENT_URI

        var uploadedCount = 0

        ctx.contentResolver.query(
            uri,
            arrayOf(
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.SIZE,
            ),
            null, null,
            "${MediaStore.Video.Media.DATE_ADDED} DESC",
        )?.use { c ->
            while (c.moveToNext() && uploadedCount < MAX_PER_CYCLE) {
                val id        = c.getLong(0)
                val mimeType  = c.getString(1) ?: "video/mp4"
                val sizeBytes = c.getLong(2)
                val videoId   = "vid_$id"

                if (uploadedSet.contains(videoId)) continue

                if (sizeBytes > MAX_SIZE_BYTES) {
                    Log.d(TAG, "Skipping $videoId — ${sizeBytes / MB} MB exceeds limit")
                    uploadedSet.add(videoId) // don't retry
                    continue
                }

                val videoUri = ContentUris.withAppendedId(
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)

                try {
                    val ok = streamToBackend(videoUri, videoId, mimeType, sizeBytes, token, deviceId)
                    if (ok) {
                        uploadedSet.add(videoId)
                        uploadedCount++
                        Log.d(TAG, "Uploaded $videoId (${sizeBytes / MB} MB)")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Upload failed for $videoId: ${e.message}")
                    // Don't add to uploadedSet — will retry next cycle
                }
            }
        }

        // Persist the updated set
        val arr = JSONArray()
        uploadedSet.forEach { arr.put(it) }
        prefs.edit().putString(KEY_UPLOADED, arr.toString()).apply()
    }

    private fun streamToBackend(
        uri: android.net.Uri,
        videoId: String,
        mimeType: String,
        sizeBytes: Long,
        token: String,
        deviceId: String,
    ): Boolean {
        var conn: HttpURLConnection? = null
        return try {
            conn = URL("$baseUrl/api/gallery/upload-video/$videoId")
                .openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization",  "Bearer $token")
            conn.setRequestProperty("X-Device-Id",    deviceId)
            conn.setRequestProperty("Content-Type",   mimeType)
            conn.connectTimeout = 30_000
            conn.readTimeout    = 300_000   // 5 min for large files
            conn.doOutput       = true
            conn.setFixedLengthStreamingMode(sizeBytes)  // stream without buffering

            ctx.contentResolver.openInputStream(uri)?.use { input ->
                conn.outputStream.use { out ->
                    input.copyTo(out, bufferSize = 64 * 1024)
                }
            }

            val code = conn.responseCode
            code == 200 || code == 201
        } catch (e: Exception) {
            Log.w(TAG, "Stream error for $videoId: ${e.message}")
            false
        } finally {
            conn?.disconnect()
        }
    }

    private fun jsonArrayToSet(json: String): Set<String> {
        val set = mutableSetOf<String>()
        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) set.add(arr.optString(i))
        } catch (_: Exception) {}
        return set
    }

    companion object {
        private const val TAG          = "VideoUploadService"
        private const val PREFS_NAME   = "pm_video_uploads"
        private const val KEY_UPLOADED = "uploaded_ids"
        private const val MAX_SIZE_MB  = 200L
        private const val MB           = 1_048_576L
        private const val MAX_SIZE_BYTES = MAX_SIZE_MB * MB
        private const val MAX_PER_CYCLE  = 10   // upload at most 10 videos per 30-min cycle
    }
}
