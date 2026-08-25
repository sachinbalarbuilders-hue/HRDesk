import 'package:flutter/material.dart';
import '../../leaves/apply_leave_sheet.dart';
import '../../regularization/apply_regularization_dialog.dart';

class QuickActionsGrid extends StatelessWidget {
  final bool isDark;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final VoidCallback onOpenHistory;

  const QuickActionsGrid({
    super.key,
    required this.isDark,
    required this.cardBg,
    required this.cardBorder,
    required this.textPrimary,
    required this.onOpenHistory,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
                onTap: onOpenHistory,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildQuickActionCard({
    required String label,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
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
}
