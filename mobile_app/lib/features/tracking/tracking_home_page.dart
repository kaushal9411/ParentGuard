import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../device_status/device_status_provider.dart';
import '../location/location_provider.dart';
import '../usage_tracking/usage_provider.dart';
import '../auth/welcome_page.dart';
import '../../platform/tracking_channel.dart';
import '../../services/auth_service.dart';
import '../../services/permission_service.dart';
import '../../core/constants/app_constants.dart';

class TrackingHomePage extends ConsumerStatefulWidget {
  const TrackingHomePage({super.key});

  @override
  ConsumerState<TrackingHomePage> createState() => _TrackingHomePageState();
}

class _TrackingHomePageState extends ConsumerState<TrackingHomePage> {
  bool _serviceRunning = false;

  @override
  void initState() {
    super.initState();
    _checkServiceStatus();
  }

  Future<void> _checkServiceStatus() async {
    final running = await TrackingChannel.instance.isTrackingActive();
    if (mounted) setState(() => _serviceRunning = running);
  }

  Future<void> _confirmLogout(BuildContext context) async {
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
      if (mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const WelcomePage()),
          (_) => false,
        );
      }
    }
  }

  Future<void> _toggleService() async {
    if (_serviceRunning) {
      await TrackingChannel.instance.stopTrackingService();
    } else {
      final permSvc = ref.read(permissionServiceProvider);
      await permSvc.requestEssentialPermissions();
      await TrackingChannel.instance.startTrackingService();
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
            const _DeviceStatusCard(),
            const SizedBox(height: 12),
            const _LocationCard(),
            const SizedBox(height: 12),
            const _UsageCard(),
            const SizedBox(height: 12),
            const _PermissionsCard(),
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
          ],
        ),
      ),
    );
  }
}
