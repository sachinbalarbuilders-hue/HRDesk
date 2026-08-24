import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';
import 'face_punch_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with SingleTickerProviderStateMixin {
  bool _locationPunching = false;
  String? _statusMessage;
  bool? _lastPunchSuccess;
  Timer? _tickerTimer;
  DateTime _currentTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    LocationService().warmUp();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().tryAutoLogin();
      context.read<PunchProvider>().fetchTodayStatus();
    });

    // 1-second ticker for live digital clock & live elapsed work shift timer
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    super.dispose();
  }

  String get _greeting {
    final hour = _currentTime.hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Calculate elapsed time from today's InTime string (e.g. "09:15" or "09:15:00")
  Duration _getElapsedWorkDuration(String? inTimeStr, String? outTimeStr, bool isClockedIn) {
    if (inTimeStr == null || inTimeStr.isEmpty) return Duration.zero;

    try {
      final parts = inTimeStr.split(':');
      final inHour = int.parse(parts[0]);
      final inMinute = int.parse(parts[1]);
      final inSecond = parts.length > 2 ? int.parse(parts[2]) : 0;

      final now = _currentTime;
      final inDateTime = DateTime(now.year, now.month, now.day, inHour, inMinute, inSecond);

      if (isClockedIn) {
        final diff = now.difference(inDateTime);
        return diff.isNegative ? Duration.zero : diff;
      } else if (outTimeStr != null && outTimeStr.isNotEmpty) {
        final outParts = outTimeStr.split(':');
        final outHour = int.parse(outParts[0]);
        final outMinute = int.parse(outParts[1]);
        final outSecond = outParts.length > 2 ? int.parse(outParts[2]) : 0;
        final outDateTime = DateTime(now.year, now.month, now.day, outHour, outMinute, outSecond);
        final diff = outDateTime.difference(inDateTime);
        return diff.isNegative ? Duration.zero : diff;
      }
    } catch (_) {}

    return Duration.zero;
  }

  String _formatDuration(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  // Standard punch (non-face employees: GPS only)
  Future<void> _standardPunch(String punchType) async {
    final user = context.read<AuthProvider>().user;
    if (user?.employeeId == null) {
      setState(() {
        _statusMessage = 'No employee profile linked to this account. Please contact HR.';
        _lastPunchSuccess = false;
      });
      return;
    }

    final employeeId = user!.employeeId!;
    final punchProvider = context.read<PunchProvider>();

    setState(() {
      _locationPunching = true;
      _statusMessage = null;
      _lastPunchSuccess = null;
    });

    double? lat, lng;
    try {
      final pos = await LocationService().getFreshPosition(
        timeout: const Duration(seconds: 4),
      );
      lat = pos?.latitude;
      lng = pos?.longitude;
    } catch (_) {
      // GPS optional for non-geo employees
    }

    final success = await punchProvider.punch(
      employeeId: employeeId,
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

    if (user.isBiometricOnly) {
      setState(() {
        _statusMessage = 'Mobile clock-in is disabled. Please punch via the office Biometric Machine.';
        _lastPunchSuccess = false;
      });
      return;
    }

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
    final dateStr = DateFormat('EEEE, MMMM d, yyyy').format(_currentTime);
    final isClockedIn = punch.isClockedIn;
    final inTime = punch.inTime;
    final outTime = punch.outTime;

    final elapsed = _getElapsedWorkDuration(inTime, outTime, isClockedIn);
    final shiftTargetSecs = (punch.targetHours * 3600).toInt();
    final standardShiftSeconds = shiftTargetSecs > 0 ? shiftTargetSecs : 9 * 3600;
    final progress = (elapsed.inSeconds / standardShiftSeconds).clamp(0.0, 1.0);
    final progressPercent = (progress * 100).toInt();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: RefreshIndicator(
        color: accent,
        onRefresh: () async {
          await Future.wait([
            auth.tryAutoLogin(),
            punch.fetchTodayStatus(),
          ]);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$_greeting,',
                        style: const TextStyle(fontSize: 14, color: Colors.white60),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.fullName?.split(' ').first ?? user.username,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          user.requiresFace
                              ? Icons.face_retouching_natural
                              : user.isGeoFencing
                                  ? Icons.location_on
                                  : user.isIpRestricted
                                      ? Icons.wifi
                                      : user.isBiometricOnly
                                          ? Icons.fingerprint
                                          : Icons.touch_app,
                          color: accent,
                          size: 14,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          user.attendanceType ?? 'Standard',
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                dateStr,
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              const SizedBox(height: 16),

              // Hero Live Circular Timer Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: isClockedIn ? accent.withValues(alpha: 0.4) : Colors.white10),
                  boxShadow: [
                    BoxShadow(
                      color: isClockedIn ? accent.withValues(alpha: 0.15) : Colors.black.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Status Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: isClockedIn
                            ? const Color(0xFF059669).withValues(alpha: 0.2)
                            : (inTime != null && outTime != null)
                                ? Colors.blueAccent.withValues(alpha: 0.2)
                                : Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isClockedIn
                              ? const Color(0xFF059669)
                              : (inTime != null && outTime != null)
                                  ? Colors.blueAccent
                                  : Colors.white24,
                          width: 0.8,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isClockedIn
                                  ? const Color(0xFF059669)
                                  : (inTime != null && outTime != null)
                                      ? Colors.blueAccent
                                      : Colors.white60,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isClockedIn
                                ? 'ACTIVE SHIFT'
                                : (inTime != null && outTime != null)
                                    ? 'SHIFT COMPLETED'
                                    : 'NOT CLOCKED IN',
                            style: TextStyle(
                              color: isClockedIn
                                  ? const Color(0xFF34D399)
                                  : (inTime != null && outTime != null)
                                      ? Colors.lightBlueAccent
                                      : Colors.white70,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Circular Progress Dial
                    SizedBox(
                      width: 190,
                      height: 190,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          CustomPaint(
                            size: const Size(190, 190),
                            painter: _ShiftProgressPainter(
                              progress: isClockedIn || (inTime != null && outTime != null) ? progress : 0.0,
                              isClockedIn: isClockedIn,
                            ),
                          ),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isClockedIn
                                    ? _formatDuration(elapsed)
                                    : DateFormat('hh:mm a').format(_currentTime),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isClockedIn
                                    ? '$progressPercent% of ${punch.shiftName}'
                                    : (inTime != null && outTime != null)
                                        ? 'Total: ${_formatDuration(elapsed)}'
                                        : '${punch.shiftName} (${punch.shiftStart} - ${punch.shiftEnd})',
                                style: const TextStyle(
                                  color: Colors.white60,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 22),

                    // In / Out Punch Tiles Row
                    Row(
                      children: [
                        Expanded(
                          child: _buildPunchTile(
                            title: 'Clock In',
                            time: inTime ?? '— —',
                            icon: Icons.login,
                            iconColor: const Color(0xFF059669),
                            subtext: punch.isLate ? '${punch.lateMinutes}m Late' : (inTime != null ? 'Recorded' : 'Pending'),
                            subtextColor: punch.isLate ? Colors.amberAccent : Colors.white60,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildPunchTile(
                            title: 'Clock Out',
                            time: outTime ?? (isClockedIn ? 'Active' : '— —'),
                            icon: Icons.logout,
                            iconColor: const Color(0xFFDC2626),
                            subtext: outTime != null ? 'Completed' : (isClockedIn ? 'In Progress' : 'Pending'),
                            subtextColor: isClockedIn ? const Color(0xFF34D399) : Colors.white60,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Status message
              if (_statusMessage != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: (_lastPunchSuccess ?? false)
                        ? const Color(0xFF059669).withValues(alpha: 0.15)
                        : const Color(0xFFDC2626).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: (_lastPunchSuccess ?? false)
                          ? const Color(0xFF059669).withValues(alpha: 0.4)
                          : const Color(0xFFDC2626).withValues(alpha: 0.4),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        (_lastPunchSuccess ?? false) ? Icons.check_circle : Icons.error_outline,
                        color: (_lastPunchSuccess ?? false) ? const Color(0xFF34D399) : const Color(0xFFF87171),
                        size: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: TextStyle(
                            color: (_lastPunchSuccess ?? false) ? const Color(0xFF34D399) : const Color(0xFFF87171),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Clock In / Out Toggle Button or Biometric Info
              if (user.isBiometricOnly) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: accent.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: accent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.fingerprint,
                          color: accent,
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Biometric Device Mode',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Your attendance is recorded via office Biometric hardware. Mobile clock-in is disabled.',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 11,
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isClockedIn ? const Color(0xFFDC2626) : const Color(0xFF0D9488),
                      elevation: 4,
                      shadowColor: isClockedIn ? const Color(0xFFDC2626).withValues(alpha: 0.4) : accent.withValues(alpha: 0.4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: (_locationPunching || punch.state == PunchState.loading)
                        ? null
                        : () => _handlePunch(isClockedIn ? 'out' : 'in'),
                    child: (_locationPunching || punch.state == PunchState.loading)
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(isClockedIn ? Icons.logout : Icons.login, color: Colors.white, size: 20),
                              const SizedBox(width: 10),
                              Text(
                                isClockedIn ? 'CLOCK OUT' : 'CLOCK IN',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
              const SizedBox(height: 20),

              // Shift & Employment Snapshot Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Shift & Work Details',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildSnapshotRow(Icons.schedule, 'Shift Timing', '${punch.shiftName} (${punch.shiftStart} - ${punch.shiftEnd})'),
                    _buildSnapshotRow(Icons.pin_drop_outlined, 'Location Policy', user.isGeoFencing ? 'Office Geofence (100m)' : 'Standard Office Branch'),
                    _buildSnapshotRow(Icons.badge_outlined, 'Employee Code', user.employeeCode ?? '#${user.employeeId ?? '-'}'),
                    _buildSnapshotRow(Icons.security, 'Role / Access', user.role ?? 'Employee'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPunchTile({
    required String title,
    required String time,
    required IconData icon,
    required Color iconColor,
    required String subtext,
    required Color subtextColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white60, fontSize: 11)),
                const SizedBox(height: 2),
                Text(
                  time,
                  style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 1),
                Text(
                  subtext,
                  style: TextStyle(color: subtextColor, fontSize: 10, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSnapshotRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 15, color: const Color(0xFF0D9488)),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(color: Colors.white60, fontSize: 12)),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftProgressPainter extends CustomPainter {
  final double progress;
  final bool isClockedIn;

  _ShiftProgressPainter({required this.progress, required this.isClockedIn});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 16) / 2;
    const strokeWidth = 10.0;

    // Background track
    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.08)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    canvas.drawCircle(center, radius, bgPaint);

    // Active progress arc
    if (progress > 0) {
      final sweepAngle = 2 * math.pi * progress;
      final progressPaint = Paint()
        ..shader = LinearGradient(
          colors: isClockedIn
              ? [const Color(0xFF0D9488), const Color(0xFF10B981)]
              : [const Color(0xFF3B82F6), const Color(0xFF60A5FA)],
        ).createShader(Rect.fromCircle(center: center, radius: radius))
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        -math.pi / 2,
        sweepAngle,
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ShiftProgressPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.isClockedIn != isClockedIn;
  }
}
