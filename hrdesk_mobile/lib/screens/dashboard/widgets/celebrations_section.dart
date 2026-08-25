import 'package:flutter/material.dart';
import '../../../models/dashboard_model.dart';
import '../../../widgets/employee_avatar.dart';

class CelebrationsSection extends StatelessWidget {
  final List<CelebrationModel> celebrations;
  final bool isDark;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;

  const CelebrationsSection({
    super.key,
    required this.celebrations,
    required this.isDark,
    required this.cardBg,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
  });

  void _showCelebrationDetail(BuildContext context, CelebrationModel c) {
    final isBday = c.isBirthday;
    final isNewJoiner = c.type.toLowerCase().contains('joiner');
    final icon = isBday
        ? Icons.cake_rounded
        : (isNewJoiner ? Icons.waving_hand_rounded : Icons.workspace_premium_rounded);
    final themeColor = isBday
        ? const Color(0xFFF43F5E)
        : (isNewJoiner ? const Color(0xFF0D9488) : const Color(0xFFF59E0B));
    final title = isBday
        ? (c.isToday ? 'Happy Birthday! 🎂' : 'Upcoming Birthday (Day ${c.day})')
        : (isNewJoiner ? 'Welcome to the Team! 👋' : '${c.years ?? 1}-Year Work Anniversary! 🎉');

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: cardBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 18),
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [
                        themeColor,
                        themeColor.withValues(alpha: 0.5),
                      ],
                    ),
                  ),
                  child: EmployeeAvatar(
                    employeeId: c.employeeId,
                    name: c.employeeName,
                    radius: 32,
                  ),
                ),
                Positioned(
                  bottom: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: themeColor,
                      shape: BoxShape.circle,
                      border: Border.all(color: cardBg, width: 2),
                    ),
                    child: Icon(icon, color: Colors.white, size: 14),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              c.employeeName,
              style: TextStyle(color: textPrimary, fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 2),
            Text(
              '${c.department} • Team Member',
              style: TextStyle(color: textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: themeColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: themeColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: themeColor, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: TextStyle(color: themeColor, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Title Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(Icons.celebration_rounded, color: Color(0xFFF59E0B), size: 18),
                const SizedBox(width: 8),
                Text(
                  'Celebrations & Milestones',
                  style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            if (celebrations.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                ),
                child: Text(
                  '${celebrations.length} This Month',
                  style: const TextStyle(color: Color(0xFFD97706), fontSize: 10.5, fontWeight: FontWeight.bold),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),

        // Horizontal Story/Round Scroll Layout
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
            height: 106,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: celebrations.length,
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (ctx, i) {
                final c = celebrations[i];
                final isBday = c.isBirthday;
                final isNewJoiner = c.type.toLowerCase().contains('joiner');
                final icon = isBday
                    ? Icons.cake_rounded
                    : (isNewJoiner ? Icons.waving_hand_rounded : Icons.workspace_premium_rounded);
                final themeColor = isBday
                    ? const Color(0xFFF43F5E)
                    : (isNewJoiner ? const Color(0xFF0D9488) : const Color(0xFFF59E0B));
                final label = isBday
                    ? (c.isToday ? 'Today! 🎂' : '${c.day}th 🎂')
                    : (isNewJoiner ? 'New 👋' : '${c.years ?? 1}Y 🎉');
                final firstName = c.employeeName.split(' ').first;

                return InkWell(
                  onTap: () => _showCelebrationDetail(context, c),
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 68,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Circular Avatar with Celebratory Ring & Icon Badge
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(2.5),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: [
                                    themeColor,
                                    themeColor.withValues(alpha: 0.5),
                                  ],
                                ),
                              ),
                              child: EmployeeAvatar(
                                employeeId: c.employeeId,
                                name: c.employeeName,
                                radius: 24,
                              ),
                            ),
                            // Mini Floating Milestone Badge
                            Positioned(
                              bottom: -2,
                              right: -2,
                              child: Container(
                                padding: const EdgeInsets.all(3),
                                decoration: BoxDecoration(
                                  color: themeColor,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: cardBg, width: 1.5),
                                ),
                                child: Icon(icon, color: Colors.white, size: 10),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // First Name
                        Text(
                          firstName,
                          style: TextStyle(
                            color: textPrimary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 2),
                        // Milestone Chip
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: themeColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            label,
                            style: TextStyle(
                              color: themeColor,
                              fontSize: 8.5,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
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
}
