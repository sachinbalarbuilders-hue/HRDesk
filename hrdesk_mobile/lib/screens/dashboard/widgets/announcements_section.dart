import 'package:flutter/material.dart';
import '../../../models/dashboard_model.dart';

class AnnouncementsSection extends StatelessWidget {
  final List<AnnouncementModel> announcements;
  final bool isDark;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;

  const AnnouncementsSection({
    super.key,
    required this.announcements,
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
}
