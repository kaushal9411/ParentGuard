package com.parentalmonitor.child.services

import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CaptureRequest
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
 * Supports: capture_photo (Camera2), start/stop_mic (audio recording with result),
 * list_files, lock_device, block_app, unblock_app.
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
                "capture_photo"    -> capturePhoto(payload)
                "list_files"       -> listFiles()
                "start_mic",
                "start_recording"  -> startRecording()
                "stop_mic",
                "stop_recording"   -> stopRecordingWithResult()
                "lock_device"      -> { sendLockBroadcast(); """{"type":"status","message":"lock requested"}""" }
                "block_app"        -> {
                    val pkg = payload.optString("packageName", "")
                    if (pkg.isNotBlank()) addBlockedApp(pkg)
                    """{"type":"status","message":"blocked $pkg"}"""
                }
                "unblock_app"      -> {
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

    // ── Camera capture (Camera2 API) ──────────────────────────────────────────

    @android.annotation.SuppressLint("MissingPermission")
    private fun capturePhoto(payload: JSONObject): String {
        if (ctx.checkSelfPermission(android.Manifest.permission.CAMERA)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return """{"type":"error","message":"camera permission not granted"}"""
        }

        val wantFront = payload.optString("camera", "back") == "front"
        val facingWanted = if (wantFront) CameraCharacteristics.LENS_FACING_FRONT
                           else           CameraCharacteristics.LENS_FACING_BACK

        val manager  = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == facingWanted
        } ?: manager.cameraIdList.firstOrNull()
          ?: return """{"type":"error","message":"no camera available"}"""

        val chars = manager.getCameraCharacteristics(cameraId)
        val map   = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val sizes = map?.getOutputSizes(ImageFormat.JPEG) ?: emptyArray()
        // Pick largest size ≤ 1920 wide for manageable payload
        val size = sizes.filter { it.width <= 1920 }
            .maxByOrNull { it.width * it.height }
            ?: android.util.Size(1280, 720)

        val latch = CountDownLatch(1)
        var resultJson = """{"type":"error","message":"timeout — camera did not respond in 15 s"}"""

        val thread  = HandlerThread("CameraCapture").also { it.start() }
        val handler = Handler(thread.looper)

        val imageReader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
        imageReader.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val buffer = image.planes[0].buffer
                val bytes  = ByteArray(buffer.remaining()).also { buffer.get(it) }
                val b64    = Base64.encodeToString(bytes, Base64.NO_WRAP)
                resultJson = """{"type":"photo","data":"$b64","mimeType":"image/jpeg","width":${size.width},"height":${size.height}}"""
            } finally {
                image.close()
                latch.countDown()
            }
        }, handler)

        try {
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    device.createCaptureSession(
                        listOf(imageReader.surface),
                        object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(session: CameraCaptureSession) {
                                val req = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                                    addTarget(imageReader.surface)
                                    set(CaptureRequest.JPEG_QUALITY, 85.toByte())
                                    set(CaptureRequest.CONTROL_AF_MODE,
                                        CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                    set(CaptureRequest.CONTROL_AE_MODE,
                                        CaptureRequest.CONTROL_AE_MODE_ON)
                                }
                                session.capture(req.build(), object : android.hardware.camera2.CameraCaptureSession.CaptureCallback() {
                                    override fun onCaptureFailed(
                                        session: CameraCaptureSession,
                                        request: CaptureRequest,
                                        failure: android.hardware.camera2.CaptureFailure
                                    ) {
                                        resultJson = """{"type":"error","message":"capture failed"}"""
                                        latch.countDown()
                                    }
                                }, handler)
                            }
                            override fun onConfigureFailed(session: CameraCaptureSession) {
                                resultJson = """{"type":"error","message":"camera session config failed"}"""
                                latch.countDown()
                            }
                        }, handler)
                }
                override fun onDisconnected(device: CameraDevice) {
                    device.close()
                    resultJson = """{"type":"error","message":"camera disconnected"}"""
                    latch.countDown()
                }
                override fun onError(device: CameraDevice, error: Int) {
                    device.close()
                    resultJson = """{"type":"error","message":"camera error code $error"}"""
                    latch.countDown()
                }
            }, handler)

            latch.await(15, TimeUnit.SECONDS)
        } catch (e: Exception) {
            resultJson = """{"type":"error","message":"${e.message}"}"""
        } finally {
            try { imageReader.close() } catch (_: Exception) {}
            thread.quitSafely()
        }

        return resultJson
    }

    // ── Audio recording ───────────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun startRecording(): String {
        // Stop any existing recording first
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

    private fun listFiles(): String {
        val entries = JSONArray()
        val dirs = listOf(
            Environment.getExternalStorageDirectory(),
            ctx.getExternalFilesDir(null),
        )
        dirs.filterNotNull().forEach { dir ->
            dir.listFiles()?.take(100)?.forEach { f ->
                entries.put(JSONObject().apply {
                    put("name",     f.name)
                    put("size",     f.length())
                    put("isDir",    f.isDirectory)
                    put("modified", f.lastModified())
                    put("path",     f.absolutePath)
                })
            }
        }
        return JSONObject().apply {
            put("type",    "files")
            put("entries", entries)
        }.toString()
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
            val body = """{"status":"$status","result":${escapeForJson(resultJson)}}""".toByteArray(Charsets.UTF_8)
            val conn = (URL("$baseUrl/api/commands/$commandId/status").openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Authorization",  "Bearer $token")
                setRequestProperty("Content-Type",   "application/json")
                setRequestProperty("Content-Length", body.size.toString())
                doOutput        = true
                connectTimeout  = 15_000
                readTimeout     = 30_000   // photos can be large
                setFixedLengthStreamingMode(body.size)
            }
            conn.outputStream.use { it.write(body) }
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun escapeForJson(raw: String): String {
        // resultJson is already valid JSON — wrap as a JSON string value only if it's not an object/array
        return if (raw.startsWith("{") || raw.startsWith("[")) raw
               else "\"${raw.replace("\\", "\\\\").replace("\"", "\\\"")}\""
    }

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
        const val PREFS_COMMANDS  = "pm_commands"
        const val KEY_GEOFENCES   = "geofence_zones"
        const val KEY_BLOCKED_APPS = "blocked_apps"
    }
}
