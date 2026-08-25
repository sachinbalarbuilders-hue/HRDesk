import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import 'day_activity_sheet.dart';
import '../regularization/apply_regularization_dialog.dart';
import '../../widgets/employee_avatar.dart';
import '../../providers/branch_provider.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      final att = context.read<AttendanceProvider>();
      final branch = context.read<BranchProvider>();
      att.fetchAttendance(employeeId: auth.user?.employeeId);
      att.fetchTeamMatrix(branchId: branch.selectedBranch?.id);
    });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 250) {
      final att = context.read<AttendanceProvider>();
      final branch = context.read<BranchProvider>();
      if (att.hasMoreTeam && !att.teamLoadingMore && !att.teamLoading) {
        att.loadMoreTeamMatrix(search: _searchQuery, branchId: branch.selectedBranch?.id);
      }
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _openEmployeeDayDetails(int employeeId, int dayNum) {
    final att = context.read<AttendanceProvider>();
    final dateStr = '${att.selectedYear}-${att.selectedMonth.toString().padLeft(2, '0')}-${dayNum.toString().padLeft(2, '0')}';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DayActivitySheet(
        employeeId: employeeId,
        date: dateStr,
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    final s = status.trim().toUpperCase();
    if (s.isEmpty || s == '-' || s == '—') {
      return Container(
        width: 22,
        height: 22,
        decoration: BoxDecoration(
          color: Colors.grey.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(5),
        ),
        alignment: Alignment.center,
        child: const Text('—', style: TextStyle(color: Colors.grey, fontSize: 10)),
      );
    }

    Color bg = const Color(0xFF334155);
    String label = s;

    if (s == 'P' || s == 'PRESENT') {
      bg = const Color(0xFF059669);
      label = 'P';
    } else if (s == 'A' || s == 'ABSENT') {
      bg = const Color(0xFFDC2626);
      label = 'A';
    } else if (s == 'WO' || s == 'W/O' || s == 'WEEKOFF') {
      bg = const Color(0xFF2563EB);
      label = 'WO';
    } else if (s == 'CO') {
      bg = const Color(0xFF6366F1);
      label = 'CO';
    } else if (s == 'COHF' || s.contains('CO')) {
      bg = const Color(0xFF4F46E5);
      label = 'COHF';
    } else if (s.contains('HF') || s.contains('HALF')) {
      bg = Colors.amber.shade700;
      label = 'HF';
    } else if (s == 'H' || s == 'HOLIDAY') {
      bg = const Color(0xFF9333EA);
      label = 'H';
    } else if (s == 'L' || s == 'LEAVE' || s.contains('PL') || s.contains('SL')) {
      bg = const Color(0xFF0D9488);
      label = s.length > 3 ? s.substring(0, 3) : s;
    }

    return Container(
      width: 26,
      height: 22,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(5),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  String _formatCount(dynamic val) {
    if (val == null) return '0';
    if (val is double) {
      return val.truncateToDouble() == val ? val.toInt().toString() : val.toStringAsFixed(1);
    }
    return val.toString();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final attendance = context.watch<AttendanceProvider>();
    final mySummary = attendance.summary;
    final monthName = DateFormat('MMMM yyyy').format(DateTime(attendance.selectedYear, attendance.selectedMonth));

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? Colors.white10 : const Color(0xFFE2E8F0);
    final innerTileBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);

    final rawItems = attendance.teamMatrixItems;
    final filteredItems = rawItems.where((item) {
      if (_searchQuery.isEmpty) return true;
      final empName = item['employee']?['employeeName']?.toString().toLowerCase() ?? '';
      final deptName = item['employee']?['departmentName']?.toString().toLowerCase() ?? '';
      return empName.contains(_searchQuery.toLowerCase()) || deptName.contains(_searchQuery.toLowerCase());
    }).toList();

    final daysInMonth = attendance.teamDaysInMonth > 0 ? attendance.teamDaysInMonth : 31;
    final now = DateTime.now();
    final todayDay = (now.year == attendance.selectedYear && now.month == attendance.selectedMonth) ? now.day : -1;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFF0D9488),
          onRefresh: () async {
            await Future.wait([
              attendance.fetchAttendance(employeeId: auth.user?.employeeId),
              attendance.fetchTeamMatrix(search: _searchQuery),
            ]);
          },
          child: CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // 1. App Bar / Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Monthly Attendance',
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            monthName,
                            style: const TextStyle(
                              color: Color(0xFF0D9488),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: borderCol),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.apartment, size: 13, color: Color(0xFF0D9488)),
                                const SizedBox(width: 4),
                                ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 110),
                                  child: Text(
                                    context.watch<BranchProvider>().branchDisplayName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: textSecondary, fontSize: 11, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0D9488),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            icon: const Icon(Icons.edit_calendar, size: 14),
                            label: const Text('Regularize', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            onPressed: () {
                              showModalBottomSheet(
                                context: context,
                                isScrollControlled: true,
                                backgroundColor: Colors.transparent,
                                builder: (_) => const ApplyRegularizationSheet(),
                              );
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 2. Month Navigator Card
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: borderCol),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: Icon(Icons.chevron_left, color: textSecondary, size: 22),
                          onPressed: () {
                            final bp = context.read<BranchProvider>();
                            attendance.changeMonth(-1, employeeId: auth.user?.employeeId, search: _searchQuery, branchId: bp.selectedBranch?.id);
                          },
                        ),
                        Row(
                          children: [
                            const Icon(Icons.calendar_month, color: Color(0xFF0D9488), size: 18),
                            const SizedBox(width: 8),
                            Text(
                              monthName,
                              style: TextStyle(
                                color: textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: Icon(Icons.chevron_right, color: textSecondary, size: 22),
                          onPressed: () {
                            final bp = context.read<BranchProvider>();
                            attendance.changeMonth(1, employeeId: auth.user?.employeeId, search: _searchQuery, branchId: bp.selectedBranch?.id);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 3. My Summary Stats Strip
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildSummaryPill('Present', _formatCount(mySummary.presentCount), const Color(0xFF059669), cardBg, textPrimary, textSecondary),
                        _buildSummaryPill('Absent', _formatCount(mySummary.absentCount), const Color(0xFFDC2626), cardBg, textPrimary, textSecondary),
                        _buildSummaryPill('Half Day', _formatCount(mySummary.halfDayCount), Colors.amber.shade700, cardBg, textPrimary, textSecondary),
                        _buildSummaryPill('Week Off', _formatCount(mySummary.weekoffCount), const Color(0xFF2563EB), cardBg, textPrimary, textSecondary),
                        _buildSummaryPill('Holiday', _formatCount(mySummary.holidayCount), const Color(0xFF9333EA), cardBg, textPrimary, textSecondary),
                        _buildSummaryPill('Payable', _formatCount(mySummary.payableDays), const Color(0xFF0D9488), cardBg, textPrimary, textSecondary, isBold: true),
                      ],
                    ),
                  ),
                ),
              ),

              // 4. Search Filter
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                  child: Container(
                    height: 42,
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: borderCol),
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: TextStyle(color: textPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Search members by name or department...',
                        hintStyle: TextStyle(color: textSecondary, fontSize: 13),
                        prefixIcon: Icon(Icons.search, color: textSecondary, size: 18),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.clear, color: textSecondary, size: 16),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 11),
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    ),
                  ),
                ),
              ),

              // 5. Loading / Empty / Employee List
              if (attendance.teamLoading && filteredItems.isEmpty)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF0D9488)),
                  ),
                )
              else if (filteredItems.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.people_outline, size: 48, color: textSecondary),
                        const SizedBox(height: 12),
                        Text(
                          _searchQuery.isNotEmpty ? 'No members match "$_searchQuery"' : 'No attendance records found.',
                          style: TextStyle(color: textSecondary, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final item = filteredItems[index];
                        final emp = item['employee'] ?? {};
                        final empId = (emp['employeeId'] as num?)?.toInt() ?? 0;
                        final empName = emp['employeeName']?.toString() ?? 'Employee';
                        final dept = emp['department'] ?? emp['departmentName'] ?? '';
                        final dailyStatus = (item['dailyStatus'] as Map<String, dynamic>?) ?? {};
                        final summary = item['summary'] ?? {};
                        final isMe = empId == auth.user?.employeeId;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isMe ? const Color(0xFF0D9488).withValues(alpha: 0.5) : borderCol,
                              width: isMe ? 1.5 : 1,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: isDark ? 0.15 : 0.05),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Employee Header Bar
                              Padding(
                                padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                                child: Row(
                                  children: [
                                    // Avatar
                                    EmployeeAvatar(
                                      employeeId: empId,
                                      name: empName,
                                      photoUrl: emp['photoUrl']?.toString() ?? emp['photoPath']?.toString(),
                                      radius: 18,
                                      backgroundColor: isMe ? const Color(0xFF0D9488) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                                      textColor: isMe ? Colors.white : (isDark ? Colors.white : const Color(0xFF0F172A)),
                                    ),
                                    const SizedBox(width: 10),

                                    // Name & Dept
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  empName,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: TextStyle(
                                                    color: textPrimary,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 14,
                                                  ),
                                                ),
                                              ),
                                              if (isMe) ...[
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.4)),
                                                  ),
                                                  child: const Text('You', style: TextStyle(color: Color(0xFF0D9488), fontSize: 10, fontWeight: FontWeight.bold)),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            dept.isNotEmpty ? dept : 'General',
                                            style: TextStyle(color: textSecondary, fontSize: 11),
                                          ),
                                        ],
                                      ),
                                    ),

                                    // Summary Chips on Right
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        _buildMiniStat('P', summary['presentDays']?.toString() ?? '0', const Color(0xFF059669)),
                                        const SizedBox(width: 4),
                                        _buildMiniStat('A', summary['absentDays']?.toString() ?? '0', const Color(0xFFDC2626)),
                                        const SizedBox(width: 4),
                                        _buildMiniStat('Pay', summary['payableDays']?.toString() ?? '0', const Color(0xFF0D9488)),
                                      ],
                                    ),
                                  ],
                                ),
                              ),

                              Divider(color: borderCol, height: 1),

                              // Horizontal 31-Day Swipe Strip
                              SizedBox(
                                height: 72,
                                child: ListView.builder(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  itemCount: daysInMonth,
                                  itemBuilder: (ctx, dayIdx) {
                                    final dayNum = dayIdx + 1;
                                    final status = dailyStatus[dayNum.toString()]?.toString() ?? '';
                                    final date = DateTime(attendance.selectedYear, attendance.selectedMonth, dayNum);
                                    final weekdayLetter = DateFormat('E').format(date).substring(0, 1);
                                    final isToday = dayNum == todayDay;

                                    return GestureDetector(
                                      onTap: () => _openEmployeeDayDetails(empId, dayNum),
                                      child: Container(
                                        width: 38,
                                        margin: const EdgeInsets.symmetric(horizontal: 3),
                                        decoration: BoxDecoration(
                                          color: isToday
                                              ? const Color(0xFF0D9488).withValues(alpha: 0.15)
                                              : innerTileBg,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(
                                            color: isToday ? const Color(0xFF0D9488) : borderCol,
                                            width: isToday ? 1.5 : 1,
                                          ),
                                        ),
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              dayNum.toString().padLeft(2, '0'),
                                              style: TextStyle(
                                                color: isToday ? const Color(0xFF0D9488) : textPrimary,
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            Text(
                                              weekdayLetter,
                                              style: TextStyle(
                                                color: (weekdayLetter == 'S') ? Colors.amber.shade700 : textSecondary,
                                                fontSize: 8,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const SizedBox(height: 3),
                                            _buildStatusBadge(status),
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
                      childCount: filteredItems.length,
                    ),
                  ),
                ),

              // 6. Pagination Loader / Total Count Footer
              if (attendance.teamLoadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(color: Color(0xFF0D9488), strokeWidth: 2.5),
                      ),
                    ),
                  ),
                )
              else if (filteredItems.isNotEmpty && !attendance.hasMoreTeam && attendance.teamTotalCount > 10)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 24),
                    child: Center(
                      child: Text(
                        'Showing all ${attendance.teamTotalCount} members',
                        style: TextStyle(color: textSecondary, fontSize: 11),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryPill(String label, String value, Color color, Color cardBg, Color textPrimary, Color textSecondary, {bool isBold = false}) {
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text('$label: ', style: TextStyle(color: textSecondary, fontSize: 11)),
          Text(
            value,
            style: TextStyle(
              color: textPrimary,
              fontSize: 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label:', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
          const SizedBox(width: 3),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
