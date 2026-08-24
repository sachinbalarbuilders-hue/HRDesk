import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/loan_model.dart';

class LoanProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  List<LoanModel> _myLoans = [];
  List<LoanTypeModel> _loanTypes = [];

  bool get loading => _loading;
  String? get error => _error;
  List<LoanModel> get myLoans => _myLoans;
  List<LoanTypeModel> get loanTypes => _loanTypes;

  LoanModel? get activeLoan {
    try {
      return _myLoans.firstWhere(
        (l) => l.status == 'Active' || l.status == 'Approved',
      );
    } catch (_) {
      return _myLoans.isNotEmpty ? _myLoans.first : null;
    }
  }

  Future<void> fetchAllLoanData({int? employeeId}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      await Future.wait([
        fetchMyLoans(employeeId: employeeId),
        fetchLoanTypes(),
      ]);
    } catch (e) {
      _error = 'Failed to load loan data.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchMyLoans({int? employeeId}) async {
    try {
      final response = await _api.dio.get('/loans');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<LoanModel> list = [];
        if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((l) => LoanModel.fromJson(l as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((l) => LoanModel.fromJson(l as Map<String, dynamic>))
              .toList();
        }
        _myLoans = list;
      }
    } catch (e) {
      debugPrint('[LoanProvider] fetchMyLoans error: $e');
    }
  }

  Future<void> fetchLoanTypes() async {
    try {
      final response = await _api.dio.get('/loans/types');
      if (response.statusCode == 200 && response.data is List) {
        _loanTypes = (response.data as List)
            .map((t) => LoanTypeModel.fromJson(t as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('[LoanProvider] fetchLoanTypes error: $e');
    }
  }

  Future<bool> applyLoan({
    required int employeeId,
    required int loanTypeId,
    required double principalAmount,
    required int tenureMonths,
    required String startDate,
    String? reason,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.post('/loans/apply', data: {
        'employeeId': employeeId,
        'loanTypeId': loanTypeId,
        'principalAmount': principalAmount,
        'tenureMonths': tenureMonths,
        'startDate': startDate,
        'reason': reason ?? '',
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchMyLoans(employeeId: employeeId);
        return true;
      } else {
        _error = response.data?['message'] ?? 'Failed to submit loan application.';
        return false;
      }
    } catch (e) {
      if (e is DioException) {
        _error = e.response?.data?['message'] ?? 'Error submitting loan application.';
      } else {
        _error = 'Error: $e';
      }
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
