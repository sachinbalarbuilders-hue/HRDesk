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
            _statusMessage = 'Clock-$punchType successful with Face ID verification.';
            _lastPunchSuccess = true;
          });
        }
      }
      return;
    }

    if (user.requiresLocation) {
      setState(() {
        _locationPunching = true;
        _statusMessage = 'Fetching precise GPS coordinates...';
      });

      try {
        final loc = await LocationService().getFreshPosition();
        if (loc == null) {
          setState(() {
            _locationPunching = false;
            _statusMessage = 'Location required. Please enable high-accuracy GPS.';
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

    const accent = Color(0xFF0D9488);

    if (user == null) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(
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

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: RefreshIndicator(
        color: accent,
        backgroundColor: const Color(0xFF1E293B),
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
              // 1. Greeting Header with Avatar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      EmployeeAvatar(
                        employeeId: user.employeeId,
                        name: user.fullName ?? user.username,
                        radius: 22,
                        backgroundColor: const Color(0xFF0D9488).withValues(alpha: 0.25),
                        textColor: const Color(0xFF0D9488),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$_greeting,',
                            style: const TextStyle(fontSize: 13, color: Colors.white60),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            user.fullName?.split(' ').first ?? user.username,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
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
                style: const TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 16),

              // 2. Hero Live Circular Timer & Punch Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
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
                    const SizedBox(height: 18),

                    // Circular Progress Dial
                    SizedBox(
                      width: 180,
                      height: 180,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          CustomPaint(
                            size: const Size(180, 180),
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
                                  fontSize: 24,
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
                    const SizedBox(height: 20),

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
              const SizedBox(height: 14),

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
                const SizedBox(height: 14),
              ],

              // Clock In / Out Toggle Button
              if (!user.isBiometricOnly) ...[
                SizedBox(
                  width: double.infinity,
                  height: 52,
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
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
                const SizedBox(height: 18),
              ],

              // 3. 📢 Announcements & Notice Section
              _buildAnnouncementsSection(dashProvider.announcements),
              const SizedBox(height: 18),

              // 4. 👥 My Team Section (Present Today / Attendance Matrix)
              _buildMyTeamSection(
                dashProvider.myTeam,
                dashProvider.teamPresentCount,
                dashProvider.teamTotalCount,
              ),
              const SizedBox(height: 18),

              // 5. 🎉 Celebrations & Milestones (Birthdays & Anniversaries)
              _buildCelebrationsSection(dashProvider.celebrations),
              const SizedBox(height: 18),

              // 6. Shift & Work Snapshot
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
                      'Shift & Work Snapshot',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildSnapshotRow(Icons.schedule, 'Shift Timing', '${punch.shiftName} (${punch.shiftStart} - ${punch.shiftEnd})'),
                    _buildSnapshotRow(Icons.how_to_reg_outlined, 'Attendance Mode', user.locationPolicyDescription),
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

  // 📢 Announcements Component
  Widget _buildAnnouncementsSection(List<AnnouncementModel> announcements) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.campaign_outlined, color: Color(0xFF38BDF8), size: 20),
            SizedBox(width: 8),
            Text(
              'Company Announcements',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (announcements.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Row(
              children: [
                Icon(Icons.campaign_outlined, color: Color(0xFF38BDF8), size: 24),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'All Caught Up',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'No active company notices or upcoming holiday announcements.',
                        style: TextStyle(color: Colors.white38, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 110,
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
                    gradient: LinearGradient(
                      colors: isHoliday
                          ? [const Color(0xFF064E3B), const Color(0xFF0F172A)]
                          : [const Color(0xFF1E293B), const Color(0xFF0F172A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isHoliday ? const Color(0xFF10B981).withValues(alpha: 0.4) : Colors.white12,
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
                                  ? const Color(0xFF10B981).withValues(alpha: 0.2)
                                  : const Color(0xFF38BDF8).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              a.category.toUpperCase(),
                              style: TextStyle(
                                color: isHoliday ? const Color(0xFF34D399) : const Color(0xFF38BDF8),
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(
                            a.date,
                            style: const TextStyle(color: Colors.white38, fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        a.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        a.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white60, fontSize: 11),
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
  Widget _buildMyTeamSection(List<TeamMemberTodayModel> team, int presentCount, int totalCount) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.groups_outlined, color: Color(0xFF0D9488), size: 20),
                SizedBox(width: 8),
                Text(
                  'My Team Today',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
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
                  style: const TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (team.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Center(
              child: Text(
                'No team members active under this branch.',
                style: TextStyle(color: Colors.white38, fontSize: 12),
              ),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: math.min(team.length, 6),
              separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
              itemBuilder: (ctx, i) {
                final m = team[i];
                final isPresent = m.isPresent;
                final isOnLeave = m.isOnLeave;

                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  leading: EmployeeAvatar(
                    employeeId: m.employeeId,
                    name: m.employeeName,
                    radius: 20,
                  ),
                  title: Text(
                    m.employeeName,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  subtitle: Text(
                    '${m.designation} • ${m.department}',
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isPresent
                          ? const Color(0xFF059669).withValues(alpha: 0.2)
                          : isOnLeave
                              ? Colors.purple.withValues(alpha: 0.2)
                              : Colors.white.withValues(alpha: 0.08),
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
                                ? const Color(0xFF34D399)
                                : isOnLeave
                                    ? Colors.purpleAccent
                                    : Colors.white38,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          m.inTime != null ? m.inTime! : (isOnLeave ? 'On Leave' : 'Not In'),
                          style: TextStyle(
                            color: isPresent
                                ? const Color(0xFF34D399)
                                : isOnLeave
                                    ? Colors.purpleAccent
                                    : Colors.white54,
                            fontSize: 11,
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
  Widget _buildCelebrationsSection(List<CelebrationModel> celebrations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.celebration, color: Colors.amberAccent, size: 20),
            SizedBox(width: 8),
            Text(
              'Celebrations & Milestones',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (celebrations.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: const Row(
              children: [
                Icon(Icons.cake_outlined, color: Colors.pinkAccent, size: 24),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'No Milestones This Month',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'No upcoming birthdays or work anniversaries in the near schedule.',
                        style: TextStyle(color: Colors.white38, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 90,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: celebrations.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (ctx, i) {
                final c = celebrations[i];
                final isBday = c.isBirthday;
                final isNewJoiner = c.type.toLowerCase().contains('joiner');
                final icon = isBday
                    ? Icons.cake
                    : (isNewJoiner ? Icons.waving_hand : Icons.workspace_premium);
                final iconColor = isBday
                    ? Colors.pinkAccent
                    : (isNewJoiner ? const Color(0xFF2DD4BF) : Colors.amberAccent);
                final label = isBday
                    ? (c.isToday ? 'Birthday Today! 🎂' : 'Birthday on ${c.day}th')
                    : (isNewJoiner ? 'New Joiner! 👋' : '${c.years ?? 1} Yrs Anniversary 🎉');

                return Container(
                  width: 240,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: c.isToday ? Colors.amberAccent.withValues(alpha: 0.5) : Colors.white10,
                    ),
                  ),
                  child: Row(
                    children: [
                      EmployeeAvatar(
                        employeeId: c.employeeId,
                        name: c.employeeName,
                        radius: 20,
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
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              c.department,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white38, fontSize: 10),
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
