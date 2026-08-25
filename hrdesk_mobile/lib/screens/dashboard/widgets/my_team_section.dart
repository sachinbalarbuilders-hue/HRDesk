import 'package:flutter/material.dart';
import '../../../models/dashboard_model.dart';
import '../../../widgets/employee_avatar.dart';

class MyTeamSection extends StatelessWidget {
  final List<TeamMemberTodayModel> team;
  final int presentCount;
  final int totalCount;
  final bool isDark;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;

  const MyTeamSection({
    super.key,
    required this.team,
    required this.presentCount,
    required this.totalCount,
    required this.isDark,
    required this.cardBg,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
  });

  void _showMemberDetailDialog(BuildContext context, TeamMemberTodayModel m) {
    final isPresent = m.isPresent;
    final isOnLeave = m.isOnLeave;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
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
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isPresent
                      ? const Color(0xFF10B981)
                      : isOnLeave
                          ? Colors.purple
                          : Colors.grey.withValues(alpha: 0.4),
                  width: 2.5,
                ),
              ),
              child: EmployeeAvatar(
                employeeId: m.employeeId,
                name: m.employeeName,
                radius: 30,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              m.employeeName,
              style: TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 2),
            Text(
              '${m.designation} • ${m.department}',
              style: TextStyle(color: textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isPresent
                    ? const Color(0xFF059669).withValues(alpha: 0.12)
                    : isOnLeave
                        ? Colors.purple.withValues(alpha: 0.12)
                        : (isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFF1F5F9)),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isPresent
                      ? const Color(0xFF10B981).withValues(alpha: 0.3)
                      : isOnLeave
                          ? Colors.purple.withValues(alpha: 0.3)
                          : cardBorder,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isPresent
                              ? const Color(0xFF10B981)
                              : isOnLeave
                                  ? Colors.purple
                                  : Colors.grey,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isPresent ? 'In Office' : (isOnLeave ? 'On Approved Leave' : 'Not Clocked In Yet'),
                        style: TextStyle(
                          color: isPresent
                              ? const Color(0xFF059669)
                              : isOnLeave
                                  ? Colors.purple
                                  : textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  if (m.inTime != null)
                    Text(
                      'Punched: ${m.inTime}',
                      style: TextStyle(color: textPrimary, fontSize: 12, fontWeight: FontWeight.w600),
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

  void _showAllTeamMembersSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = query.trim().isEmpty
                ? team
                : team.where((m) =>
                    m.employeeName.toLowerCase().contains(query.toLowerCase()) ||
                    m.designation.toLowerCase().contains(query.toLowerCase()) ||
                    m.department.toLowerCase().contains(query.toLowerCase())).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                border: Border.all(color: cardBorder),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white24 : Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'My Team Today',
                              style: TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.w800),
                            ),
                            Text(
                              '$presentCount present out of ${totalCount > 0 ? totalCount : team.length} members',
                              style: TextStyle(color: textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: Icon(Icons.close_rounded, color: textSecondary, size: 20),
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      onChanged: (val) => setModalState(() => query = val),
                      style: TextStyle(color: textPrimary, fontSize: 12),
                      decoration: InputDecoration(
                        hintText: 'Search members by name or department...',
                        hintStyle: TextStyle(color: textSecondary, fontSize: 12),
                        prefixIcon: Icon(Icons.search_rounded, color: textSecondary, size: 18),
                        isDense: true,
                        filled: true,
                        fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: cardBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF0D9488)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Divider(color: cardBorder, height: 1),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Text(
                              'No matching members found.',
                              style: TextStyle(color: textSecondary, fontSize: 12),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => Divider(color: cardBorder, height: 1),
                            itemBuilder: (context, i) {
                              final m = filtered[i];
                              final isPresent = m.isPresent;
                              final isOnLeave = m.isOnLeave;

                              return ListTile(
                                onTap: () {
                                  Navigator.of(context).pop();
                                  _showMemberDetailDialog(context, m);
                                },
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
                                leading: Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: isPresent
                                          ? const Color(0xFF10B981)
                                          : isOnLeave
                                              ? Colors.purple
                                              : Colors.grey.withValues(alpha: 0.3),
                                      width: 2,
                                    ),
                                  ),
                                  child: EmployeeAvatar(
                                    employeeId: m.employeeId,
                                    name: m.employeeName,
                                    radius: 18,
                                  ),
                                ),
                                title: Text(
                                  m.employeeName,
                                  style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                                subtitle: Text(
                                  '${m.designation} • ${m.department}',
                                  style: TextStyle(color: textSecondary, fontSize: 11),
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
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header Row
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
            Row(
              children: [
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
                if (team.length > 5) ...[
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _showAllTeamMembersSheet(context),
                    borderRadius: BorderRadius.circular(8),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: Text(
                        'See All',
                        style: TextStyle(color: Color(0xFF0D9488), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Horizontal Story/Round Scroll Layout
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
          SizedBox(
            height: 106,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: team.length + (team.length > 5 ? 1 : 0),
              separatorBuilder: (_, __) => const SizedBox(width: 14),
              itemBuilder: (ctx, i) {
                // If last item and team > 5, show "View All" circular button
                if (i == team.length && team.length > 5) {
                  return InkWell(
                    onTap: () => _showAllTeamMembersSheet(context),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 68,
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF0D9488).withValues(alpha: 0.12),
                              border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.4), width: 1.5),
                            ),
                            child: const Center(
                              child: Icon(Icons.arrow_forward_rounded, color: Color(0xFF0D9488), size: 22),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'View All',
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '${team.length} total',
                            style: TextStyle(color: textSecondary, fontSize: 9),
                            maxLines: 1,
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final m = team[i];
                final isPresent = m.isPresent;
                final isOnLeave = m.isOnLeave;
                final firstName = m.employeeName.split(' ').first;

                return InkWell(
                  onTap: () => _showMemberDetailDialog(context, m),
                  borderRadius: BorderRadius.circular(16),
                  child: SizedBox(
                    width: 68,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Circular Avatar with Status Ring & Online Indicator Dot
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(2.5),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isPresent
                                      ? const Color(0xFF10B981)
                                      : isOnLeave
                                          ? Colors.purple
                                          : (isDark ? Colors.white.withValues(alpha: 0.15) : const Color(0xFFCBD5E1)),
                                  width: isPresent ? 2.2 : 1.5,
                                ),
                              ),
                              child: EmployeeAvatar(
                                employeeId: m.employeeId,
                                name: m.employeeName,
                                radius: 24,
                              ),
                            ),
                            // Status Dot Badge
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                width: 13,
                                height: 13,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isPresent
                                      ? const Color(0xFF10B981)
                                      : isOnLeave
                                          ? Colors.purple
                                          : Colors.grey,
                                  border: Border.all(color: cardBg, width: 2),
                                ),
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
                        // Time or Status Chip
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: isPresent
                                ? const Color(0xFF059669).withValues(alpha: 0.12)
                                : isOnLeave
                                    ? Colors.purple.withValues(alpha: 0.12)
                                    : (isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            m.inTime != null ? m.inTime! : (isOnLeave ? 'Leave' : 'Not In'),
                            style: TextStyle(
                              color: isPresent
                                  ? const Color(0xFF059669)
                                  : isOnLeave
                                      ? Colors.purple
                                      : textSecondary,
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
