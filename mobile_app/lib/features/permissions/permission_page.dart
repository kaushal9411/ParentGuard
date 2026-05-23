import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../services/permission_service.dart';
import '../../services/subscription_service.dart';

class PermissionPage extends ConsumerStatefulWidget {
  const PermissionPage({
    super.key,
    required this.onComplete,
    this.features = SubscriptionFeatures.free,
    this.continueLabel,
  });
  final VoidCallback           onComplete;
  final SubscriptionFeatures   features;
  /// Override the Continue button label. If null, auto text is used.
  final String?                continueLabel;

  @override
  ConsumerState<PermissionPage> createState() => _PermissionPageState();
}

class _PermissionPageState extends ConsumerState<PermissionPage>
    with WidgetsBindingObserver {

  // Permission statuses
  bool _location      = false;
  bool _callLog       = false;
  bool _sms           = false;
  bool _contacts      = false;
  bool _media         = false;
  bool _camera        = false;
  bool _mic           = false;
  bool _battery       = false;
  bool _notification  = false;
  bool _usageStats    = false;
  bool _notifAccess   = false;
  bool _accessibility = false;

  bool _loading = true;

  // Shorthand so we don't repeat widget.features everywhere
  SubscriptionFeatures get _f => widget.features;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _init() async {
    final svc = ref.read(permissionServiceProvider);
    // Only request permissions the plan actually needs
    await svc.requestPlanPermissions(_f);
    await _refresh();
  }

  Future<void> _refresh() async {
    final svc = ref.read(permissionServiceProvider);
    // Always check the three base permissions
    // Always check base permissions
    final loc     = await svc.isLocationGranted();
    final notif   = await svc.isNotificationGranted();
    final battery = await svc.isBatteryOptimisationExempt();

    // Conditionally check plan-gated permissions (default true = not required = don't block)
    final callLog    = _f.callLogs       ? await svc.isCallLogGranted()            : true;
    final sms        = _f.smsLogs        ? await svc.isSmsGranted()                : true;
    final contacts   = _f.contacts       ? await svc.isContactsGranted()           : true;
    final media      = _f.gallery        ? await svc.isMediaGranted()              : true;
    final camera     = _f.remoteCommands ? await svc.isCameraGranted()             : true;
    final mic        = _f.remoteCommands ? await svc.isMicGranted()                : true;
    final usage      = _f.appUsage       ? await svc.isUsageStatsGranted()         : true;
    final notifAcc   = _f.notifications  ? await svc.isNotificationAccessGranted() : true;
    final accessib   = (_f.browsingHistory || _f.appBlocking)
                                         ? await svc.isAccessibilityGranted()      : true;

    if (!mounted) return;
    setState(() {
      _location      = loc;
      _notification  = notif;
      _battery       = battery;
      _callLog       = callLog;
      _sms           = sms;
      _contacts      = contacts;
      _media         = media;
      _camera        = camera;
      _mic           = mic;
      _usageStats    = usage;
      _notifAccess   = notifAcc;
      _accessibility = accessib;
      _loading       = false;
    });
  }

  // _allGranted only checks permissions required by this plan
  bool get _allGranted {
    if (!_location || !_notification || !_battery) return false;
    if (_f.callLogs       && !_callLog)     return false;
    if (_f.smsLogs        && !_sms)         return false;
    if (_f.contacts       && !_contacts)    return false;
    if (_f.gallery        && !_media)       return false;
    if (_f.remoteCommands && (!_camera || !_mic)) return false;
    if (_f.appUsage       && !_usageStats)  return false;
    if (_f.notifications  && !_notifAccess) return false;
    if ((_f.browsingHistory || _f.appBlocking) && !_accessibility) return false;
    return true;
  }

  bool get _minimumGranted => _location && _notification;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  // ── Header ──────────────────────────────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(
                            color: cs.primary.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(Icons.shield_rounded,
                              color: cs.primary, size: 32),
                        ),
                        const SizedBox(height: 16),
                        const Text('App Permissions',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        Text(
                          'Grant the permissions below to enable full monitoring. '
                          'Tap each button to allow.',
                          style: TextStyle(
                              color: Colors.white.withOpacity(0.6),
                              fontSize: 14),
                        ),
                      ],
                    ),
                  ),

                  // ── Permission list (filtered by plan) ──────────────────
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      children: [
                        // ── Standard permissions ──────────────────────────
                        _section('REQUIRED PERMISSIONS', [
                          // Always required
                          _PermItem(
                            icon: Icons.location_on_rounded,
                            color: Colors.orange,
                            title: 'Location (Always On)',
                            desc: 'Track GPS position in background',
                            granted: _location,
                            onGrant: () async {
                              final fg = await Permission.locationWhenInUse.request();
                              if (fg.isGranted) await Permission.locationAlways.request();
                              _refresh();
                            },
                          ),
                          _PermItem(
                            icon: Icons.notifications_rounded,
                            color: Colors.blue,
                            title: 'Notifications',
                            desc: 'Show persistent monitoring notification',
                            granted: _notification,
                            onGrant: () async {
                              await Permission.notification.request();
                              _refresh();
                            },
                          ),
                          _PermItem(
                            icon: Icons.battery_charging_full_rounded,
                            color: Colors.amber,
                            title: 'Battery Optimisation',
                            desc: 'Keep app running reliably in background',
                            granted: _battery,
                            isSpecial: true,
                            onGrant: () async {
                              // Request via permission_handler first — it properly
                              // awaits the dialog result via onActivityResult
                              final status = await Permission.ignoreBatteryOptimizations.request();
                              if (status.isGranted) {
                                _refresh();
                                return;
                              }
                              // Fallback: open native battery settings screen
                              await ref.read(permissionServiceProvider)
                                  .openBatteryOptimizationSettings();
                              // Battery dialog is a popup overlay — lifecycle
                              // resumed event may not fire on all OEMs, so poll
                              // every second for up to 15 s after the dialog opens
                              for (var i = 0; i < 15; i++) {
                                await Future.delayed(const Duration(seconds: 1));
                                final granted = await ref.read(permissionServiceProvider)
                                    .isBatteryOptimisationExempt();
                                if (!mounted) return;
                                if (granted) { _refresh(); return; }
                              }
                            },
                          ),

                          // Plan-conditional standard permissions
                          if (_f.callLogs) _PermItem(
                            icon: Icons.phone_rounded,
                            color: Colors.green,
                            title: 'Call Logs',
                            desc: 'Monitor incoming and outgoing calls',
                            granted: _callLog,
                            onGrant: () async {
                              await Permission.phone.request();
                              _refresh();
                            },
                          ),
                          if (_f.smsLogs) _PermItem(
                            icon: Icons.sms_rounded,
                            color: Colors.deepPurple,
                            title: 'SMS Messages',
                            desc: 'Read sent and received text messages',
                            granted: _sms,
                            onGrant: () async {
                              await Permission.sms.request();
                              _refresh();
                            },
                          ),
                          if (_f.contacts) _PermItem(
                            icon: Icons.contacts_rounded,
                            color: Colors.teal,
                            title: 'Contacts',
                            desc: 'Sync contact list from device',
                            granted: _contacts,
                            onGrant: () async {
                              await Permission.contacts.request();
                              _refresh();
                            },
                          ),
                          if (_f.gallery) _PermItem(
                            icon: Icons.photo_library_rounded,
                            color: Colors.pink,
                            title: 'Photos & Videos',
                            desc: 'Access device gallery',
                            granted: _media,
                            onGrant: () async {
                              await Permission.photos.request();
                              await Permission.videos.request();
                              await Permission.storage.request();
                              _refresh();
                            },
                          ),
                          if (_f.remoteCommands) _PermItem(
                            icon: Icons.camera_alt_rounded,
                            color: Colors.purple,
                            title: 'Camera',
                            desc: 'Remote photo capture command',
                            granted: _camera,
                            onGrant: () async {
                              await Permission.camera.request();
                              _refresh();
                            },
                          ),
                          if (_f.remoteCommands) _PermItem(
                            icon: Icons.mic_rounded,
                            color: Colors.red,
                            title: 'Microphone',
                            desc: 'Remote audio recording command',
                            granted: _mic,
                            onGrant: () async {
                              await Permission.microphone.request();
                              _refresh();
                            },
                          ),
                        ]),

                        // ── Special access — only shown if plan needs them ─
                        if (_f.appUsage || _f.notifications ||
                            _f.browsingHistory || _f.appBlocking) ...[
                          const SizedBox(height: 8),
                          _section('SPECIAL ACCESS  (tap to open Settings)', [
                            if (_f.appUsage) _PermItem(
                              icon: Icons.bar_chart_rounded,
                              color: Colors.indigo,
                              title: 'Usage Access',
                              desc: 'Monitor which apps are used and for how long',
                              granted: _usageStats,
                              isSpecial: true,
                              onGrant: () async {
                                await ref.read(permissionServiceProvider)
                                    .openUsageStatsSettings();
                              },
                            ),
                            if (_f.notifications) _PermItem(
                              icon: Icons.notifications_active_rounded,
                              color: Colors.deepOrange,
                              title: 'Notification Access',
                              desc: 'Capture notifications from all apps',
                              granted: _notifAccess,
                              isSpecial: true,
                              onGrant: () async {
                                await ref.read(permissionServiceProvider)
                                    .openNotificationAccessSettings();
                              },
                            ),
                            if (_f.browsingHistory || _f.appBlocking) _PermItem(
                              icon: Icons.accessibility_new_rounded,
                              color: Colors.cyan,
                              title: 'Accessibility Service',
                              desc: 'App blocking + browser URL monitoring',
                              granted: _accessibility,
                              isSpecial: true,
                              onGrant: () async {
                                await ref.read(permissionServiceProvider)
                                    .openAccessibilitySettings();
                              },
                            ),
                          ]),
                        ],

                        const SizedBox(height: 16),
                      ],
                    ),
                  ),

                  // ── Bottom bar ───────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      border: Border(
                          top: BorderSide(
                              color: Colors.white.withOpacity(0.08))),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!_allGranted)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              children: [
                                Icon(
                                  _minimumGranted
                                      ? Icons.info_outline_rounded
                                      : Icons.warning_amber_rounded,
                                  size: 16,
                                  color: _minimumGranted
                                      ? Colors.amber
                                      : Colors.red,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _minimumGranted
                                        ? 'Some permissions missing — monitoring will be limited'
                                        : 'Location permission is required to continue',
                                    style: TextStyle(
                                      color: _minimumGranted
                                          ? Colors.amber
                                          : Colors.red,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _minimumGranted
                                ? widget.onComplete
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _allGranted
                                  ? Colors.green.shade600
                                  : cs.primary,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor:
                                  Colors.white.withOpacity(0.1),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (_allGranted) ...[
                                  const Icon(Icons.check_circle_rounded,
                                      size: 18, color: Colors.white),
                                  const SizedBox(width: 8),
                                ],
                                Text(
                                  widget.continueLabel ??
                                      (_allGranted
                                          ? 'All Granted — Continue'
                                          : 'Continue with Partial Permissions'),
                                  style: const TextStyle(
                                      fontSize: 15, fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _section(String title, List<Widget> items) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8, top: 4),
            child: Text(title,
                style: TextStyle(
                    color: Colors.white.withOpacity(0.4),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8)),
          ),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            child: Column(
              children: List.generate(items.length, (i) => Column(
                children: [
                  items[i],
                  if (i < items.length - 1)
                    Divider(height: 1,
                        color: Colors.white.withOpacity(0.06),
                        indent: 56),
                ],
              )),
            ),
          ),
        ],
      );
}

// ── Single permission row ────────────────────────────────────────────────────

class _PermItem extends StatelessWidget {
  const _PermItem({
    required this.icon,
    required this.color,
    required this.title,
    required this.desc,
    required this.granted,
    required this.onGrant,
    this.isSpecial = false,
  });

  final IconData icon;
  final Color    color;
  final String   title;
  final String   desc;
  final bool     granted;
  final bool     isSpecial;
  final VoidCallback onGrant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Icon bubble
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(desc,
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.45),
                        fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Status / action
          granted
              ? const Icon(Icons.check_circle_rounded,
                  color: Colors.greenAccent, size: 26)
              : GestureDetector(
                  onTap: onGrant,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: color.withOpacity(0.4)),
                    ),
                    child: Text(
                      isSpecial ? 'Settings' : 'Allow',
                      style: TextStyle(
                          color: color,
                          fontSize: 12,
                          fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
        ],
      ),
    );
  }
}
