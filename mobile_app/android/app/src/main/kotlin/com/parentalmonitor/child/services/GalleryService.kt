package com.parentalmonitor.child.services

import android.content.Context
import android.os.Build
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject

class GalleryService(private val ctx: Context) {

    fun getGalleryItems(sinceTimestamp: Long = 0L): String {
        val result = JSONArray()
        collectImages(sinceTimestamp, result)
        collectVideos(sinceTimestamp, result)
        return result.toString()
    }

    private fun collectImages(since: Long, out: JSONArray) {
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        else MediaStore.Images.Media.EXTERNAL_CONTENT_URI

        val selection = if (since > 0) "${MediaStore.Images.Media.DATE_ADDED} > ?" else null
        val selArgs   = if (since > 0) arrayOf((since / 1000).toString()) else null

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
                MediaStore.Images.Media.DATA,
                MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
            ),
            selection, selArgs,
            "${MediaStore.Images.Media.DATE_TAKEN} DESC LIMIT 200",
        )?.use { c ->
            while (c.moveToNext()) {
                val id = c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                out.put(JSONObject().apply {
                    put("id",        "img_$id")
                    put("fileName",  c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)) ?: "")
                    put("mimeType",  c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE)) ?: "image/jpeg")
                    put("sizeBytes", c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)))
                    put("width",     c.getInt(c.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)))
                    put("height",    c.getInt(c.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)))
                    put("takenAt",   c.getLong(c.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_TAKEN)))
                    put("localPath", c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.DATA)))
                    put("album",     c.getString(c.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)))
                })
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
                MediaStore.Video.Media.DATA,
                MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
            ),
            selection, selArgs,
            "${MediaStore.Video.Media.DATE_TAKEN} DESC LIMIT 200",
        )?.use { c ->
            while (c.moveToNext()) {
                val id  = c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media._ID))
                val dur = c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION))
                out.put(JSONObject().apply {
                    put("id",        "vid_$id")
                    put("fileName",  c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.DISPLAY_NAME)) ?: "")
                    put("mimeType",  c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.MIME_TYPE)) ?: "video/mp4")
                    put("sizeBytes", c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.SIZE)))
                    put("width",     c.getInt(c.getColumnIndexOrThrow(MediaStore.Video.Media.WIDTH)))
                    put("height",    c.getInt(c.getColumnIndexOrThrow(MediaStore.Video.Media.HEIGHT)))
                    put("duration",  (dur / 1000).toInt())
                    put("takenAt",   c.getLong(c.getColumnIndexOrThrow(MediaStore.Video.Media.DATE_TAKEN)))
                    put("localPath", c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.DATA)))
                    put("album",     c.getString(c.getColumnIndexOrThrow(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)))
                })
            }
        }
    }
}
