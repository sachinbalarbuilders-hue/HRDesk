import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/attendance_model.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/auth_provider.dart';
import 'day_activity_sheet.dart';
import '../regularization/apply_regularization_dialog.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<AttendanceProvider>().fetchAttendance(
        employeeId: auth.user?.employeeId,
      );
    });
  }

  void _openDayDetails(AttendanceDayItem day) {
    final auth = context.read<AuthProvider>();
    final empId = auth.user?.employeeId ?? 1;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DayActivitySheet(
        employeeId: empId,
        date: day.date,
        daySummary: day,
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'present':
      case 'p':
        return const Color(0xFF059669);
      case 'absent':
      case 'a':
        return const Color(0xFFDC2626);
      case 'half day':
      case 'hf':
      case 'cohf':
      case 'shf':
      case 'phf':
        return Colors.amber;
      case 'weekoff':
      case 'w/o':
      case 'wo':
        return Colors.blueGrey;
      case 'holiday':
        return Colors.indigoAccent;
      case 'upcoming':
        return Colors.white24;
      default:
        return const Color(0xFF0D9488);
    }
  }

  String _format12h(String? time24) {
    if (time24 == null || time24.isEmpty) return '—';
    try {
      final parts = time24.split(':');
      var h = int.parse(parts[0]);
      final m = parts[1];
      final ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h != 0 ? h : 12;
      return '${h.toString().padLeft(2, '0')}:$m $ampm';
    } catch (_) {
      return time24;
    }
  }

  String _formatCount(double count) {
    if (count % 1 == 0) return count.toInt().toString();
    return count.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final attendance = context.watch<AttendanceProvider>();
    final summary = attendance.summary;
    final days = attendance.monthDays;

    final monthName = DateFormat('MMMM yyyy').format(
      DateTime(attendance.selectedYear, attendance.selectedMonth),
    );

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: attendance.loading && days.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
          : RefreshIndicator(
              color: const Color(0xFF0D9488),
              onRefresh: () => attendance.fetchAttendance(employeeId: auth.user?.employeeId),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Month Navigator Card
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.chevron_left, color: Colors.white70),
                            onPressed: () => attendance.changeMonth(-1, employeeId: auth.user?.employeeId),
                          ),
                          Row(
                            children: [
                              const Icon(Icons.calendar_month, color: Color(0xFF0D9488), size: 18),
                              const SizedBox(width: 8),
                              Text(
                                monthName,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                          IconButton(
                            icon: const Icon(Icons.chevron_right, color: Colors.white70),
                            onPressed: () => attendance.changeMonth(1, employeeId: auth.user?.employeeId),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Stats Grid
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      childAspectRatio: 1.25,
                      children: [
                        _buildStatCard('Present', _formatCount(summary.presentCount), const Color(0xFF059669), Icons.check_circle_outline),
                        _buildStatCard('Absent', _formatCount(summary.absentCount), const Color(0xFFDC2626), Icons.cancel_outlined),
                        _buildStatCard('Half Days', _formatCount(summary.halfDayCount), Colors.amber, Icons.hourglass_bottom),
                        _buildStatCard('Week Offs', _formatCount(summary.weekoffCount), Colors.blueGrey, Icons.weekend_outlined),
                        _buildStatCard('Holidays', _formatCount(summary.holidayCount), Colors.indigoAccent, Icons.celebration_outlined),
                        _buildStatCard('Payable Days', _formatCount(summary.payableDays), const Color(0xFF0D9488), Icons.verified),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Month Day-by-Day Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Daily Attendance Records',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextButton.icon(
                          style: TextButton.styleFrom(padding: EdgeInsets.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                          icon: const Icon(Icons.edit_calendar, size: 13, color: Color(0xFF0D9488)),
                          label: const Text('Regularize', style: TextStyle(color: Color(0xFF0D9488), fontSize: 12)),
                          onPressed: () {
                            showDialog(
                              context: context,
                              builder: (_) => const ApplyRegularizationDialog(),
                            );
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Days 1..31 List View
                    if (days.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.calendar_today_outlined, size: 40, color: Colors.white38),
                            const SizedBox(height: 12),
                            Text(
                              attendance.error ?? 'No attendance records loaded for this month.',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF0D9488),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              icon: const Icon(Icons.refresh, size: 16, color: Colors.white),
                              label: const Text('Load Attendance Records', style: TextStyle(color: Colors.white, fontSize: 12)),
                              onPressed: () => attendance.fetchAttendance(employeeId: auth.user?.employeeId),
                            ),
                          ],
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: days.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, i) {
                          final d = days[i];
                          final statusColor = _getStatusColor(d.status);
                          final isToday = d.date == DateFormat('yyyy-MM-dd').format(DateTime.now());

                          return GestureDetector(
                            onTap: () => _openDayDetails(d),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isToday ? const Color(0xFF0D9488).withValues(alpha: 0.6) : Colors.white.withValues(alpha: 0.05),
                                  width: isToday ? 1.2 : 0.8,
                                ),
                              ),
                              child: Row(
                                children: [
                                  // Date Number Box
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0F172A),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isToday ? const Color(0xFF0D9488) : Colors.white10,
                                      ),
                                    ),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          '${d.day}',
                                          style: TextStyle(
                                            color: isToday ? const Color(0xFF0D9488) : Colors.white,
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        Text(
                                          d.dayOfWeek.toUpperCase(),
                                          style: TextStyle(
                                            color: isToday ? const Color(0xFF0D9488) : Colors.white38,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // In / Out & Work Duration
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Text(
                                              d.inTime != null ? _format12h(d.inTime) : '— —',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 13,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            const Icon(Icons.arrow_forward, size: 12, color: Colors.white38),
                                            const SizedBox(width: 6),
                                            Text(
                                              d.outTime != null ? _format12h(d.outTime) : '— —',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 13,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 3),
                                        Row(
                                          children: [
                                            if (d.workMinutes > 0)
                                              Text(
                                                'Duration: ${d.workDuration}',
                                                style: const TextStyle(color: Colors.white60, fontSize: 11),
                                              )
                                            else if (d.hasHoliday)
                                              Text(
                                                d.holidayName ?? 'Holiday',
                                                style: const TextStyle(color: Colors.indigoAccent, fontSize: 11),
                                              )
                                            else if (d.hasLeave)
                                              Text(
                                                d.leaveType ?? 'Approved Leave',
                                                style: const TextStyle(color: Colors.amberAccent, fontSize: 11),
                                              )
                                            else
                                              Text(
                                                d.status,
                                                style: const TextStyle(color: Colors.white38, fontSize: 11),
                                              ),
                                            if (d.isLate) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                                decoration: BoxDecoration(
                                                  color: Colors.amber.withValues(alpha: 0.15),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '${d.lateMinutes}m Late',
                                                  style: const TextStyle(color: Colors.amberAccent, fontSize: 9, fontWeight: FontWeight.bold),
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Status Badge Pill
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      d.status,
                                      style: TextStyle(
                                        color: statusColor,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Icon(Icons.chevron_right, color: Colors.white38, size: 18),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Icon(icon, color: color.withValues(alpha: 0.6), size: 16),
            ],
          ),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white60,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
