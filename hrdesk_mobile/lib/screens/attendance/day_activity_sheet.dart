import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/attendance_model.dart';
import '../../providers/attendance_provider.dart';
import '../regularization/apply_regularization_dialog.dart';

class DayActivitySheet extends StatefulWidget {
  final int employeeId;
  final String date;
  final AttendanceDayItem? daySummary;

  const DayActivitySheet({
    super.key,
    required this.employeeId,
    required this.date,
    this.daySummary,
  });

  @override
  State<DayActivitySheet> createState() => _DayActivitySheetState();
}

class _DayActivitySheetState extends State<DayActivitySheet> {
  DayDetailsModel? _details;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    final attProvider = context.read<AttendanceProvider>();
    final result = await attProvider.fetchDayDetails(
      employeeId: widget.employeeId,
      date: widget.date,
    );

    if (mounted) {
      setState(() {
        _details = result;
        _loading = false;
      });
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
      default:
        return const Color(0xFF0D9488);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.daySummary;
    final status = _details?.status ?? summary?.status ?? 'Absent';
    final statusColor = _getStatusColor(status);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      padding: const EdgeInsets.only(top: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Attendance Details',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _details?.formattedDate ?? (summary != null ? '${summary.fullDayOfWeek}, ${summary.date}' : widget.date),
                      style: const TextStyle(color: Colors.white60, fontSize: 12),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white60),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10),

          // Content Body
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
                : SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status & Shift Banner Card
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  if (_details?.isLate == true) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: Colors.amber.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Late: ${_details!.lateMinutes}m',
                                        style: const TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              Text(
                                _details?.shiftName ?? 'General Shift',
                                style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Key Metrics 4-Grid
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: 1.6,
                          children: [
                            _buildMetricTile(
                              title: 'First In',
                              value: _format12h(_details?.inTime ?? summary?.inTime),
                              subtext: _details?.inTime != null ? '24h: ${_details!.inTime}' : 'No punch',
                              icon: Icons.login,
                              color: const Color(0xFF059669),
                            ),
                            _buildMetricTile(
                              title: 'Last Out',
                              value: _format12h(_details?.outTime ?? summary?.outTime),
                              subtext: _details?.outTime != null ? '24h: ${_details!.outTime}' : (_details?.inTime != null ? 'Open / In progress' : 'No punch'),
                              icon: Icons.logout,
                              color: const Color(0xFFDC2626),
                            ),
                            _buildMetricTile(
                              title: 'Work Duration',
                              value: _details?.workDurationFormatted ?? summary?.workDuration ?? '--',
                              subtext: '${_details?.workMinutes ?? summary?.workMinutes ?? 0} total mins',
                              icon: Icons.timer_outlined,
                              color: const Color(0xFF0D9488),
                            ),
                            _buildMetricTile(
                              title: 'Total Swipes',
                              value: '${_details?.totalPunches ?? 0} Punches',
                              subtext: _details?.breakMinutes != null && _details!.breakMinutes > 0 ? '${_details!.breakMinutes}m break' : 'Single Shift',
                              icon: Icons.fingerprint,
                              color: Colors.indigoAccent,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Leave Banner if applicable
                        if (_details?.leaveType != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.beach_access, color: Colors.amberAccent, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Approved Leave: ${_details!.leaveType} ${_details?.leaveReason != null ? '("${_details!.leaveReason}")' : ''}',
                                    style: const TextStyle(color: Colors.amberAccent, fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],

                        // Holiday Banner if applicable
                        if (_details?.holidayName != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.indigoAccent.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.indigoAccent.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.celebration, color: Colors.indigoAccent, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Public Holiday: ${_details!.holidayName}',
                                    style: const TextStyle(color: Colors.indigoAccent, fontSize: 12, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],

                        // Chronological Punch Timeline Feed
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Punch Timeline',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            TextButton.icon(
                              style: TextButton.styleFrom(padding: EdgeInsets.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                              icon: const Icon(Icons.edit_calendar, size: 14, color: Color(0xFF0D9488)),
                              label: const Text('Regularize', style: TextStyle(color: Color(0xFF0D9488), fontSize: 12)),
                              onPressed: () {
                                Navigator.pop(context);
                                showDialog(
                                  context: context,
                                  builder: (_) => const ApplyRegularizationDialog(),
                                );
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        if (_details?.punches.isEmpty ?? true)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Center(
                              child: Text(
                                'No raw biometric or mobile punch logs for this day.',
                                style: TextStyle(color: Colors.white38, fontSize: 12),
                              ),
                            ),
                          )
                        else
                          ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _details!.punches.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (ctx, i) {
                              final punch = _details!.punches[i];
                              final isIn = punch.punchType.toLowerCase() == 'in';
                              final punchColor = isIn ? const Color(0xFF059669) : const Color(0xFFDC2626);

                              return Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: punchColor.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Icon(
                                        isIn ? Icons.login : Icons.logout,
                                        color: punchColor,
                                        size: 16,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                isIn ? 'PUNCH IN' : 'PUNCH OUT',
                                                style: TextStyle(
                                                  color: punchColor,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 12,
                                                ),
                                              ),
                                              Text(
                                                punch.timeShort,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                punch.machineNumber,
                                                style: const TextStyle(color: Colors.white60, fontSize: 11),
                                              ),
                                              if (punch.isGeofenceValid != null)
                                                Row(
                                                  children: [
                                                    Icon(
                                                      punch.isGeofenceValid == true ? Icons.check_circle : Icons.warning_amber,
                                                      size: 12,
                                                      color: punch.isGeofenceValid == true ? const Color(0xFF34D399) : Colors.amber,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      punch.isGeofenceValid == true ? 'Geofence OK' : 'Outside',
                                                      style: TextStyle(
                                                        color: punch.isGeofenceValid == true ? const Color(0xFF34D399) : Colors.amber,
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w600,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required String subtext,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
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
              Text(title, style: const TextStyle(color: Colors.white60, fontSize: 11)),
              Icon(icon, color: color, size: 16),
            ],
          ),
          Text(
            value,
            style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          Text(
            subtext,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white38, fontSize: 10),
          ),
        ],
      ),
    );
  }
}
