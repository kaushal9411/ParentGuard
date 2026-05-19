import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../device_status/device_status_provider.dart';
import '../location/location_provider.dart';
import '../usage_tracking/usage_provider.dart';
import '../auth/welcome_page.dart';
import '../../platform/tracking_channel.dart';
import '../../services/auth_service.dart';
import '../../services/background_worker.dart';
import '../../services/permission_service.dart';
import '../../services/subscription_service.dart';
import '../../core/constants/app_constants.dart';

class TrackingHomePage extends ConsumerStatefulWidget {
  const TrackingHomePage({super.key});

  @override
  ConsumerState<TrackingHomePage> createState() => _TrackingHomePageState();
}

class _TrackingHomePageState extends ConsumerState<TrackingHomePage> {
  bool _serviceRunning = false;
  Timer? _monitorTimer;
  SubscriptionInfo? _subscription;

  @override
  void initState() {
    super.initState();
    _checkServiceStatus();
    _fetchSubscription();
    _monitorTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => BackgroundWorker.captureAllAndSync(),
    );
  }

  Future<void> _fetchSubscription() async {
    final sub = await SubscriptionService.fetch();
    if (mounted) setState(() => _subscription = sub);
  }

  @override
  void dispose() {
    _monitorTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkServiceStatus() async {
    final running = await TrackingChannel.instance.isTrackingActive();
    if (mounted) setState(() => _serviceRunning = running);
  }

  Future<void> _confirmRemoveDevice(BuildContext context) async {
    final nav = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Remove This Device',
            style: TextStyle(fontWeight: FontWeight.w700, color: Colors.red)),
        content: const Text(
          'This will permanently delete this device and ALL collected data '
          '(location, calls, gallery, browsing history, etc.) from the server.\n\n'
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove Device'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await TrackingChannel.instance.stopTrackingService();
      await AuthService(AppConstants.backendBaseUrl).removeDevice();
      nav.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const WelcomePage()),
        (_) => false,
      );
    }
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final nav = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Are you sure you want to sign out of this device?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await TrackingChannel.instance.stopTrackingService();
      await AuthService(AppConstants.backendBaseUrl).logout();
      nav.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const WelcomePage()),
        (_) => false,
      );
    }
  }

  Future<void> _toggleService() async {
    if (_serviceRunning) {
      await TrackingChannel.instance.stopTrackingService();
    } else {
      final permSvc = ref.read(permissionServiceProvider);
      await permSvc.requestEssentialPermissions();
      await TrackingChannel.instance.startTrackingService();
      // Capture and upload immediately so admin sees data right away.
      BackgroundWorker.captureAllAndSync();
    }
    await _checkServiceStatus();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        title: const Text('Device Monitor'),
        centerTitle: true,
        backgroundColor: cs.primary,
        foregroundColor: cs.onPrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Logout',
            onPressed: () => _confirmLogout(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(recentLocationsProvider);
          ref.invalidate(todayUsageProvider);
          ref.invalidate(deviceStatusProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _ServiceStatusCard(running: _serviceRunning, onToggle: _toggleService),
            const SizedBox(height: 12),
            _SubscriptionCard(info: _subscription),
            const SizedBox(height: 12),
            const _DeviceStatusCard(),
            const SizedBox(height: 12),
            const _LocationCard(),
            const SizedBox(height: 12),
            const _UsageCard(),
            const SizedBox(height: 12),
            const _PermissionsCard(),
            const SizedBox(height: 12),
            _DangerCard(onRemoveDevice: () => _confirmRemoveDevice(context)),
          ],
        ),
      ),
    );
  }
}

class _ServiceStatusCard extends StatelessWidget {
  const _ServiceStatusCard({required this.running, required this.onToggle});

  final bool running;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              running ? Icons.shield : Icons.shield_outlined,
              color: running ? Colors.green : Colors.grey,
              size: 40,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    running ? 'Tracking Active' : 'Tracking Stopped',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    running
                        ? 'GPS + usage monitoring running'
                        : 'Tap to start monitoring',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Switch(value: running, onChanged: (_) => onToggle()),
          ],
        ),
      ),
    );
  }
}

class _DeviceStatusCard extends ConsumerWidget {
  const _DeviceStatusCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(deviceStatusProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Device Status',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            status.when(
              data: (s) => s == null
                  ? const Text('No data yet')
                  : Row(
                      children: [
                        const Icon(Icons.battery_std),
                        const SizedBox(width: 8),
                        Text('${s.batteryLevel}% '
                            '${s.isCharging ? '(charging)' : ''}'),
                        const Spacer(),
                        const Icon(Icons.wifi),
                        const SizedBox(width: 4),
                        Text(s.networkType),
                      ],
                    ),
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error: $e'),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationCard extends ConsumerWidget {
  const _LocationCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locations = ref.watch(recentLocationsProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Recent Locations',
                    style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.my_location),
                  onPressed: () => ref.invalidate(captureLocationProvider),
                  tooltip: 'Capture now',
                ),
              ],
            ),
            locations.when(
              data: (list) => list.isEmpty
                  ? const Text('No locations captured yet')
                  : Column(
                      children: list.take(3).map((l) {
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.location_pin, size: 18),
                          title: Text(
                            '${l.latitude.toStringAsFixed(5)}, '
                            '${l.longitude.toStringAsFixed(5)}',
                          ),
                          subtitle: Text(
                            l.capturedAt.toLocal().toString().substring(0, 16),
                          ),
                          trailing: l.synced
                              ? const Icon(Icons.cloud_done,
                                  size: 16, color: Colors.green)
                              : const Icon(Icons.cloud_off,
                                  size: 16, color: Colors.orange),
                        );
                      }).toList(),
                    ),
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error: $e'),
            ),
          ],
        ),
      ),
    );
  }
}

class _UsageCard extends ConsumerWidget {
  const _UsageCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usage = ref.watch(todayUsageProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Today's App Usage",
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            usage.when(
              data: (list) => list.isEmpty
                  ? const Text('No usage data yet')
                  : Column(
                      children: list.take(5).map((u) {
                        final mins = u.usageDurationMs ~/ 60000;
                        return ListTile(
                          dense: true,
                          leading: const Icon(Icons.apps, size: 18),
                          title: Text(u.appName),
                          trailing: Text('${mins}m'),
                        );
                      }).toList(),
                    ),
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error: $e'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PermissionsCard extends ConsumerWidget {
  const _PermissionsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permSvc = ref.read(permissionServiceProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Special Permissions',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ListTile(
              dense: true,
              leading: const Icon(Icons.notifications),
              title: const Text('Notification Access'),
              subtitle: const Text('Required to capture notifications'),
              trailing: TextButton(
                onPressed: permSvc.openNotificationAccessSettings,
                child: const Text('Grant'),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.bar_chart),
              title: const Text('Usage Stats Access'),
              subtitle: const Text('Required to track app usage'),
              trailing: TextButton(
                onPressed: permSvc.openUsageStatsSettings,
                child: const Text('Grant'),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.call),
              title: const Text('Call Log Access'),
              subtitle: const Text('Required to capture call history'),
              trailing: TextButton(
                onPressed: () => permSvc.requestCallLogPermission(),
                child: const Text('Grant'),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.contacts),
              title: const Text('Contacts Access'),
              subtitle: const Text('Required to capture contacts'),
              trailing: TextButton(
                onPressed: () => permSvc.requestContactsPermission(),
                child: const Text('Grant'),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.photo_library),
              title: const Text('Media Access'),
              subtitle: const Text('Required to capture gallery items'),
              trailing: TextButton(
                onPressed: () => permSvc.requestMediaPermission(),
                child: const Text('Grant'),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.accessibility_new),
              title: const Text('Accessibility Service'),
              subtitle: const Text('Required for app blocking'),
              trailing: TextButton(
                onPressed: permSvc.openAccessibilitySettings,
                child: const Text('Grant'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DangerCard extends StatelessWidget {
  const _DangerCard({required this.onRemoveDevice});

  final VoidCallback onRemoveDevice;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.red.shade50,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.red.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.warning_rounded, color: Colors.red.shade700, size: 18),
                const SizedBox(width: 8),
                Text('Danger Zone',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Colors.red.shade700)),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.delete_forever_rounded),
                label: const Text('Remove This Device'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade700,
                  side: BorderSide(color: Colors.red.shade400),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: onRemoveDevice,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Permanently removes this device and deletes all collected data from the server.',
              style: TextStyle(fontSize: 11, color: Colors.red.shade600),
            ),
          ],
        ),
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.info});
  final SubscriptionInfo? info;

  @override
  Widget build(BuildContext context) {
    if (info == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(children: [
            SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 12),
            Text('Loading subscription...', style: TextStyle(fontSize: 13, color: Colors.grey)),
          ]),
        ),
      );
    }
    final isActive = info!.isActive;
    final planName = info!.planName ?? 'Free';
    final expiry   = info!.expiresAt;
    final col      = isActive ? Colors.green.shade700 : Colors.orange.shade700;
    return Card(
      color: isActive ? Colors.green.shade50 : Colors.orange.shade50,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: isActive ? Colors.green.shade200 : Colors.orange.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(children: [
          Icon(Icons.workspace_premium_rounded, color: col, size: 22),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(planName + ' Plan',
              style: TextStyle(fontWeight: FontWeight.w700, color: col, fontSize: 14)),
            if (expiry != null)
              Text('Expires ' + expiry.day.toString() + '/' + expiry.month.toString() + '/' + expiry.year.toString(),
                style: TextStyle(fontSize: 11, color: col.withOpacity(0.8)))
            else if (isActive)
              Text('No expiry', style: TextStyle(fontSize: 11, color: col.withOpacity(0.8))),
          ])),
          if (!isActive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: Colors.orange.shade600, borderRadius: BorderRadius.circular(20)),
              child: const Text('Upgrade', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
        ]),
      ),
    );
  }
}
