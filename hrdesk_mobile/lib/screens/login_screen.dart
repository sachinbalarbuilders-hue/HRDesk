import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../core/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureNew = true;

  // 'login' | 'forgotEmail' | 'forgotOtp' | 'forgotDone'
  String _mode = 'login';
  bool _resetLoading = false;
  String? _resetError;
  String? _resetMessage;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    final auth = context.read<AuthProvider>();
    final success = await auth.login(
      _usernameCtrl.text.trim(),
      _passwordCtrl.text,
    );

    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/dashboard');
    }
  }

  Future<void> _sendOtp() async {
    if (_usernameCtrl.text.trim().isEmpty) {
      setState(() => _resetError = 'Please enter your email.');
      return;
    }
    setState(() {
      _resetLoading = true;
      _resetError = null;
    });
    try {
      final res = await ApiClient().dio.post('/auth/forgot-password',
          data: {'email': _usernameCtrl.text.trim()});
      setState(() {
        _resetMessage = res.data['message'] ?? 'Reset code sent to your email.';
        _mode = 'forgotOtp';
      });
    } catch (e) {
      setState(() => _resetError = _parseResetError(e));
    } finally {
      setState(() => _resetLoading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_otpCtrl.text.trim().isEmpty) {
      setState(() => _resetError = 'Enter the OTP code.');
      return;
    }
    if (_newPassCtrl.text.length < 6) {
      setState(() => _resetError = 'Password must be at least 6 characters.');
      return;
    }
    if (_newPassCtrl.text != _confirmPassCtrl.text) {
      setState(() => _resetError = 'Passwords do not match.');
      return;
    }

    setState(() {
      _resetLoading = true;
      _resetError = null;
    });
    try {
      await ApiClient().dio.post('/auth/reset-password', data: {
        'email': _usernameCtrl.text.trim(),
        'otp': _otpCtrl.text.trim(),
        'newPassword': _newPassCtrl.text,
      });
      setState(() => _mode = 'forgotDone');
    } catch (e) {
      setState(() => _resetError = _parseResetError(e));
    } finally {
      setState(() => _resetLoading = false);
    }
  }

  String _parseResetError(dynamic e) {
    try {
      final statusCode = (e as dynamic).response?.statusCode;
      if (statusCode == 429) return 'Too many attempts. Wait a minute.';
      final data = (e as dynamic).response?.data;
      if (data is Map && data['message'] != null) return data['message'];
    } catch (_) {}
    return 'Something went wrong.';
  }

  void _backToLogin() {
    setState(() {
      _mode = 'login';
      _resetError = null;
      _resetMessage = null;
      _otpCtrl.clear();
      _newPassCtrl.clear();
      _confirmPassCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    const accent = Color(0xFF0D9488);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                      color: accent, borderRadius: BorderRadius.circular(16)),
                  child: Icon(
                    _mode == 'login' ? Icons.business : Icons.lock_reset,
                    color: Colors.white,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  _mode == 'login'
                      ? 'HRDesk'
                      : _mode == 'forgotDone'
                          ? 'Password Reset!'
                          : 'Reset Password',
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 6),
                Text(
                  _mode == 'login'
                      ? 'Sign in to your account'
                      : _mode == 'forgotEmail'
                          ? 'Enter your email to get a reset code'
                          : _mode == 'forgotOtp'
                              ? 'Enter code and set new password'
                              : 'You can now sign in with your new password',
                  style:
                      const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 32),

                // Card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 16,
                          offset: const Offset(0, 4))
                    ],
                  ),
                  child: _buildContent(auth, accent),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(AuthProvider auth, Color accent) {
    switch (_mode) {
      case 'forgotEmail':
        return _buildForgotEmailStep(accent);
      case 'forgotOtp':
        return _buildForgotOtpStep(accent);
      case 'forgotDone':
        return _buildForgotDoneStep(accent);
      default:
        return _buildLoginForm(auth, accent);
    }
  }

  // ─── LOGIN FORM ────────────────────────────────────────────
  Widget _buildLoginForm(AuthProvider auth, Color accent) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (auth.error != null) ...[
            _errorBanner(auth.error!),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _usernameCtrl,
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
            decoration: _inputDeco('Username or Email', Icons.person_outline),
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passwordCtrl,
            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
            obscureText: _obscurePassword,
            decoration: _inputDeco('Password', Icons.lock_outline).copyWith(
              suffixIcon: IconButton(
                icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: const Color(0xFF94A3B8)),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 24),
          _primaryButton('Sign In', auth.loading, _submit, accent),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() {
                _mode = 'forgotEmail';
                _resetError = null;
                _resetMessage = null;
              }),
              style: TextButton.styleFrom(
                  padding: EdgeInsets.zero, minimumSize: const Size(0, 30)),
              child: const Text('Forgot password?',
                  style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF0D9488),
                      fontWeight: FontWeight.w500)),
            ),
          ),
        ],
      ),
    );
  }

  // ─── FORGOT: EMAIL STEP ────────────────────────────────────
  Widget _buildForgotEmailStep(Color accent) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_resetError != null) ...[
          _errorBanner(_resetError!),
          const SizedBox(height: 12)
        ],
        TextFormField(
          controller: _usernameCtrl,
          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
          decoration: _inputDeco('Work Email', Icons.email_outlined),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 16),
        _primaryButton('Send Reset Code', _resetLoading, _sendOtp, accent),
        const SizedBox(height: 8),
        _backLink(),
      ],
    );
  }

  // ─── FORGOT: OTP + NEW PASSWORD STEP ───────────────────────
  Widget _buildForgotOtpStep(Color accent) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_resetMessage != null) _successBanner(_resetMessage!),
        if (_resetError != null) ...[
          _errorBanner(_resetError!),
          const SizedBox(height: 12)
        ],
        const SizedBox(height: 8),
        TextFormField(
          controller: _otpCtrl,
          style: const TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 20,
              letterSpacing: 8,
              fontWeight: FontWeight.bold),
          decoration: _inputDeco('6-digit code', Icons.pin_outlined),
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _newPassCtrl,
          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
          obscureText: _obscureNew,
          decoration: _inputDeco('New Password', Icons.lock_outline).copyWith(
            suffixIcon: IconButton(
              icon: Icon(
                  _obscureNew
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: const Color(0xFF94A3B8)),
              onPressed: () => setState(() => _obscureNew = !_obscureNew),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _confirmPassCtrl,
          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
          obscureText: _obscureNew,
          decoration: _inputDeco('Confirm Password', Icons.lock_outline),
        ),
        const SizedBox(height: 16),
        _primaryButton('Reset Password', _resetLoading, _resetPassword, accent),
        const SizedBox(height: 8),
        _backLink(),
      ],
    );
  }

  // ─── FORGOT: DONE STEP ─────────────────────────────────────
  Widget _buildForgotDoneStep(Color accent) {
    return Column(
      children: [
        const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 52),
        const SizedBox(height: 12),
        const Text('Your password has been reset.',
            style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
        const SizedBox(height: 20),
        _primaryButton('Back to Sign In', false, _backToLogin, accent),
      ],
    );
  }

  // ─── SHARED WIDGETS ────────────────────────────────────────
  Widget _primaryButton(
      String label, bool loading, VoidCallback onPressed, Color accent) {
    return SizedBox(
      height: 48,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: 0,
        ),
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : Text(label,
                style:
                    const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _backLink() {
    return TextButton(
      onPressed: _backToLogin,
      child: const Text('← Back to Sign In',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
    );
  }

  Widget _errorBanner(String msg) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFFECACA))),
      child: Row(children: [
        const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 16),
        const SizedBox(width: 8),
        Expanded(
            child: Text(msg,
                style:
                    const TextStyle(color: Color(0xFFDC2626), fontSize: 12))),
      ]),
    );
  }

  Widget _successBanner(String msg) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(8)),
      child: Text(msg,
          style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12)),
    );
  }

  InputDecoration _inputDeco(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 2)),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
      hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
    );
  }
}
