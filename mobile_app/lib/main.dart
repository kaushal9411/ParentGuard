import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';

import 'core/constants/app_constants.dart';
import 'services/auth_service.dart';
import 'services/background_worker.dart';
import 'storage/database_provider.dart';
import 'features/auth/welcome_page.dart';
import 'features/tracking/tracking_home_page.dart';

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    switch (task) {
      case AppConstants.syncTaskName:
        await BackgroundWorker.syncPendingEvents();
      case AppConstants.locationTaskName:
        await BackgroundWorker.captureLocationSnapshot();
        await BackgroundWorker.syncPendingEvents();
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
  bool _ready    = false;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    ref.read(appDatabaseProvider);
    await _registerWorkManager();

    final authSvc  = AuthService(AppConstants.backendBaseUrl);
    final loggedIn = await authSvc.validateToken();

    if (mounted) {
      setState(() {
        _ready    = true;
        _loggedIn = loggedIn;
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

  @override
  Widget build(BuildContext context) {
    if (!_ready) {R
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(child: CircularProgressIndicator()),
      );
    }
    // TrackingHomePage handles plan-based permission check after login
    return _loggedIn ? const TrackingHomePage() : const WelcomePage();
  }
}
