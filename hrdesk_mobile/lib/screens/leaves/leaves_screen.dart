import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/leave_provider.dart';
import 'apply_leave_sheet.dart';

class LeavesScreen extends StatefulWidget {
  const LeavesScreen({super.key});

  @override
  State<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends State<LeavesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<LeaveProvider>().fetchAllLeaveData(
        employeeId: auth.user?.employeeId,
      );
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _openApplySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ApplyLeaveSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final leaveProvider = context.watch<LeaveProvider>();
    final balances = leaveProvider.balances;
    final allApps = leaveProvider.myApplications;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? Colors.white10 : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: leaveProvider.loading && balances.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
          : RefreshIndicator(
              color: const Color(0xFF0D9488),
              onRefresh: () => leaveProvider.fetchAllLeaveData(employeeId: auth.user?.employeeId),
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header + Apply Button
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Leave Balances',
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF0D9488),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                icon: const Icon(Icons.add, size: 16),
                                label: const Text('Apply Leave', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                onPressed: _openApplySheet,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Balances Row
                          if (balances.isEmpty)
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: borderCol),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.info_outline, color: textSecondary, size: 18),
                                  const SizedBox(width: 10),
                                  Text('No leave balances configured.', style: TextStyle(color: textSecondary, fontSize: 13)),
                                ],
                              ),
                            )
                          else
                            SizedBox(
                              height: 110,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: balances.length,
                                separatorBuilder: (_, __) => const SizedBox(width: 10),
                                itemBuilder: (ctx, i) {
                                  final b = balances[i];
                                  return _buildBalanceCard(b.leaveTypeCode, b.leaveTypeName, b.remaining, b.totalAllocated, cardBg, borderCol, textPrimary, textSecondary);
                                },
                              ),
                            ),
                          const SizedBox(height: 24),

                          // History section title & Tabs
                          Text(
                            'My Applications',
                            style: TextStyle(
                              color: textPrimary,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            height: 38,
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: TabBar(
                              controller: _tabController,
                              indicator: BoxDecoration(
                                color: const Color(0xFF0D9488),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              labelColor: Colors.white,
                              unselectedLabelColor: textSecondary,
                              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              tabs: const [
                                Tab(text: 'All'),
                                Tab(text: 'Pending'),
                                Tab(text: 'Approved'),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),

                  // Tab list content
                  SliverFillRemaining(
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildApplicationList(allApps, cardBg, borderCol, textPrimary, textSecondary),
                        _buildApplicationList(allApps.where((a) => a.status == 'Pending').toList(), cardBg, borderCol, textPrimary, textSecondary),
                        _buildApplicationList(allApps.where((a) => a.status == 'Approved').toList(), cardBg, borderCol, textPrimary, textSecondary),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildBalanceCard(String code, String name, double remaining, double total, Color cardBg, Color borderCol, Color textPrimary, Color textSecondary) {
    return Container(
      width: 130,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderCol),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(code, style: const TextStyle(color: Color(0xFF0D9488), fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              Text('${total.toInt()} total', style: TextStyle(color: textSecondary, fontSize: 10)),
            ],
          ),
          Text(
            remaining.toStringAsFixed(remaining.truncateToDouble() == remaining ? 0 : 1),
            style: TextStyle(color: textPrimary, fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildApplicationList(List applications, Color cardBg, Color borderCol, Color textPrimary, Color textSecondary) {
    if (applications.isEmpty) {
      return Center(
        child: Text('No leave applications found.', style: TextStyle(color: textSecondary, fontSize: 14)),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: applications.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final app = applications[i];
        Color statusColor;
        switch (app.status) {
          case 'Approved':
            statusColor = const Color(0xFF059669);
            break;
          case 'Rejected':
            statusColor = const Color(0xFFDC2626);
            break;
          default:
            statusColor = Colors.amber;
        }

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: borderCol),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D9488).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          app.leaveTypeName,
                          style: const TextStyle(color: Color(0xFF0D9488), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${app.totalDays} Day${app.totalDays > 1 ? 's' : ''}',
                        style: TextStyle(color: textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      app.status,
                      style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.date_range, color: textSecondary, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    '${app.startDate} → ${app.endDate} (${app.dayType})',
                    style: TextStyle(color: textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
              if (app.reason != null && app.reason!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  app.reason!,
                  style: TextStyle(color: textSecondary, fontSize: 12),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
