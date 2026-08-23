import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';
import 'face_punch_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _locationPunching = false;
  String? _statusMessage;
  bool? _lastPunchSuccess;

  @override
  void initState() {
    super.initState();
    // Load today's clock in/out state so the toggle button shows the right action.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PunchProvider>().fetchTodayStatus();
    });
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Standard punch (non-face employees: GPS only)
  Future<void> _standardPunch(String punchType) async {
    final user = context.read<AuthProvider>().user;
    if (user?.employeeId == null) {
      setState(() {
        _statusMessage =
            'No employee profile linked to this account. Please contact HR.';
        _lastPunchSuccess = false;
      });
      return;
    }

    setState(() {
      _locationPunching = true;
      _statusMessage = null;
      _lastPunchSuccess = null;
    });

    double? lat, lng;
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (serviceEnabled) {
        LocationPermission perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) {
          perm = await Geolocator.requestPermission();
        }
        if (perm != LocationPermission.denied &&
            perm != LocationPermission.deniedForever) {
          final pos = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.medium,
              timeLimit: Duration(seconds: 15),
            ),
          );
          lat = pos.latitude;
          lng = pos.longitude;
        }
      }
    } catch (_) {
      // GPS optional for non-geo employees
    }

    final punchProvider = context.read<PunchProvider>();
    final success = await punchProvider.punch(
      employeeId: user!.employeeId!,
      punchType: punchType,
      latitude: lat,
      longitude: lng,
    );

    if (!mounted) return;
    setState(() {
      _locationPunching = false;
      _statusMessage = punchProvider.message;
      _lastPunchSuccess = success;
    });
  }

  // Navigate to face punch screen
  Future<void> _facePunch(String punchType) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => FacePunchScreen(punchType: punchType),
      ),
    );

    if (result == true && mounted) {
      setState(() {
        _statusMessage = context.read<PunchProvider>().message;
        _lastPunchSuccess = true;
      });
    }
  }

  void _handlePunch(String punchType) {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;

    if (user.requiresFace) {
      _facePunch(punchType);
    } else {
      _standardPunch(punchType);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final punch = context.watch<PunchProvider>();
    final user = auth.user;
    if (user == null) return const SizedBox();

    const accent = Color(0xFF0D9488);
    final now = DateTime.now();
    final dateStr = DateFormat('EEEE, MMMM d').format(now);
    final timeStr = DateFormat('hh:mm a').format(now);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.business, color: Colors.white, size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'HRDesk',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined, color: Color(0xFF64748B)),
            onPressed: () async {
              await auth.logout();
              if (mounted) {
                Navigator.of(context).pushReplacementNamed('/login');
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Greeting
            Text(
              '$_greeting, ${user.fullName?.split(' ').first ?? user.username}',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              dateStr,
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            const SizedBox(height: 24),

            // Clock card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0D9488), Color(0xFF0F766E)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: accent.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Text(
                    timeStr,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.location_on,
                          color: Colors.white70, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        user.attendanceType ?? 'Standard',
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                  if (user.requiresFace) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.face_retouching_natural,
                              color: Colors.white, size: 14),
                          SizedBox(width: 4),
                          Text('Face Verification Required',
                              style:
                                  TextStyle(color: Colors.white, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Status message
            if (_statusMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: (_lastPunchSuccess ?? false)
                      ? const Color(0xFFF0FDF4)
                      : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: (_lastPunchSuccess ?? false)
                        ? const Color(0xFFBBF7D0)
                        : const Color(0xFFFECACA),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      (_lastPunchSuccess ?? false)
                          ? Icons.check_circle_outline
                          : Icons.error_outline,
                      color: (_lastPunchSuccess ?? false)
                          ? const Color(0xFF059669)
                          : const Color(0xFFDC2626),
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _statusMessage!,
                        style: TextStyle(
                          color: (_lastPunchSuccess ?? false)
                              ? const Color(0xFF065F46)
                              : const Color(0xFF991B1B),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Single toggle punch button: shows "Clock Out" while clocked in,
            // otherwise "Clock In". State comes from the server (today-status / punch response).
            SizedBox(
              width: double.infinity,
              child: _PunchButton(
                label: punch.isClockedIn ? 'Clock Out' : 'Clock In',
                icon: punch.isClockedIn ? Icons.logout : Icons.login,
                color: punch.isClockedIn
                    ? const Color(0xFFDC2626)
                    : const Color(0xFF059669),
                loading: _locationPunching || punch.state == PunchState.loading,
                onTap: () => _handlePunch(punch.isClockedIn ? 'out' : 'in'),
              ),
            ),
            const SizedBox(height: 24),

            // Employee info card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'My Profile',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    icon: Icons.badge_outlined,
                    label: 'Employee ID',
                    value: user.employeeCode ?? '#${user.employeeId}',
                  ),
                  _InfoRow(
                    icon: Icons.person_outline,
                    label: 'Role',
                    value: user.role ?? '—',
                  ),
                  _InfoRow(
                    icon: Icons.fingerprint,
                    label: 'Attendance Type',
                    value: user.attendanceType ?? 'Standard',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PunchButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool loading;
  final VoidCallback onTap;

  const _PunchButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        height: 80,
        decoration: BoxDecoration(
          color: loading ? color.withOpacity(0.5) : color,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: loading
            ? const Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                ),
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: Colors.white, size: 24),
                  const SizedBox(height: 4),
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF94A3B8)),
          const SizedBox(width: 10),
          Text(
            '$label: ',
            style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
