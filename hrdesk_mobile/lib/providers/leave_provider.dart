import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/leave_model.dart';

class LeaveProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  List<LeaveBalanceModel> _balances = [];
  List<LeaveTypeModel> _leaveTypes = [];
  List<LeaveApplicationModel> _myApplications = [];
  final List<LeaveApplicationModel> _teamApplications = [];

  bool get loading => _loading;
  String? get error => _error;
  List<LeaveBalanceModel> get balances => _balances;
  List<LeaveTypeModel> get leaveTypes => _leaveTypes;
  List<LeaveApplicationModel> get myApplications => _myApplications;
  List<LeaveApplicationModel> get teamApplications => _teamApplications;

  Future<void> fetchAllLeaveData({int? employeeId}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await Future.wait([
        fetchBalances(employeeId: employeeId),
        fetchLeaveTypes(employeeId: employeeId),
        fetchMyApplications(employeeId: employeeId),
      ]);
    } catch (e) {
      _error = 'Failed to load leave information.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchBalances({int? employeeId}) async {
    try {
      final response = await _api.dio.get(
        '/leaves/balances',
        queryParameters: ifNotNull({'employeeId': employeeId}),
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<LeaveBalanceModel> list = [];
        if (data is Map && data['balances'] is List) {
          list = (data['balances'] as List)
              .map((b) => LeaveBalanceModel.fromJson(b as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((b) => LeaveBalanceModel.fromJson(b as Map<String, dynamic>))
              .toList();
        }
        _balances = list;
      }
    } catch (e) {
      debugPrint('[LeaveProvider] fetchBalances error: $e');
    }
  }

  Future<void> fetchLeaveTypes({int? employeeId}) async {
    try {
      final response = await _api.dio.get(
        '/leaves/types',
        queryParameters: ifNotNull({'employeeId': employeeId}),
      );

      if (response.statusCode == 200 && response.data is List) {
        _leaveTypes = (response.data as List)
            .map((t) => LeaveTypeModel.fromJson(t as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('[LeaveProvider] fetchLeaveTypes error: $e');
    }
  }

  Future<void> fetchMyApplications({int? employeeId}) async {
    try {
      final response = await _api.dio.get(
        '/leaves/my-applications',
        queryParameters: ifNotNull({'employeeId': employeeId}),
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<LeaveApplicationModel> list = [];
        if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((a) => LeaveApplicationModel.fromJson(a as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((a) => LeaveApplicationModel.fromJson(a as Map<String, dynamic>))
              .toList();
        }
        _myApplications = list;
      }
    } catch (e) {
      debugPrint('[LeaveProvider] fetchMyApplications error: $e');
    }
  }

  Future<bool> applyLeave({
    int? employeeId,
    required int leaveTypeId,
    required String startDate,
    required String endDate,
    required String dayType,
    String? reason,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.post('/leaves/apply', data: {
        if (employeeId != null) 'employeeId': employeeId,
        'leaveTypeId': leaveTypeId,
        'startDate': startDate,
        'endDate': endDate,
        'dayType': dayType,
        'reason': reason ?? '',
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchAllLeaveData(employeeId: employeeId);
        return true;
      } else {
        _error = response.data?['message'] ?? 'Failed to apply leave.';
        return false;
      }
    } catch (e) {
      if (e is DioException) {
        _error = e.response?.data?['message'] ?? 'Error applying leave.';
      } else {
        _error = 'Error applying leave: $e';
      }
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Map<String, dynamic>? ifNotNull(Map<String, dynamic> map) {
    map.removeWhere((key, value) => value == null);
    return map.isEmpty ? null : map;
  }
}
