package com.parentalmonitor.child.services

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.Environment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Polls the backend for pending remote commands and executes them.
 * Also fetches geofence zones and app block rules for local enforcement.
 */
class RemoteCommandService(private val ctx: Context, private val baseUrl: String) {

    private var mediaRecorder: MediaRecorder? = null

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

        try {
            val result = when (commandType) {
                "list_files"       -> listFiles()
                "start_mic",
                "start_recording"  -> { startRecording(); """{"status":"recording_started"}""" }
                "stop_mic",
                "stop_recording"   -> { stopRecording(); """{"status":"recording_stopped"}""" }
                "lock_device"      -> { sendLockBroadcast(); """{"status":"lock_requested"}""" }
                "get_screen"       -> """{"status":"not_supported","reason":"requires_system_permission"}"""
                "capture_photo"    -> """{"status":"not_supported","reason":"requires_foreground_activity"}"""
                "block_app"        -> {
                    val pkg = try { JSONObject(cmd.optString("payload", "{}")).optString("packageName") } catch (_: Exception) { "" }
                    if (pkg.isNotBlank()) addBlockedApp(pkg)
                    """{"status":"blocked","packageName":"$pkg"}"""
                }
                "unblock_app"      -> {
                    val pkg = try { JSONObject(cmd.optString("payload", "{}")).optString("packageName") } catch (_: Exception) { "" }
                    if (pkg.isNotBlank()) removeBlockedApp(pkg)
                    """{"status":"unblocked","packageName":"$pkg"}"""
                }
                else               -> """{"status":"unknown_command"}"""
            }
            reportResult(token, commandId, "completed", result)
        } catch (e: Exception) {
            reportResult(token, commandId, "failed", """{"error":"${e.message?.replace("\"","\'")}"}""")
        }
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
            val rules = fetchJson("$baseUrl/api/commands/app-blocks?deviceId=$deviceId", token)
            val blocked = JSONArray()
            for (i in 0 until rules.length()) {
                val rule = rules.getJSONObject(i)
                if (rule.optBoolean("isBlocked", false)) {
                    blocked.put(rule.optString("packageName"))
                }
            }
            ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
                .edit().putString(KEY_BLOCKED_APPS, blocked.toString()).apply()
        } catch (_: Exception) {}
    }

    private fun addBlockedApp(packageName: String) {
        val prefs    = ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
        val existing = try { JSONArray(prefs.getString(KEY_BLOCKED_APPS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        for (i in 0 until existing.length()) if (existing.getString(i) == packageName) return
        existing.put(packageName)
        prefs.edit().putString(KEY_BLOCKED_APPS, existing.toString()).apply()
    }

    private fun removeBlockedApp(packageName: String) {
        val prefs    = ctx.getSharedPreferences(PREFS_COMMANDS, Context.MODE_PRIVATE)
        val existing = try { JSONArray(prefs.getString(KEY_BLOCKED_APPS, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        val updated  = JSONArray()
        for (i in 0 until existing.length()) if (existing.getString(i) != packageName) updated.put(existing.getString(i))
        prefs.edit().putString(KEY_BLOCKED_APPS, updated.toString()).apply()
    }

    // ── Command results ───────────────────────────────────────────────────────

    private fun reportResult(token: String, commandId: String, status: String, result: String) {
        try {
            val url  = URL("$baseUrl/api/commands/$commandId/status")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type", "application/json")
                doOutput = true
                connectTimeout = 10_000
                readTimeout    = 10_000
            }
            conn.outputStream.write("""{"status":"$status","result":$result}""".toByteArray())
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
    }

    // ── File listing ──────────────────────────────────────────────────────────

    private fun listFiles(): String {
        val arr = JSONArray()
        val dirs = listOf(
            Environment.getExternalStorageDirectory(),
            ctx.getExternalFilesDir(null),
        )
        dirs.filterNotNull().forEach { dir ->
            dir.listFiles()?.take(50)?.forEach { f ->
                arr.put(JSONObject().apply {
                    put("name",     f.name)
                    put("size",     f.length())
                    put("isDir",    f.isDirectory)
                    put("modified", f.lastModified())
                })
            }
        }
        return arr.toString()
    }

    // ── Audio recording ───────────────────────────────────────────────────────

    @Suppress("DEPRECATION")
    private fun startRecording() {
        stopRecording()
        val file = File(ctx.cacheDir, "rec_${System.currentTimeMillis()}.3gp")
        mediaRecorder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            MediaRecorder(ctx) else MediaRecorder()).apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
            setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }
    }

    private fun stopRecording() {
        try { mediaRecorder?.apply { stop(); release() } } catch (_: Exception) {}
        mediaRecorder = null
    }

    private fun sendLockBroadcast() {
        // Requires DEVICE_ADMIN or screen-off intent on rooted devices
        // Best-effort: bring up screen lock via broadcast
        ctx.sendBroadcast(android.content.Intent("com.parentalmonitor.LOCK_SCREEN"))
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
