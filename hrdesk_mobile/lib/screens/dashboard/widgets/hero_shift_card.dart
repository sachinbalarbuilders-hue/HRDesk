import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/user_model.dart';
import '../../../providers/punch_provider.dart';

class HeroShiftCard extends StatelessWidget {
  final UserModel user;
  final PunchProvider punch;
  final DateTime currentTime;
  final bool locationPunching;
  final String? statusMessage;
  final bool? lastPunchSuccess;
  final bool isDark;
  final Color textPrimary;
  final Color textSecondary;
  final Color cardBorder;
  final VoidCallback onClockIn;
  final VoidCallback onClockOut;

  const HeroShiftCard({
    super.key,
    required this.user,
    required this.punch,
    required this.currentTime,
    required this.locationPunching,
    required this.statusMessage,
    required this.lastPunchSuccess,
    required this.isDark,
    required this.textPrimary,
    required this.textSecondary,
    required this.cardBorder,
    required this.onClockIn,
    required this.onClockOut,
  });

  Duration _getElapsedWorkDuration(String? inTimeStr, String? outTimeStr, bool isClockedIn) {
    if (inTimeStr == null || inTimeStr.isEmpty) return Duration.zero;

    try {
      final parts = inTimeStr.split(':');
      final inHour = int.parse(parts[0]);
      final inMinute = int.parse(parts[1]);
      final inSecond = parts.length > 2 ? int.parse(parts[2]) : 0;

      final inDateTime = DateTime(currentTime.year, currentTime.month, currentTime.day, inHour, inMinute, inSecond);

      if (isClockedIn) {
        final diff = currentTime.difference(inDateTime);
        return diff.isNegative ? Duration.zero : diff;
      } else if (outTimeStr != null && outTimeStr.isNotEmpty) {
        final outParts = outTimeStr.split(':');
        final outHour = int.parse(outParts[0]);
        final outMinute = int.parse(outParts[1]);
        final outSecond = outParts.length > 2 ? int.parse(outParts[2]) : 0;
        final outDateTime = DateTime(currentTime.year, currentTime.month, currentTime.day, outHour, outMinute, outSecond);
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

  @override
  Widget build(BuildContext context) {
    final isClockedIn = punch.isClockedIn;
    final inTime = punch.inTime;
    final outTime = punch.outTime;

    final elapsed = _getElapsedWorkDuration(inTime, outTime, isClockedIn);
    final targetShiftSeconds = punch.targetHours > 0 ? (punch.targetHours * 3600).toInt() : 8 * 3600;
    final progress = (elapsed.inSeconds / targetShiftSeconds).clamp(0.0, 1.0);
    final progressPercent = (progress * 100).toInt();

    final timeStr = DateFormat('hh:mm').format(currentTime);
    final periodStr = DateFormat('a').format(currentTime);
    final secondsStr = DateFormat('ss').format(currentTime);

    return Container(
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
            // Shift Header & Live Status Row
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
            if (statusMessage != null) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: (lastPunchSuccess ?? false)
                      ? const Color(0xFF059669).withValues(alpha: 0.15)
                      : const Color(0xFFDC2626).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: (lastPunchSuccess ?? false)
                        ? const Color(0xFF10B981).withValues(alpha: 0.4)
                        : const Color(0xFFEF4444).withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      (lastPunchSuccess ?? false) ? Icons.check_circle_outline : Icons.error_outline,
                      color: (lastPunchSuccess ?? false) ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        statusMessage!,
                        style: TextStyle(
                          color: (lastPunchSuccess ?? false) ? const Color(0xFF10B981) : const Color(0xFFDC2626),
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
                  onPressed: (locationPunching || punch.state == PunchState.loading)
                      ? null
                      : (isClockedIn ? onClockOut : onClockIn),
                  child: (locationPunching || punch.state == PunchState.loading)
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
}
