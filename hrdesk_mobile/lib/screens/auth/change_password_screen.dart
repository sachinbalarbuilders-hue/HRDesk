import 'package:flutter/material.dart';
import '../../core/api_client.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _loading = false;
  String? _error;
  String? _success;
  bool _obscureCurrent = true;
  bool _obscureNew = true;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _error = null; _success = null; });

    if (_currentCtrl.text.isEmpty) { setState(() => _error = 'Current password is required.'); return; }
    if (_newCtrl.text.length < 6) { setState(() => _error = 'New password must be at least 6 characters.'); return; }
    if (_newCtrl.text != _confirmCtrl.text) { setState(() => _error = 'Passwords do not match.'); return; }
    if (_currentCtrl.text == _newCtrl.text) { setState(() => _error = 'New password must be different.'); return; }

    setState(() => _loading = true);
    try {
      final res = await ApiClient().dio.post('/auth/change-password', data: {
        'currentPassword': _currentCtrl.text,
        'newPassword': _newCtrl.text,
      });
      setState(() {
        _success = res.data['message'] ?? 'Password changed successfully.';
        _currentCtrl.clear();
        _newCtrl.clear();
        _confirmCtrl.clear();
      });
    } catch (e) {
      try {
        final data = (e as dynamic).response?.data;
        setState(() => _error = (data is Map && data['message'] != null) ? data['message'] : 'Failed to change password.');
      } catch (_) {
        setState(() => _error = 'Failed to change password.');
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Change Password', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: textPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderCol),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Update your password', style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text('You\'ll need your current password to make changes.', style: TextStyle(color: textSecondary, fontSize: 12)),
              const SizedBox(height: 20),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                  child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12)),
                ),
                const SizedBox(height: 12),
              ],
              if (_success != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(8)),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_success!, style: const TextStyle(color: Color(0xFF16A34A), fontSize: 12))),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Current Password
              TextFormField(
                controller: _currentCtrl,
                obscureText: _obscureCurrent,
                style: TextStyle(color: textPrimary, fontSize: 14),
                decoration: _inputDeco('Current Password', Icons.lock_outline, borderCol).copyWith(
                  suffixIcon: IconButton(
                    icon: Icon(_obscureCurrent ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: textSecondary, size: 20),
                    onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // New Password
              TextFormField(
                controller: _newCtrl,
                obscureText: _obscureNew,
                style: TextStyle(color: textPrimary, fontSize: 14),
                decoration: _inputDeco('New Password', Icons.lock_outline, borderCol).copyWith(
                  suffixIcon: IconButton(
                    icon: Icon(_obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: textSecondary, size: 20),
                    onPressed: () => setState(() => _obscureNew = !_obscureNew),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Confirm
              TextFormField(
                controller: _confirmCtrl,
                obscureText: _obscureNew,
                style: TextStyle(color: textPrimary, fontSize: 14),
                decoration: _inputDeco('Confirm New Password', Icons.lock_outline, borderCol),
              ),
              const SizedBox(height: 20),

              SizedBox(
                height: 44,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: _loading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Update Password', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String label, IconData icon, Color borderCol) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderCol)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: borderCol)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFF0D9488), width: 2)),
      filled: true,
      fillColor: Colors.transparent,
      labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
    );
  }
}
