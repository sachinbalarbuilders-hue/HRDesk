import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/regularization_model.dart';

class RegularizationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  List<RegularizationItemModel> _myRequests = [];

  bool get loading => _loading;
  String? get error => _error;
  List<RegularizationItemModel> get myRequests => _myRequests;

  Future<void> fetchRegularizations() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get('/regularizations');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<RegularizationItemModel> list = [];
        if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((r) => RegularizationItemModel.fromJson(r as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((r) => RegularizationItemModel.fromJson(r as Map<String, dynamic>))
              .toList();
        }
        _myRequests = list;
      }
    } catch (e) {
      debugPrint('[RegularizationProvider] fetchRegularizations error: $e');
      _error = 'Failed to load regularizations.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> applyRegularization({
    required int employeeId,
    required String requestDate,
    required String requestType,
    required String punchTarget,
    String? punchTimeIn,
    String? punchTimeOut,
    String? reason,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.post('/regularizations', data: {
        'employeeId': employeeId,
        'requestType': requestType,
        'waivePenalty': false,
        'reason': reason ?? '',
        'items': [
          {
            'requestDate': requestDate,
            'punchTarget': punchTarget,
            'punchTimeIn': punchTimeIn,
            'punchTimeOut': punchTimeOut,
            'reason': reason ?? '',
          }
        ],
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchRegularizations();
        return true;
      } else {
        _error = response.data?['message'] ?? 'Failed to submit regularization.';
        return false;
      }
    } catch (e) {
      if (e is DioException) {
        _error = e.response?.data?['message'] ?? 'Error submitting regularization.';
      } else {
        _error = 'Error submitting regularization: $e';
      }
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
