import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';

import 'core/constants/app_constants.dart';
import 'core/utils/token_store.dart';
import 'services/auth_service.dart';
import 'services/background_worker.dart';
import 'services/permission_service.dart';
import 'storage/database_provider.dart';
import 'features/auth/welcome_page.dart';
import 'features/tracking/tracking_home_page.dart';
import 'features/permissions/permission_page.dart';

// WorkManager callback — runs in an isolated Dart entry point.
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    switch (task) {
      case AppConstants.syncTaskName:
        await BackgroundWorker.syncPendingEvents();
      case AppConstants.locationTaskName:
        await BackgroundWorker.captureLocationSnapshot();
        await BackgroundWorker.syncPendingEvents(); // upload immediately
      case AppConstants.deviceStatusTaskName:
        await BackgroundWorker.captureDeviceStatus();
      case AppConstants.usageTaskName:
        await BackgroundWorker.captureUsageSnapshot();
    }
    return true;
  });
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);

  runApp(const ProviderScope(child: ParentalMonitorApp()));
}

class ParentalMonitorApp extends StatelessWidget {
  const ParentalMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Device Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1A237E)),
        useMaterial3: true,
      ),
      home: const AppEntryPoint(),
    );
  }
}

class AppEntryPoint extends ConsumerStatefulWidget {
  const AppEntryPoint({super.key});

  @override
  ConsumerState<AppEntryPoint> createState() => _AppEntryPointState();
}

class _AppEntryPointState extends ConsumerState<AppEntryPoint> {
  bool _ready        = false;
  bool _loggedIn     = false;
  bool _needsPerms   = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    ref.read(appDatabaseProvider);

    await _registerWorkManager();

    // Validate stored token
    final authSvc  = AuthService(AppConstants.backendBaseUrl);
    final loggedIn = await authSvc.validateToken();

    // Check if any permission is missing
    final permSvc    = ref.read(permissionServiceProvider);
    final statuses   = await Future.wait([
      permSvc.isLocationGranted(),
      permSvc.isCallLogGranted(),
      permSvc.isContactsGranted(),
      permSvc.isMediaGranted(),
      permSvc.isCameraGranted(),
      permSvc.isMicGranted(),
      permSvc.isBatteryOptimisationExempt(),
      permSvc.isNotificationGranted(),
      permSvc.isUsageStatsGranted(),
      permSvc.isNotificationAccessGranted(),
      permSvc.isAccessibilityGranted(),
    ]);
    final allGranted = statuses.every((v) => v);

    if (mounted) {
      setState(() {
        _ready      = true;
        _loggedIn   = loggedIn;
        _needsPerms = !allGranted;
      });
    }
  }

  Future<void> _registerWorkManager() async {
    await Workmanager().registerPeriodicTask(
      AppConstants.syncTaskName,
      AppConstants.syncTaskName,
      frequency: const Duration(minutes: AppConstants.syncIntervalMinutes),
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingWorkPolicy.replace,
    );
    await Workmanager().registerPeriodicTask(
      AppConstants.locationTaskName,
      AppConstants.locationTaskName,
      frequency: const Duration(minutes: AppConstants.locationIntervalMinutes),
      constraints: Constraints(networkType: NetworkType.not_required),
      existingWorkPolicy: ExistingWorkPolicy.replace,
    );
    await Workmanager().registerPeriodicTask(
      AppConstants.deviceStatusTaskName,
      AppConstants.deviceStatusTaskName,
      frequency: const Duration(minutes: AppConstants.syncIntervalMinutes),
      constraints: Constraints(networkType: NetworkType.not_required),
      existingWorkPolicy: ExistingWorkPolicy.replace,
    );
  }

  void _onPermsDone() => setState(() => _needsPerms = false);

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Always show permission screen first if any permission is missing
    if (_needsPerms) {
      return PermissionPage(onComplete: _onPermsDone);
    }

    return _loggedIn ? const TrackingHomePage() : const WelcomePage();
  }
}
