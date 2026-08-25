import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';
import '../providers/branch_provider.dart';
import '../providers/dashboard_provider.dart';
import 'package:intl/intl.dart';
import 'face_punch_screen.dart';
import 'attendance/day_activity_sheet.dart';
import 'dashboard/widgets/dashboard_header.dart';
import 'dashboard/widgets/hero_shift_card.dart';
import 'dashboard/widgets/quick_actions_grid.dart';
import 'dashboard/widgets/announcements_section.dart';
import 'dashboard/widgets/my_team_section.dart';
import 'dashboard/widgets/celebrations_section.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
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

  void _openPunchHistory() {
    final auth = context.read<AuthProvider>();
    final user = auth.user;
    if (user == null) return;

    final empId = user.employeeId ?? user.id;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DayActivitySheet(
        employeeId: empId,
        date: todayStr,
      ),
    );
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
              // 1. Header Profile & Attendance Mode Pill
              DashboardHeader(
                user: user,
                currentTime: _currentTime,
                isDark: isDark,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
                accent: accent,
              ),
              const SizedBox(height: 14),

              // 2. Hero Shift & Punch Action Card
              HeroShiftCard(
                user: user,
                punch: punch,
                currentTime: _currentTime,
                locationPunching: _locationPunching,
                statusMessage: _statusMessage,
                lastPunchSuccess: _lastPunchSuccess,
                isDark: isDark,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
                cardBorder: cardBorder,
                onClockIn: () => _handlePunch('in'),
                onClockOut: () => _handlePunch('out'),
              ),
              const SizedBox(height: 18),

              // 3. Quick Action Shortcuts Hub
              QuickActionsGrid(
                isDark: isDark,
                cardBg: cardBg,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
                onOpenHistory: _openPunchHistory,
              ),
              const SizedBox(height: 20),

              // 4. Company Announcements & Notices
              AnnouncementsSection(
                announcements: dashProvider.announcements,
                isDark: isDark,
                cardBg: cardBg,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
              ),
              const SizedBox(height: 20),

              // 5. My Team Section (Present Today & Searchable Drawer)
              MyTeamSection(
                team: dashProvider.myTeam,
                presentCount: dashProvider.teamPresentCount,
                totalCount: dashProvider.teamTotalCount,
                isDark: isDark,
                cardBg: cardBg,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
              ),
              const SizedBox(height: 20),

              // 6. Celebrations & Milestones (Birthdays & Anniversaries)
              CelebrationsSection(
                celebrations: dashProvider.celebrations,
                isDark: isDark,
                cardBg: cardBg,
                cardBorder: cardBorder,
                textPrimary: textPrimary,
                textSecondary: textSecondary,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
