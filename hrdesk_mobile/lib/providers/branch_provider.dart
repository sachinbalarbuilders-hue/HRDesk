import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/api_client.dart';
import '../models/branch_model.dart';
import '../models/organization_model.dart';

class BranchProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();
  final _storage = const FlutterSecureStorage();

  List<OrganizationModel> _organizations = [];
  OrganizationModel? _selectedOrganization;

  List<BranchModel> _allBranches = [];
  BranchModel? _selectedBranch;

  bool _loading = false;
  String? _error;

  List<OrganizationModel> get organizations => _organizations;
  OrganizationModel? get selectedOrganization => _selectedOrganization;
  List<BranchModel> get allBranches => _allBranches;
  BranchModel? get selectedBranch => _selectedBranch;
  bool get loading => _loading;
  String? get error => _error;

  /// Returns only branches belonging to the currently selected organization
  List<BranchModel> get branchesForSelectedOrg {
    if (_selectedOrganization == null) return _allBranches;
    return _allBranches.where((b) {
      if (b.organizationId == null) return true;
      return b.organizationId == _selectedOrganization!.id;
    }).toList();
  }

  String get companyDisplayName => _selectedOrganization?.name ?? 'Company';
  String get branchDisplayName => _selectedBranch?.name ?? (branchesForSelectedOrg.firstOrNull?.name ?? 'Branch');

  Future<void> fetchCompaniesAndBranches({int? defaultOrgId, int? defaultBranchId}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final results = await Future.wait([
        _api.dio.get('/masters/organizations'),
        _api.dio.get('/masters/branches'),
      ]);

      // 1. Parse Organizations
      if (results[0].statusCode == 200 && results[0].data != null) {
        final list = results[0].data as List<dynamic>;
        _organizations = list.map((o) => OrganizationModel.fromJson(o as Map<String, dynamic>)).toList();
      }

      // 2. Parse Branches
      if (results[1].statusCode == 200 && results[1].data != null) {
        final list = results[1].data as List<dynamic>;
        _allBranches = list.map((b) => BranchModel.fromJson(b as Map<String, dynamic>)).toList();
      }

      // 3. Restore or set selected Organization
      final savedOrgStr = await _storage.read(key: 'active_organization_id');
      final targetOrgId = savedOrgStr != null ? int.tryParse(savedOrgStr) : defaultOrgId;

      if (targetOrgId != null && targetOrgId > 0) {
        _selectedOrganization = _organizations.where((o) => o.id == targetOrgId).firstOrNull;
      }
      _selectedOrganization ??= _organizations.firstOrNull;

      // 4. Restore or set selected Branch (always pick a real branch)
      final savedBranchStr = await _storage.read(key: 'active_branch_id');
      final targetBranchId = savedBranchStr != null ? int.tryParse(savedBranchStr) : defaultBranchId;

      final validBranches = branchesForSelectedOrg;
      if (targetBranchId != null && targetBranchId > 0) {
        _selectedBranch = validBranches.where((b) => b.id == targetBranchId).firstOrNull;
      }
      _selectedBranch ??= validBranches.firstOrNull;

      if (_selectedBranch != null) {
        await _storage.write(key: 'active_branch_id', value: _selectedBranch!.id.toString());
      }
    } catch (e) {
      debugPrint('[BranchProvider] fetchCompaniesAndBranches error: $e');
      _error = 'Failed to load companies and branches.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> selectOrganization(OrganizationModel org) async {
    _selectedOrganization = org;
    await _storage.write(key: 'active_organization_id', value: org.id.toString());

    // Switch branch to the first branch belonging to this company
    final validBranches = branchesForSelectedOrg;
    _selectedBranch = validBranches.firstOrNull;
    if (_selectedBranch != null) {
      await _storage.write(key: 'active_branch_id', value: _selectedBranch!.id.toString());
    } else {
      await _storage.delete(key: 'active_branch_id');
    }

    notifyListeners();
  }

  Future<void> selectBranch(BranchModel branch) async {
    _selectedBranch = branch;
    await _storage.write(key: 'active_branch_id', value: branch.id.toString());

    if (branch.organizationId != null) {
      final matchingOrg = _organizations.where((o) => o.id == branch.organizationId).firstOrNull;
      if (matchingOrg != null) {
        _selectedOrganization = matchingOrg;
        await _storage.write(key: 'active_organization_id', value: matchingOrg.id.toString());
      }
    }

    notifyListeners();
  }
}
