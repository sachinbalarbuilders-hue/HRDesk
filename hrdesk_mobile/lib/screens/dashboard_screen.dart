import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';
import '../providers/branch_provider.dart';
import '../providers/dashboard_provider.dart';
import '../models/dashboard_model.dart';
import 'face_punch_screen.dart';
import '../widgets/employee_avatar.dart';
import 'leaves/apply_leave_sheet.dart';
import 'regularization/apply_regularization_dialog.dart';

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
      context.read<BranchProvider>().fetchCompaniesAndBranches();
      context.read<DashboardProvider>().fetchDashboardOverview();
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
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  Future<void> _handlePunch(String punchType) async {
    final auth = context.read<AuthProvider>();
    final punch = context.read<PunchProvider>();
    final user = auth.user;

    if (user == null) return;

    if (user.requiresFace) {
      final result = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => FacePunchScreen(punchType: punchType),
        ),
      );
      if (result == true) {
        punch.fetchTodayStatus();
        if (mounted) {
          context.read<DashboardProvider>().fetchDashboardOverview();
          setState(() {
            _statusMessage = 'Clock-$punchType verified & recorded with Face recognition.';
            _lastPunchSuccess = true;
          });
        }
      }
      return;
    }

    if (user.requiresLocation) {
      setState(() {
        _locationPunching = true;
        _statusMessage = 'Verifying GPS location...';
      });

      try {
        final loc = await LocationService().getFreshPosition();
        if (loc == null) {
          setState(() {
            _locationPunching = false;
            _statusMessage = 'Location required. Please enable GPS permissions.';
            _lastPunchSuccess = false;
          });
          return;
        }

        final success = await punch.punch(
          employeeId: user.employeeId ?? user.id,
          punchType: punchType,
          latitude: loc.latitude,
          longitude: loc.longitude,
        );

        if (mounted) {
          context.read<DashboardProvider>().fetchDashboardOverview();
          setState(() {
            _locationPunching = false;
            _statusMessage = success
                ? 'Clock-$punchType recorded at (${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)})'
                : (punch.message ?? 'Clock-$punchType failed.');
            _lastPunchSuccess = success;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _locationPunching = false;
            _statusMessage = 'GPS Error: $e';
            _lastPunchSuccess = false;
          });
        }
      }
      return;
    }

    final success = await punch.punch(
      employeeId: user.employeeId ?? user.id,
      punchType: punchType,
    );

    if (mounted) {
      context.read<DashboardProvider>().fetchDashboardOverview();
      setState(() {
        _statusMessage = success
            ? 'Clock-$punchType recorded successfully.'
            : (punch.message ?? 'Clock-$punchType failed.');
        _lastPunchSuccess = success;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final punch = context.watch<PunchProvider>();
    final dashProvider = context.watch<DashboardProvider>();
    final user = auth.user;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    const accent = Color(0xFF0D9488);

    if (user == null) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: const Center(
          child: CircularProgressIndicator(color: accent),
        ),
      );
    }

    final isClockedIn = punch.isClockedIn;
    final inTime = punch.inTime;
    final outTime = punch.outTime;

    final elapsed = _getElapsedWorkDuration(inTime, outTime, isClockedIn);
    final targetShiftSeconds = punch.targetHours > 0 ? (punch.targetHours * 3600).toInt() : 8 * 3600;
    final progress = (elapsed.inSeconds / targetShiftSeconds).clamp(0.0, 1.0);
    final progressPercent = (progress * 100).toInt();

    final dateStr = DateFormat('EEEE, dd MMMM yyyy').format(_currentTime);
    final timeStr = DateFormat('hh:mm').format(_currentTime);
    final periodStr = DateFormat('a').format(_currentTime);
    final secondsStr = DateFormat('ss').format(_currentTime);

    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final cardBorder = isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: RefreshIndicator(
        color: accent,
        backgroundColor: cardBg,
        onRefresh: () async {
          await Future.wait([
            auth.tryAutoLogin(),
            punch.fetchTodayStatus(),
            context.read<DashboardProvider>().fetchDashboardOverview(),
          ]);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Header Profile & Status Row
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: accent.withValues(alpha: 0.6), width: 1.5),
                          ),
                          child: EmployeeAvatar(
                            employeeId: user.employeeId,
                            name: user.fullName ?? user.username,
                            radius: 24,
                            backgroundColor: const Color(0xFF0D9488).withValues(alpha: 0.25),
                            textColor: const Color(0xFF2DD4BF),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$_greeting,',
                              style: TextStyle(fontSize: 12, color: textSecondary, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user.fullName?.split(' ').first ?? user.username,
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: textPrimary,
                                letterSpacing: -0.5,
                              ),
                            ),
                            Text(
                              dateStr,
                              style: TextStyle(color: textSecondary, fontSize: 11, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B).withValues(alpha: 0.8) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: accent.withValues(alpha: 0.3)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
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
                            color: const Color(0xFF0D9488),
                            size: 14,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            user.attendanceType ?? 'Standard',
                            style: TextStyle(
                              color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF1E293B),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 2. Modern Enterprise Hero Attendance Card
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: isDark
                      ? const LinearGradient(
                          colors: [
                            Color(0xFF1E293B),
                            Color(0xFF131D31),
                            Color(0xFF0F172A),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : const LinearGradient(
                          colors: [
                            Color(0xFFFFFFFF),
                            Color(0xFFF8FAFC),
                            Color(0xFFF1F5F9),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: isClockedIn
                        ? const Color(0xFF0D9488).withValues(alpha: 0.5)
                        : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isClockedIn
                          ? const Color(0xFF0D9488).withValues(alpha: isDark ? 0.2 : 0.15)
                          : Colors.black.withValues(alpha: isDark ? 0.4 : 0.06),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      // Shift Header & Live Status Row (Fixed with Expanded to prevent text collision)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0D9488).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.schedule_rounded, color: Color(0xFF0D9488), size: 14),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    '${punch.shiftName} (${punch.shiftStart} - ${punch.shiftEnd})',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: textSecondary,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: isClockedIn
                                  ? const Color(0xFF059669).withValues(alpha: 0.18)
                                  : (inTime != null && outTime != null)
                                      ? const Color(0xFF2563EB).withValues(alpha: 0.18)
                                      : const Color(0xFFF59E0B).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isClockedIn
                                    ? const Color(0xFF10B981)
                                    : (inTime != null && outTime != null)
                                        ? const Color(0xFF60A5FA)
                                        : const Color(0xFFF59E0B),
                                width: 0.8,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isClockedIn
                                        ? const Color(0xFF10B981)
                                        : (inTime != null && outTime != null)
                                            ? const Color(0xFF3B82F6)
                                            : const Color(0xFFF59E0B),
                                    boxShadow: [
                                      if (isClockedIn)
                                        BoxShadow(
                                          color: const Color(0xFF10B981).withValues(alpha: 0.8),
                                          blurRadius: 6,
                                          spreadRadius: 1,
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  isClockedIn
                                      ? 'ACTIVE'
                                      : (inTime != null && outTime != null)
                                          ? 'COMPLETED'
                                          : 'NOT CLOCKED IN',
                                  style: TextStyle(
                                    color: isClockedIn
                                        ? const Color(0xFF10B981)
                                        : (inTime != null && outTime != null)
                                            ? const Color(0xFF2563EB)
                                            : const Color(0xFFD97706),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // Clock & Live Shift Work Hours Display
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.7) : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text(
                                  timeStr,
                                  style: TextStyle(
                                    color: textPrimary,
                                    fontSize: 34,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -1,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  ':$secondsStr',
                                  style: TextStyle(
                                    color: textSecondary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  periodStr,
                                  style: const TextStyle(
                                    color: Color(0xFF0D9488),
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),

                            // Shift Work Duration Progress Bar
                            if (isClockedIn || (inTime != null && outTime != null)) ...[
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    isClockedIn
                                        ? 'Logged: ${_formatDuration(elapsed)}'
                                        : 'Total Logged: ${_formatDuration(elapsed)}',
                                    style: TextStyle(
                                      color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF334155),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    '$progressPercent% completed',
                                    style: TextStyle(
                                      color: isClockedIn ? const Color(0xFF0D9488) : textSecondary,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: LinearProgressIndicator(
                                  value: progress,
                                  minHeight: 7,
                                  backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    isClockedIn ? const Color(0xFF0D9488) : const Color(0xFF3B82F6),
                                  ),
                                ),
                              ),
                            ] else ...[
                              Text(
                                'Tap Clock In below to begin your shift',
                                style: TextStyle(color: textSecondary, fontSize: 11.5, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Punch In & Out Status Tiles Row
                      Row(
                        children: [
                          Expanded(
                            child: _buildModernPunchTile(
                              title: 'Clock In',
                              time: inTime ?? '— —',
                              icon: Icons.login_rounded,
                              iconColor: const Color(0xFF10B981),
                              statusBadge: punch.isLate
                                  ? '${punch.lateMinutes}m Late'
                                  : (inTime != null ? 'On Time' : 'Pending'),
                              isSuccess: inTime != null,
                              isLate: punch.isLate,
                              isDark: isDark,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildModernPunchTile(
                              title: 'Clock Out',
                              time: outTime ?? (isClockedIn ? 'In Progress' : '— —'),
                              icon: Icons.logout_rounded,
                              iconColor: const Color(0xFFEF4444),
                              statusBadge: outTime != null ? 'Completed' : (isClockedIn ? 'Active' : 'Pending'),
                              isSuccess: outTime != null,
                              isLate: false,
                              isDark: isDark,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Status Alert Message
                      if (_statusMessage != null) ...[
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: (_lastPunchSuccess ?? false)
                                ? const Color(0xFF059669).withValues(alpha: 0.15)
                                : const Color(0xFFDC2626).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: (_lastPunchSuccess ?? false)
                                  ? const Color(0xFF10B981).withValues(alpha: 0.4)
                                  : const Color(0xFFEF4444).withValues(alpha: 0.4),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                (_lastPunchSuccess ?? false) ? Icons.check_circle_outline : Icons.error_outline,
                                color: (_lastPunchSuccess ?? false) ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                size: 16,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _statusMessage!,
                                  style: TextStyle(
                                    color: (_lastPunchSuccess ?? false) ? const Color(0xFF10B981) : const Color(0xFFDC2626),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Primary Punch Action Button
                      if (!user.isBiometricOnly) ...[
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isClockedIn ? const Color(0xFFE11D48) : const Color(0xFF0D9488),
                              foregroundColor: Colors.white,
                              elevation: 4,
                              shadowColor: isClockedIn
                                  ? const Color(0xFFE11D48).withValues(alpha: 0.4)
                                  : const Color(0xFF0D9488).withValues(alpha: 0.4),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            onPressed: (_locationPunching || punch.state == PunchState.loading)
                                ? null
                                : () => _handlePunch(isClockedIn ? 'out' : 'in'),
                            child: (_locationPunching || punch.state == PunchState.loading)
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        user.requiresFace
                                            ? Icons.face_retouching_natural
                                            : (isClockedIn ? Icons.logout_rounded : Icons.login_rounded),
                                        size: 18,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        isClockedIn
                                            ? 'CLOCK OUT NOW'
                                            : (user.requiresFace ? 'CLOCK IN (FACE VERIFICATION)' : 'CLOCK IN NOW'),
                                        style: const TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // 3. ⚡ Quick Action Shortcuts Hub
              Text(
                'Quick Actions',
                style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionCard(
                      label: 'Apply Leave',
                      icon: Icons.beach_access_rounded,
                      iconColor: const Color(0xFF6366F1),
                      bgColor: const Color(0xFF6366F1).withValues(alpha: isDark ? 0.25 : 0.12),
                      cardBg: cardBg,
                      cardBorder: cardBorder,
                      textPrimary: textPrimary,
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => const ApplyLeaveSheet(),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickActionCard(
                      label: 'Regularize',
                      icon: Icons.edit_calendar_rounded,
                      iconColor: const Color(0xFFF59E0B),
                      bgColor: const Color(0xFFF59E0B).withValues(alpha: isDark ? 0.25 : 0.12),
                      cardBg: cardBg,
                      cardBorder: cardBorder,
                      textPrimary: textPrimary,
                      onTap: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => const ApplyRegularizationSheet(),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildQuickActionCard(
                      label: 'Punch History',
                      icon: Icons.history_rounded,
                      iconColor: const Color(0xFF10B981),
                      bgColor: const Color(0xFF10B981).withValues(alpha: isDark ? 0.25 : 0.12),
                      cardBg: cardBg,
                      cardBorder: cardBorder,
                      textPrimary: textPrimary,
                      onTap: () {
                        context.read<PunchProvider>().fetchTodayStatus();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // 4. 📢 Announcements & Notice Section
              _buildAnnouncementsSection(dashProvider.announcements, isDark, cardBg, cardBorder, textPrimary, textSecondary),
              const SizedBox(height: 20),

              // 5. 👥 My Team Section (Present Today / Attendance Matrix)
              _buildMyTeamSection(
                dashProvider.myTeam,
                dashProvider.teamPresentCount,
                dashProvider.teamTotalCount,
                isDark,
                cardBg,
                cardBorder,
                textPrimary,
                textSecondary,
              ),
              const SizedBox(height: 20),

              // 6. 🎉 Celebrations & Milestones (Birthdays & Anniversaries)
              _buildCelebrationsSection(dashProvider.celebrations, isDark, cardBg, cardBorder, textPrimary, textSecondary),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionCard({
    required String label,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required Color cardBg,
    required Color cardBorder,
    required Color textPrimary,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: cardBorder),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: bgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(color: textPrimary, fontSize: 11, fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildModernPunchTile({
    required String title,
    required String time,
    required IconData icon,
    required Color iconColor,
    required String statusBadge,
    required bool isSuccess,
    required bool isLate,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.8) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSuccess ? iconColor.withValues(alpha: 0.4) : (isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFE2E8F0)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Icon(icon, color: iconColor, size: 16),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            time,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF0F172A),
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: isLate
                  ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                  : (isSuccess
                      ? const Color(0xFF10B981).withValues(alpha: 0.15)
                      : (isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE2E8F0))),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              statusBadge,
              style: TextStyle(
                color: isLate
                    ? const Color(0xFFD97706)
                    : (isSuccess ? const Color(0xFF059669) : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 📢 Announcements Component
  Widget _buildAnnouncementsSection(
    List<AnnouncementModel> announcements,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.campaign_rounded, color: Color(0xFF0284C7), size: 18),
            const SizedBox(width: 8),
            Text(
              'Company Announcements',
              style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (announcements.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.campaign_outlined, color: Color(0xFF0284C7), size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'All Caught Up',
                        style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'No active company notices or upcoming holiday announcements.',
                        style: TextStyle(color: textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 115,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: announcements.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (ctx, i) {
                final a = announcements[i];
                final isHoliday = a.category.toLowerCase().contains('holiday');

                return Container(
                  width: 280,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isHoliday ? const Color(0xFF10B981).withValues(alpha: 0.5) : cardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isHoliday
                                  ? const Color(0xFF10B981).withValues(alpha: 0.15)
                                  : const Color(0xFF0284C7).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              a.category.toUpperCase(),
                              style: TextStyle(
                                color: isHoliday ? const Color(0xFF059669) : const Color(0xFF0284C7),
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(
                            a.date,
                            style: TextStyle(color: textSecondary, fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        a.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        a.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  // 👥 My Team Section
  Widget _buildMyTeamSection(
    List<TeamMemberTodayModel> team,
    int presentCount,
    int totalCount,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.groups_rounded, color: Color(0xFF0D9488), size: 18),
                const SizedBox(width: 8),
                Text(
                  'My Team Today',
                  style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            if (totalCount > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF059669).withValues(alpha: 0.3)),
                ),
                child: Text(
                  '$presentCount / $totalCount In Office',
                  style: const TextStyle(color: Color(0xFF059669), fontSize: 10.5, fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (team.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: Center(
              child: Text(
                'No team members active under this branch.',
                style: TextStyle(color: textSecondary, fontSize: 11.5),
              ),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: math.min(team.length, 6),
              separatorBuilder: (_, __) => Divider(color: cardBorder, height: 1),
              itemBuilder: (ctx, i) {
                final m = team[i];
                final isPresent = m.isPresent;
                final isOnLeave = m.isOnLeave;

                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                  leading: EmployeeAvatar(
                    employeeId: m.employeeId,
                    name: m.employeeName,
                    radius: 18,
                  ),
                  title: Text(
                    m.employeeName,
                    style: TextStyle(color: textPrimary, fontSize: 12.5, fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    '${m.designation} • ${m.department}',
                    style: TextStyle(color: textSecondary, fontSize: 10.5),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isPresent
                          ? const Color(0xFF059669).withValues(alpha: 0.15)
                          : isOnLeave
                              ? Colors.purple.withValues(alpha: 0.15)
                              : (isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFF1F5F9)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isPresent
                                ? const Color(0xFF10B981)
                                : isOnLeave
                                    ? Colors.purple
                                    : Colors.grey,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          m.inTime != null ? m.inTime! : (isOnLeave ? 'On Leave' : 'Not In'),
                          style: TextStyle(
                            color: isPresent
                                ? const Color(0xFF059669)
                                : isOnLeave
                                    ? Colors.purple
                                    : textSecondary,
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  // 🎉 Celebrations Component
  Widget _buildCelebrationsSection(
    List<CelebrationModel> celebrations,
    bool isDark,
    Color cardBg,
    Color cardBorder,
    Color textPrimary,
    Color textSecondary,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.celebration_rounded, color: Colors.amber, size: 18),
            const SizedBox(width: 8),
            Text(
              'Celebrations & Milestones',
              style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (celebrations.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.cake_outlined, color: Colors.pinkAccent, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'No Milestones This Month',
                        style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'No upcoming birthdays or work anniversaries in the near schedule.',
                        style: TextStyle(color: textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 85,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: celebrations.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (ctx, i) {
                final c = celebrations[i];
                final isBday = c.isBirthday;
                final isNewJoiner = c.type.toLowerCase().contains('joiner');
                final icon = isBday
                    ? Icons.cake_rounded
                    : (isNewJoiner ? Icons.waving_hand_rounded : Icons.workspace_premium_rounded);
                final iconColor = isBday
                    ? Colors.pinkAccent
                    : (isNewJoiner ? const Color(0xFF0D9488) : Colors.amber);
                final label = isBday
                    ? (c.isToday ? 'Birthday Today! 🎂' : 'Birthday on ${c.day}th')
                    : (isNewJoiner ? 'New Joiner! 👋' : '${c.years ?? 1} Yrs Anniversary 🎉');

                return Container(
                  width: 240,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: c.isToday ? Colors.amber.withValues(alpha: 0.6) : cardBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      EmployeeAvatar(
                        employeeId: c.employeeId,
                        name: c.employeeName,
                        radius: 18,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  icon,
                                  color: iconColor,
                                  size: 13,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: iconColor,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              c.employeeName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: textPrimary, fontSize: 12.5, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              c.department,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: textSecondary, fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

