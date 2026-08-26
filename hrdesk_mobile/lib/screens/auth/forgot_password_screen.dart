import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();

  String _step = 'email'; // email | otp | done
  bool _loading = false;
  String? _error;
  String? _message;
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_emailCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please enter your email.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ApiClient().dio.post('/auth/forgot-password', data: {'email': _emailCtrl.text.trim()});
      setState(() {
        _message = res.data['message'] ?? 'Reset code sent.';
        _step = 'otp';
      });
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_otpCtrl.text.trim().isEmpty) { setState(() => _error = 'Enter the OTP code.'); return; }
    if (_newPassCtrl.text.length < 6) { setState(() => _error = 'Password must be at least 6 characters.'); return; }
    if (_newPassCtrl.text != _confirmPassCtrl.text) { setState(() => _error = 'Passwords do not match.'); return; }

    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient().dio.post('/auth/reset-password', data: {
        'email': _emailCtrl.text.trim(),
        'otp': _otpCtrl.text.trim(),
        'newPassword': _newPassCtrl.text,
      });
      setState(() => _step = 'done');
    } catch (e) {
      setState(() => _error = _parseError(e));
    } finally {
      setState(() => _loading = false);
    }
  }

  String _parseError(dynamic e) {
    try {
      final statusCode = (e as dynamic).response?.statusCode;
      if (statusCode == 429) return 'Too many attempts. Please wait and try again.';
      final data = (e as dynamic).response?.data;
      if (data is Map && data['message'] != null) return data['message'];
    } catch (_) {}
    return 'Something went wrong. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF0D9488);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                // Icon
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.lock_reset, color: Colors.white, size: 28),
                ),
                const SizedBox(height: 16),
                Text(
                  _step == 'done' ? 'Password Reset!' : 'Reset Password',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 6),
                Text(
                  _step == 'email' ? 'Enter your email to receive a reset code'
                      : _step == 'otp' ? 'Enter the code and set a new password'
                      : 'You can now sign in with your new password',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                // Card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                          child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (_message != null && _step == 'otp') ...[
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(8)),
                          child: Text(_message!, style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12)),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Step: Email
                      if (_step == 'email') ...[
                        TextFormField(
                          controller: _emailCtrl,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
                          decoration: _inputDeco('Work Email', Icons.email_outlined),
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 16),
                        _buildButton('Send Reset Code', _loading, _sendOtp),
                      ],

                      // Step: OTP + New Password
                      if (_step == 'otp') ...[
                        TextFormField(
                          controller: _otpCtrl,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 18, letterSpacing: 8, fontWeight: FontWeight.bold),
                          decoration: _inputDeco('6-digit code', Icons.pin_outlined),
                          keyboardType: TextInputType.number,
                          maxLength: 6,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _newPassCtrl,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
                          obscureText: _obscure,
                          decoration: _inputDeco('New Password', Icons.lock_outline).copyWith(
                            suffixIcon: IconButton(
                              icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF94A3B8)),
                              onPressed: () => setState(() => _obscure = !_obscure),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _confirmPassCtrl,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 15),
                          obscureText: _obscure,
                          decoration: _inputDeco('Confirm Password', Icons.lock_outline),
                        ),
                        const SizedBox(height: 16),
                        _buildButton('Reset Password', _loading, _resetPassword),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => setState(() { _step = 'email'; _error = null; }),
                          child: const Text('← Back to email', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ),
                      ],

                      // Step: Done
                      if (_step == 'done') ...[
                        const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 48),
                        const SizedBox(height: 12),
                        const Text('Your password has been reset successfully.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                        const SizedBox(height: 16),
                        _buildButton('Back to Sign In', false, () => Navigator.pop(context)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildButton(String label, bool loading, VoidCallback onPressed) {
    return SizedBox(
      height: 46,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF0D9488),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: 0,
        ),
        child: loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      ),
    );
  }

  InputDecoration _inputDeco(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF0D9488), width: 2)),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
    );
  }
}
