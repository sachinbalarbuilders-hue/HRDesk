import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/user_model.dart';
import '../../../widgets/employee_avatar.dart';

class DashboardHeader extends StatelessWidget {
  final UserModel user;
  final DateTime currentTime;
  final bool isDark;
  final Color textPrimary;
  final Color textSecondary;
  final Color accent;

  const DashboardHeader({
    super.key,
    required this.user,
    required this.currentTime,
    required this.isDark,
    required this.textPrimary,
    required this.textSecondary,
    this.accent = const Color(0xFF0D9488),
  });

  String get _greeting {
    final hour = currentTime.hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat('EEEE, dd MMMM yyyy').format(currentTime);

    return Container(
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
                  backgroundColor: accent.withValues(alpha: 0.25),
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
                  color: accent,
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
    );
  }
}
