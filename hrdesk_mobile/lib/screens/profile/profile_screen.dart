import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/employee_provider.dart';
import 'directory_screen.dart';
import '../holidays/holidays_screen.dart';
import '../regularization/regularization_screen.dart';
import '../login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadProfile();
    });
  }

  void _loadProfile() {
    final auth = context.read<AuthProvider>();
    if (auth.user?.employeeId != null) {
      context.read<EmployeeProvider>().fetchMyProfile(employeeId: auth.user!.employeeId!);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Confirm Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to log out from HRDesk?', style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
            onPressed: () => Navigator.pop(ctx, false),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await context.read<AuthProvider>().logout();
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final empProvider = context.watch<EmployeeProvider>();
    final profile = empProvider.profile;
    final user = auth.user;

    final name = profile?.employeeName ?? user?.fullName ?? 'Employee';
    final designation = profile?.designation ?? user?.role ?? 'Team Member';
    final dept = profile?.department ?? 'General';
    final empCode = profile?.employeeCode ?? (user?.employeeId != null ? 'EMP#${user!.employeeId}' : 'EMP#---');
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'E';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: RefreshIndicator(
        onRefresh: () async {
          _loadProfile();
        },
        color: const Color(0xFF0D9488),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            children: [
              // Profile Card Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.3),
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
                        CircleAvatar(
                          radius: 36,
                          backgroundColor: const Color(0xFF0D9488).withValues(alpha: 0.25),
                          child: Text(
                            initial,
                            style: const TextStyle(
                              color: Color(0xFF0D9488),
                              fontSize: 28,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '$designation • $dept',
                                style: const TextStyle(color: Colors.white70, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0D9488).withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.4)),
                                    ),
                                    child: Text(
                                      empCode,
                                      style: const TextStyle(
                                        color: Color(0xFF2DD4BF),
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  if (profile?.status != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: (profile!.status!.toLowerCase() == 'active'
                                                ? const Color(0xFF059669)
                                                : Colors.orange)
                                            .withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        profile.status!.toUpperCase(),
                                        style: TextStyle(
                                          color: profile.status!.toLowerCase() == 'active'
                                              ? const Color(0xFF34D399)
                                              : Colors.amber,
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
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.face_retouching_natural, color: Color(0xFF34D399), size: 16),
                            SizedBox(width: 6),
                            Text(
                              'Face ID Verified & Active for Punching',
                              style: TextStyle(color: Color(0xFF34D399), fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Quick Navigation Shortcuts
              Row(
                children: [
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.people_alt_outlined,
                      label: 'Directory',
                      color: const Color(0xFF0D9488),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const DirectoryScreen())),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.celebration_outlined,
                      label: 'Holidays',
                      color: Colors.amberAccent,
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HolidaysScreen())),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildActionTile(
                      icon: Icons.edit_calendar_outlined,
                      label: 'Regularize',
                      color: Colors.indigoAccent,
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegularizationScreen())),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Profile Detail Tabs
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  children: [
                    TabBar(
                      controller: _tabController,
                      indicatorColor: const Color(0xFF0D9488),
                      indicatorWeight: 3,
                      labelColor: const Color(0xFF0D9488),
                      unselectedLabelColor: Colors.white60,
                      isScrollable: true,
                      tabAlignment: TabAlignment.start,
                      labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      tabs: const [
                        Tab(text: 'Work & Org'),
                        Tab(text: 'Personal'),
                        Tab(text: 'Contact & Address'),
                        Tab(text: 'Tenure & Contract'),
                      ],
                    ),
                    const Divider(color: Colors.white10, height: 1),
                    SizedBox(
                      height: 310,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          // 1. Work & Org Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(Icons.business_outlined, 'Company', profile?.organizationName ?? 'Balar Builders'),
                                  _buildInfoRow(Icons.location_city_outlined, 'Branch', profile?.branch ?? '-'),
                                  _buildInfoRow(Icons.domain_outlined, 'Department', profile?.department ?? '-'),
                                  _buildInfoRow(Icons.badge_outlined, 'Designation', profile?.designation ?? '-'),
                                  _buildInfoRow(Icons.supervisor_account_outlined, 'Reporting Manager', profile?.reportingManagerName ?? 'HR / Management'),
                                  _buildInfoRow(Icons.schedule_outlined, 'Assigned Shift', profile?.shiftName != null ? '${profile!.shiftName!} (${profile.shiftTiming ?? ''})' : 'General Shift'),
                                  _buildInfoRow(Icons.weekend_outlined, 'Weekly Off', profile?.weekoff ?? 'Sunday'),
                                  _buildInfoRow(Icons.fingerprint, 'Punch Mode', profile?.attendanceType ?? 'Face Recognition & Biometric'),
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
                                  _buildInfoRow(Icons.phone_outlined, 'Phone', profile?.phone ?? '-'),
                                  _buildInfoRow(Icons.email_outlined, 'Work Email', profile?.email ?? '-'),
                                  _buildInfoRow(Icons.alternate_email, 'Personal Email', profile?.personalEmail ?? '-'),
                                  _buildInfoRow(Icons.cake_outlined, 'Date of Birth', profile?.dateOfBirth ?? '-'),
                                  _buildInfoRow(Icons.person_outline, 'Gender', profile?.gender ?? '-'),
                                  _buildInfoRow(Icons.water_drop_outlined, 'Blood Group', profile?.bloodGroup ?? '-'),
                                  _buildInfoRow(Icons.favorite_border, 'Marital Status', profile?.maritalStatus ?? '-'),
                                  _buildInfoRow(Icons.flag_outlined, 'Nationality', profile?.nationality ?? 'Indian'),
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
                                  _buildInfoRow(Icons.home_outlined, 'Current Address', profile?.currentAddress ?? '-'),
                                  _buildInfoRow(Icons.home_work_outlined, 'Permanent Address', profile?.permanentAddress ?? '-'),
                                  _buildInfoRow(Icons.map_outlined, 'Branch Location', profile?.branchAddress ?? '-'),
                                ],
                              ),
                            ),
                          ),

                          // 4. Tenure & Contract Tab
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: SingleChildScrollView(
                              child: Column(
                                children: [
                                  _buildInfoRow(Icons.calendar_today_outlined, 'Joining Date', profile?.joiningDate ?? '-'),
                                  _buildInfoRow(Icons.work_history_outlined, 'Employment Type', profile?.employmentType ?? 'Full Time Permanent'),
                                  _buildInfoRow(Icons.timer_outlined, 'Probation', profile?.hasProbation == true ? 'Yes (${profile?.probationDays ?? 0} days)' : 'Completed / None'),
                                  _buildInfoRow(Icons.assignment_outlined, 'Contract Duration', profile?.contractDurationMonths != null ? '${profile!.contractDurationMonths} Months' : 'Permanent'),
                                  if (profile?.contractEndDate != null)
                                    _buildInfoRow(Icons.event_busy_outlined, 'Contract End', profile!.contractEndDate!),
                                  if (profile?.resignationDate != null)
                                    _buildInfoRow(Icons.logout, 'Resignation Date', profile!.resignationDate!),
                                  if (profile?.lastWorkingDate != null)
                                    _buildInfoRow(Icons.event_repeat, 'Last Working Date', profile!.lastWorkingDate!),
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
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: const Color(0xFFDC2626),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFDC2626), width: 0.5),
                    ),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.logout, size: 18),
                  label: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
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

  Widget _buildActionTile({required IconData icon, required String label, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    final displayValue = value.trim().isNotEmpty ? value : '-';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.white60, size: 16),
          const SizedBox(width: 10),
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(color: Colors.white60, fontSize: 12),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              displayValue,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: displayValue == '-' ? Colors.white38 : Colors.white,
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
