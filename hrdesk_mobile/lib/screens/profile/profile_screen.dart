import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/employee_provider.dart';
import '../../providers/theme_provider.dart';
import 'directory_screen.dart';
import '../holidays/holidays_screen.dart';
import '../regularization/regularization_screen.dart';
import '../login_screen.dart';
import '../../widgets/employee_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadProfile();
    });
  }

  void _loadProfile() {
    final auth = context.read<AuthProvider>();
    final empId = auth.user?.employeeId;
    context.read<EmployeeProvider>().fetchMyProfile(employeeId: empId);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            'Log Out',
            style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF0F172A)),
          ),
          content: Text(
            'Are you sure you want to log out of HRDesk?',
            style: TextStyle(
                color: isDark ? Colors.white70 : const Color(0xFF64748B)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                'Cancel',
                style: TextStyle(
                    color: isDark ? Colors.white54 : const Color(0xFF94A3B8)),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Log Out'),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      await context.read<AuthProvider>().logout();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final employeeProvider = context.watch<EmployeeProvider>();
    final profile = employeeProvider.profile;
    final user = auth.user;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary =
        isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? Colors.white10 : const Color(0xFFE2E8F0);

    if (employeeProvider.loading && profile == null) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: const Center(
          child: CircularProgressIndicator(color: Color(0xFF0D9488)),
        ),
      );
    }

    final name =
        profile?.employeeName ?? user?.fullName ?? user?.username ?? 'Employee';
    final dept = profile?.department ?? 'General';
    final designation = profile?.designation ?? 'Staff';
    final empCode = profile?.employeeCode ??
        user?.employeeCode ??
        '#${profile?.employeeId ?? user?.employeeId ?? '-'}';

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: RefreshIndicator(
        color: const Color(0xFF0D9488),
        onRefresh: () async => _loadProfile(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            children: [
              // Profile Header Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderCol),
                  boxShadow: [
                    BoxShadow(
                      color:
                          Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        EmployeeAvatar(
                          employeeId: profile?.employeeId ?? user?.employeeId,
                          name: name,
                          photoBase64: profile?.photoBase64,
                          radius: 36,
                          backgroundColor:
                              const Color(0xFF0D9488).withValues(alpha: 0.25),
                          textColor: const Color(0xFF0D9488),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '$designation • $dept',
                                style: TextStyle(
                                    color: textSecondary, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0D9488)
                                          .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                          color: const Color(0xFF0D9488)
                                              .withValues(alpha: 0.4)),
                                    ),
                                    child: Text(
                                      empCode,
                                      style: const TextStyle(
                                        color: Color(0xFF0D9488),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (profile?.status != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color:
                                            (profile!.status!.toLowerCase() ==
                                                        'active'
                                                    ? const Color(0xFF059669)
                                                    : Colors.orange)
                                                .withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        profile.status!.toUpperCase(),
                                        style: TextStyle(
                                          color:
                                              profile.status!.toLowerCase() ==
                                                      'active'
                                                  ? const Color(0xFF059669)
                                                  : Colors.amber.shade700,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (profile?.hasFaceEnrolled == true) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: const Color(0xFF10B981)
                                  .withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.face_retouching_natural,
                                color: Color(0xFF059669), size: 16),
                            SizedBox(width: 6),
                            Text(
                              'Face ID Verified & Active for Punching',
                              style: TextStyle(
                                  color: Color(0xFF059669),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Quick Navigation Shortcuts
              Row(
                children: [
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.people_alt_outlined,
                      label: 'Directory',
                      color: const Color(0xFF0D9488),
                      cardBg: cardBg,
                      borderCol: borderCol,
                      textPrimary: textPrimary,
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const DirectoryScreen())),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.celebration_outlined,
                      label: 'Holidays',
                      color: Colors.amber.shade700,
                      cardBg: cardBg,
                      borderCol: borderCol,
                      textPrimary: textPrimary,
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const HolidaysScreen())),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.edit_calendar_outlined,
                      label: 'Regularize',
                      color: Colors.indigo,
                      cardBg: cardBg,
                      borderCol: borderCol,
                      textPrimary: textPrimary,
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const RegularizationScreen())),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _buildActionTile(
                      icon: context.watch<ThemeProvider>().isDarkMode
                          ? Icons.light_mode_outlined
                          : Icons.dark_mode_outlined,
                      label: context.watch<ThemeProvider>().isDarkMode
                          ? 'Light'
                          : 'Dark',
                      color: context.watch<ThemeProvider>().isDarkMode
                          ? Colors.amber
                          : const Color(0xFF0284C7),
                      cardBg: cardBg,
                      borderCol: borderCol,
                      textPrimary: textPrimary,
                      onTap: () => context.read<ThemeProvider>().toggleTheme(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Profile Detail Tabs
              Container(
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: borderCol),
                ),
                child: Column(
                  children: [
                    TabBar(
                      controller: _tabController,
                      indicatorColor: const Color(0xFF0D9488),
                      indicatorWeight: 3,
                      labelColor: const Color(0xFF0D9488),
                      unselectedLabelColor: textSecondary,
                      labelStyle: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold),
                      tabs: const [
                        Tab(text: 'Work'),
                        Tab(text: 'Personal'),
                        Tab(text: 'Address'),
                        Tab(text: 'Bank & ID'),
                        Tab(text: 'Tenure'),
                      ],
                    ),
                    SizedBox(
                      height: 280,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          // 1. Work Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(
                                      Icons.business_outlined,
                                      'Company',
                                      profile?.organizationName ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.apartment_outlined,
                                      'Branch',
                                      profile?.branch ?? 'Head Office',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.category_outlined,
                                      'Department',
                                      profile?.department ?? 'General',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.badge_outlined,
                                      'Designation',
                                      profile?.designation ?? 'Staff',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.supervisor_account_outlined,
                                      'Reports To',
                                      profile?.reportingManagerName ??
                                          'Management',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.schedule_outlined,
                                      'Assigned Shift',
                                      profile?.shiftName != null
                                          ? '${profile!.shiftName!} (${profile.shiftTiming ?? ''})'
                                          : 'General Shift',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.weekend_outlined,
                                      'Weekly Off',
                                      profile?.weekoff ?? 'Sunday',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.fingerprint,
                                      'Punch Mode',
                                      profile?.attendanceType ??
                                          'Face Recognition & Biometric',
                                      textPrimary,
                                      textSecondary),
                                ],
                              ),
                            ),
                          ),

                          // 2. Personal Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(
                                      Icons.phone_outlined,
                                      'Phone',
                                      profile?.phone ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.email_outlined,
                                      'Work Email',
                                      profile?.email ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.alternate_email,
                                      'Personal Email',
                                      profile?.personalEmail ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.cake_outlined,
                                      'Date of Birth',
                                      profile?.dateOfBirth ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.person_outline,
                                      'Gender',
                                      profile?.gender ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.water_drop_outlined,
                                      'Blood Group',
                                      profile?.bloodGroup ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.favorite_border,
                                      'Marital Status',
                                      profile?.maritalStatus ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.flag_outlined,
                                      'Nationality',
                                      profile?.nationality ?? 'Indian',
                                      textPrimary,
                                      textSecondary),
                                ],
                              ),
                            ),
                          ),

                          // 3. Contact & Address Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(
                                      Icons.home_outlined,
                                      'Current Address',
                                      profile?.currentAddress ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.home_work_outlined,
                                      'Permanent Address',
                                      profile?.permanentAddress ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.map_outlined,
                                      'Branch Location',
                                      profile?.branchAddress ?? '-',
                                      textPrimary,
                                      textSecondary),
                                ],
                              ),
                            ),
                          ),

                          // 4. Bank & ID Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  if (profile?.bankName != null ||
                                      profile?.bankAccountNumber != null) ...[
                                    _buildSectionHeader('Bank Account'),
                                    _buildInfoRow(
                                        Icons.account_balance_outlined,
                                        'Bank Name',
                                        profile?.bankName ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.credit_card_outlined,
                                        'Account Number',
                                        profile?.bankAccountNumber != null
                                            ? '••••${profile!.bankAccountNumber!.length > 4 ? profile!.bankAccountNumber!.substring(profile!.bankAccountNumber!.length - 4) : profile!.bankAccountNumber!}'
                                            : '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.numbers_outlined,
                                        'IFSC Code',
                                        profile?.bankIfscCode ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.person_outline,
                                        'Account Holder',
                                        profile?.bankAccountHolderName ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.savings_outlined,
                                        'Account Type',
                                        profile?.bankAccountType ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    const SizedBox(height: 16),
                                  ],
                                  if (profile?.panNumber != null ||
                                      profile?.aadhaarNumber != null ||
                                      profile?.uanNumber != null) ...[
                                    _buildSectionHeader('Statutory'),
                                    if (profile?.panNumber != null)
                                      _buildInfoRow(
                                          Icons.badge_outlined,
                                          'PAN',
                                          profile!.panNumber!,
                                          textPrimary,
                                          textSecondary),
                                    if (profile?.aadhaarNumber != null)
                                      _buildInfoRow(
                                          Icons.fingerprint_outlined,
                                          'Aadhaar',
                                          '••••${profile!.aadhaarNumber!.length > 4 ? profile!.aadhaarNumber!.substring(profile!.aadhaarNumber!.length - 4) : profile!.aadhaarNumber!}',
                                          textPrimary,
                                          textSecondary),
                                    if (profile?.uanNumber != null)
                                      _buildInfoRow(
                                          Icons.account_box_outlined,
                                          'UAN',
                                          profile!.uanNumber!,
                                          textPrimary,
                                          textSecondary),
                                    if (profile?.pfNumber != null)
                                      _buildInfoRow(
                                          Icons.assured_workload_outlined,
                                          'PF Number',
                                          profile!.pfNumber!,
                                          textPrimary,
                                          textSecondary),
                                    if (profile?.esiNumber != null)
                                      _buildInfoRow(
                                          Icons.health_and_safety_outlined,
                                          'ESI Number',
                                          profile!.esiNumber!,
                                          textPrimary,
                                          textSecondary),
                                    const SizedBox(height: 16),
                                  ],
                                  if (profile?.emergencyContactName != null ||
                                      profile?.emergencyContactPhone !=
                                          null) ...[
                                    _buildSectionHeader('Emergency Contact'),
                                    _buildInfoRow(
                                        Icons.emergency_outlined,
                                        'Name',
                                        profile?.emergencyContactName ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.people_outline,
                                        'Relation',
                                        profile?.emergencyContactRelation ??
                                            '-',
                                        textPrimary,
                                        textSecondary),
                                    _buildInfoRow(
                                        Icons.phone_outlined,
                                        'Phone',
                                        profile?.emergencyContactPhone ?? '-',
                                        textPrimary,
                                        textSecondary),
                                    const SizedBox(height: 16),
                                  ],
                                  if (profile?.passportNumber != null)
                                    _buildInfoRow(
                                        Icons.airplane_ticket_outlined,
                                        'Passport',
                                        profile!.passportNumber!,
                                        textPrimary,
                                        textSecondary),
                                  if (profile?.noticePeriodDays != null)
                                    _buildInfoRow(
                                        Icons.timer_outlined,
                                        'Notice Period',
                                        '${profile!.noticePeriodDays} days',
                                        textPrimary,
                                        textSecondary),
                                ],
                              ),
                            ),
                          ),

                          // 5. Tenure & Contract Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(
                                      Icons.calendar_today_outlined,
                                      'Joining Date',
                                      profile?.joiningDate ?? '-',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.work_history_outlined,
                                      'Employment Type',
                                      profile?.employmentType ??
                                          'Full Time Permanent',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.timer_outlined,
                                      'Probation',
                                      profile?.hasProbation == true
                                          ? 'Yes (${profile?.probationDays ?? 0} days)'
                                          : 'Completed / None',
                                      textPrimary,
                                      textSecondary),
                                  _buildInfoRow(
                                      Icons.assignment_outlined,
                                      'Contract Duration',
                                      profile?.contractDurationMonths != null
                                          ? '${profile!.contractDurationMonths} Months'
                                          : 'Permanent',
                                      textPrimary,
                                      textSecondary),
                                  if (profile?.contractEndDate != null)
                                    _buildInfoRow(
                                        Icons.event_busy_outlined,
                                        'Contract End',
                                        profile!.contractEndDate!,
                                        textPrimary,
                                        textSecondary),
                                  if (profile?.resignationDate != null)
                                    _buildInfoRow(
                                        Icons.logout,
                                        'Resignation Date',
                                        profile!.resignationDate!,
                                        textPrimary,
                                        textSecondary),
                                  if (profile?.lastWorkingDate != null)
                                    _buildInfoRow(
                                        Icons.event_repeat,
                                        'Last Working Date',
                                        profile!.lastWorkingDate!,
                                        textPrimary,
                                        textSecondary),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Logout Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: cardBg,
                    foregroundColor: const Color(0xFFDC2626),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(
                          color: Color(0xFFDC2626), width: 0.5),
                    ),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Log Out',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  onPressed: _handleLogout,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String label,
    required Color color,
    required Color cardBg,
    required Color borderCol,
    required Color textPrimary,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderCol),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    color: textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Row(children: [
        Container(
            width: 3,
            height: 14,
            decoration: BoxDecoration(
                color: const Color(0xFF0D9488),
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 8),
        Text(title,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF64748B),
                letterSpacing: 0.5)),
      ]),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value,
      Color textPrimary, Color textSecondary) {
    final displayValue = value.trim().isNotEmpty ? value : '-';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: textSecondary, size: 16),
          const SizedBox(width: 10),
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(color: textSecondary, fontSize: 12),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              displayValue,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: displayValue == '-'
                    ? textSecondary.withValues(alpha: 0.5)
                    : textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
