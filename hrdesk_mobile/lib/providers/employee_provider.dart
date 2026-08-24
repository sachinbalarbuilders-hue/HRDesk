import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/employee_profile_model.dart';

class EmployeeProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  EmployeeProfileModel? _profile;
  List<DirectoryEmployeeItem> _directory = [];
  String _searchQuery = '';
  String? _selectedDepartment;

  bool get loading => _loading;
  String? get error => _error;
  EmployeeProfileModel? get profile => _profile;
  List<DirectoryEmployeeItem> get directory => _directory;
  String get searchQuery => _searchQuery;
  String? get selectedDepartment => _selectedDepartment;

  List<DirectoryEmployeeItem> get filteredDirectory {
    return _directory.where((emp) {
      final matchesSearch = _searchQuery.isEmpty ||
          emp.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (emp.designation ?? '').toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (emp.code ?? '').toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesDept = _selectedDepartment == null ||
          _selectedDepartment!.isEmpty ||
          _selectedDepartment == 'All' ||
          emp.department == _selectedDepartment;
      return matchesSearch && matchesDept;
    }).toList();
  }

  Set<String> get departments {
    final set = <String>{'All'};
    for (var emp in _directory) {
      if (emp.department != null && emp.department!.isNotEmpty) {
        set.add(emp.department!);
      }
    }
    return set;
  }

  void setSearchQuery(String q) {
    _searchQuery = q;
    notifyListeners();
  }

  void setSelectedDepartment(String? dept) {
    _selectedDepartment = dept;
    notifyListeners();
  }

  Future<void> fetchMyProfile({int? employeeId}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final endpoint = employeeId != null ? '/employees/$employeeId' : '/employees/me';
      final response = await _api.dio.get(endpoint);
      if (response.statusCode == 200 && response.data != null) {
        _profile = EmployeeProfileModel.fromJson(response.data);
      }
    } catch (e) {
      debugPrint('[EmployeeProvider] fetchMyProfile error: $e');
      _error = 'Failed to load employee profile.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchDirectory() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get('/employees', queryParameters: {'pageSize': 200});
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<DirectoryEmployeeItem> list = [];
        if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((e) => DirectoryEmployeeItem.fromJson(e as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((e) => DirectoryEmployeeItem.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        _directory = list;
      }
    } catch (e) {
      debugPrint('[EmployeeProvider] fetchDirectory error: $e');
      _error = 'Failed to load company directory.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
