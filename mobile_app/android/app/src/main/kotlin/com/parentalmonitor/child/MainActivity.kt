package com.parentalmonitor.child

import com.parentalmonitor.child.channels.TrackingMethodChannel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {

    private lateinit var trackingChannel: TrackingMethodChannel

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        trackingChannel = TrackingMethodChannel(
            this,
            flutterEngine.dartExecutor.binaryMessenger
        )
        trackingChannel.register()
    }

    override fun onDestroy() {
        trackingChannel.unregister()
        super.onDestroy()
    }
}
