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

  @override
  Widget build(BuildContext context) {
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
