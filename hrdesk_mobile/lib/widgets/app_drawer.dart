import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/branch_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/punch_provider.dart';
import '../widgets/employee_avatar.dart';
import '../widgets/branch_switcher_sheet.dart';
import '../screens/profile/directory_screen.dart';
import '../screens/holidays/holidays_screen.dart';
import '../screens/regularization/regularization_screen.dart';
import '../screens/scanner/qr_scanner_screen.dart';
import '../screens/login_screen.dart';

class AppDrawer extends StatelessWidget {
  final Function(int)? onNavigateIndex;

  const AppDrawer({super.key, this.onNavigateIndex});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final branchProvider = context.watch<BranchProvider>();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final drawerBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC);
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary =
        isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? Colors.white10 : const Color(0xFFE2E8F0);

    return Drawer(
      backgroundColor: drawerBg,
      child: SafeArea(
        child: Column(
          children: [
            // 1. Profile Header
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardBg,
                border: Border(bottom: BorderSide(color: borderCol)),
              ),
              child: Row(
                children: [
                  EmployeeAvatar(
                    employeeId: user?.employeeId,
                    name: user?.fullName ?? user?.username ?? 'Employee',
                    radius: 26,
                    backgroundColor:
                        const Color(0xFF0D9488).withValues(alpha: 0.25),
                    textColor: const Color(0xFF0D9488),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.fullName ?? user?.username ?? 'User',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          user?.role ?? 'Employee',
                          style: const TextStyle(
                              color: Color(0xFF0D9488),
                              fontSize: 12,
                              fontWeight: FontWeight.w700),
                        ),
                        if (user?.employeeCode != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            user!.employeeCode!,
                            style:
                                TextStyle(color: textSecondary, fontSize: 11),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // 2. Active Workspace (Combined Company & Branch Card)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: const Color(0xFF0D9488).withValues(alpha: 0.3)),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () {
                    Navigator.pop(context);
                    WorkspaceSwitcherSheet.show(context,
                        onSelectionChanged: () {
                      context.read<PunchProvider>().fetchTodayStatus();
                      final bp = context.read<BranchProvider>();
                      context
                          .read<AttendanceProvider>()
                          .fetchTeamMatrix(branchId: bp.selectedBranch?.id);
                    });
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color:
                                const Color(0xFF0D9488).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.business,
                              color: Color(0xFF0D9488), size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                branchProvider.branchDisplayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                branchProvider.companyDisplayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Color(0xFF0D9488),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color:
                                const Color(0xFF0D9488).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Switch',
                                  style: TextStyle(
                                      color: Color(0xFF0D9488),
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold)),
                              SizedBox(width: 3),
                              Icon(Icons.swap_horiz,
                                  color: Color(0xFF0D9488), size: 14),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // 3. Navigation Menu Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                children: [
                  _buildNavTile(
                    context,
                    icon: Icons.dashboard_outlined,
                    title: 'Dashboard',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      onNavigateIndex?.call(0);
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.calendar_month_outlined,
                    title: 'Attendance & Muster',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      onNavigateIndex?.call(1);
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.beach_access_outlined,
                    title: 'Leaves & Approvals',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      onNavigateIndex?.call(2);
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.account_balance_wallet_outlined,
                    title: 'Loans & Advances',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      onNavigateIndex?.call(3);
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.edit_calendar_outlined,
                    title: 'Regularization',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const RegularizationScreen()));
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.people_alt_outlined,
                    title: 'Company Directory',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const DirectoryScreen()));
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.qr_code_scanner_rounded,
                    title: 'QR Badge Scanner',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const QrScannerScreen()));
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.celebration_outlined,
                    title: 'Holiday Calendar',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const HolidaysScreen()));
                    },
                  ),
                  _buildNavTile(
                    context,
                    icon: Icons.person_outline,
                    title: 'My Profile',
                    textPrimary: textPrimary,
                    onTap: () {
                      Navigator.pop(context);
                      onNavigateIndex?.call(4);
                    },
                  ),
                ],
              ),
            ),

            // 4. Log Out Footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: borderCol)),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                tileColor: isDark
                    ? const Color(0xFF1E293B)
                    : const Color(0xFFFEE2E2).withValues(alpha: 0.5),
                leading: const Icon(Icons.logout,
                    color: Color(0xFFEF4444), size: 20),
                title: const Text('Log Out',
                    style: TextStyle(
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.bold,
                        fontSize: 14)),
                onTap: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: cardBg,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      title:
                          Text('Log Out', style: TextStyle(color: textPrimary)),
                      content: Text(
                          'Are you sure you want to log out of HRDesk?',
                          style: TextStyle(color: textSecondary)),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: Text('Cancel',
                              style: TextStyle(color: textSecondary)),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFDC2626)),
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Log Out',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );

                  if (confirmed == true && context.mounted) {
                    Navigator.pop(context); // close drawer
                    await auth.logout();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavTile(BuildContext context,
      {required IconData icon,
      required String title,
      required Color textPrimary,
      required VoidCallback onTap}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        dense: true,
        leading: Icon(icon, color: const Color(0xFF0D9488), size: 20),
        title: Text(title,
            style: TextStyle(
                color: textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey, size: 16),
        onTap: onTap,
      ),
    );
  }
}
