import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/branch_model.dart';
import '../models/organization_model.dart';
import '../providers/branch_provider.dart';

class WorkspaceSwitcherSheet extends StatelessWidget {
  final VoidCallback? onSelectionChanged;

  const WorkspaceSwitcherSheet({super.key, this.onSelectionChanged});

  static void show(
    BuildContext context, {
    int initialTab = 0,
    VoidCallback? onSelectionChanged,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => WorkspaceSwitcherSheet(onSelectionChanged: onSelectionChanged),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<BranchProvider>();
    final orgs = provider.organizations;
    final allBranches = provider.allBranches;
    final selectedBranch = provider.selectedBranch;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      padding: const EdgeInsets.only(top: 14, bottom: 20),
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),

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
                      'Select Workspace Branch',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${provider.companyDisplayName} • ${provider.branchDisplayName}',
                      style: const TextStyle(color: Color(0xFF0D9488), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white60, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Divider(color: Colors.white10, height: 1),

          // Unified Combined List (Organized by Company)
          Flexible(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              children: [
                if (orgs.isEmpty && allBranches.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: Center(
                      child: Text('No branches available', style: TextStyle(color: Colors.white38)),
                    ),
                  )
                else ..._buildCombinedOrgSections(context, provider, orgs, allBranches, selectedBranch),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildCombinedOrgSections(
    BuildContext context,
    BranchProvider provider,
    List<OrganizationModel> orgs,
    List<BranchModel> allBranches,
    BranchModel? selectedBranch,
  ) {
    final List<Widget> widgets = [];

    // If orgs exist, group branches under each org
    if (orgs.isNotEmpty) {
      for (final org in orgs) {
        final branchesForOrg = allBranches.where((b) => b.organizationId == org.id).toList();

        // Company Section Header
        widgets.add(
          Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 8, left: 4, right: 4),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D9488).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(Icons.apartment, size: 14, color: Color(0xFF2DD4BF)),
                ),
                const SizedBox(width: 8),
                Text(
                  org.name.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),
                Text(
                  '${branchesForOrg.length} Branch${branchesForOrg.length == 1 ? '' : 'es'}',
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
              ],
            ),
          ),
        );

        if (branchesForOrg.isEmpty) {
          widgets.add(
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text('No branches registered under this company.', style: TextStyle(color: Colors.white38, fontSize: 12)),
            ),
          );
        } else {
          for (final branch in branchesForOrg) {
            final isSelected = selectedBranch?.id == branch.id;
            widgets.add(_buildBranchItem(context, provider, branch, org.name, isSelected));
          }
        }
      }
    } else {
      // Direct list of branches if no explicit org objects
      for (final branch in allBranches) {
        final isSelected = selectedBranch?.id == branch.id;
        widgets.add(_buildBranchItem(context, provider, branch, null, isSelected));
      }
    }

    return widgets;
  }

  Widget _buildBranchItem(
    BuildContext context,
    BranchProvider provider,
    BranchModel branch,
    String? companyName,
    bool isSelected,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          await provider.selectBranch(branch);
          if (context.mounted) {
            Navigator.pop(context);
            onSelectionChanged?.call();
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? const Color(0xFF0D9488).withValues(alpha: 0.15)
                : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? const Color(0xFF0D9488) : Colors.white10,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF0D9488) : const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.location_city_outlined,
                  color: isSelected ? Colors.white : const Color(0xFF0D9488),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      branch.name,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.95),
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (companyName != null) companyName,
                        if (branch.code.isNotEmpty) branch.code,
                        if (branch.city != null && branch.city!.isNotEmpty) branch.city,
                      ].join(' • '),
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (isSelected)
                const Icon(Icons.check_circle, color: Color(0xFF0D9488), size: 20)
              else
                const Icon(Icons.radio_button_unchecked, color: Colors.white24, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

// Retain alias for any existing references
typedef CompanyBranchSwitcherSheet = WorkspaceSwitcherSheet;
typedef BranchSwitcherSheet = WorkspaceSwitcherSheet;
