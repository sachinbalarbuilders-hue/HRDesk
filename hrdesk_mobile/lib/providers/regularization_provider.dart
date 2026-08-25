import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/regularization_model.dart';

class RegularizationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  bool _loadingMore = false;
  String? _error;
  List<RegularizationItemModel> _myRequests = [];
  int _page = 1;
  final int _pageSize = 20;
  int _totalCount = 0;
  int _totalPages = 1;

  bool get loading => _loading;
  bool get loadingMore => _loadingMore;
  String? get error => _error;
  List<RegularizationItemModel> get myRequests => _myRequests;
  int get page => _page;
  int get totalCount => _totalCount;
  bool get hasMore => _page < _totalPages;

  Future<void> fetchRegularizations({bool refresh = true, String? status}) async {
    if (refresh) {
      _loading = true;
      _page = 1;
      _myRequests = [];
    }
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get(
        '/regularizations',
        queryParameters: {
          'page': _page,
          'pageSize': _pageSize,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<RegularizationItemModel> list = [];
        if (data is Map && data['items'] is List) {
          _totalCount = (data['totalCount'] as num?)?.toInt() ?? 0;
          _totalPages = (data['totalPages'] as num?)?.toInt() ?? 1;
          list = (data['items'] as List)
              .map((r) => RegularizationItemModel.fromJson(r as Map<String, dynamic>))
              .toList();
        } else if (data is List) {
          list = data
              .map((r) => RegularizationItemModel.fromJson(r as Map<String, dynamic>))
              .toList();
          _totalCount = list.length;
          _totalPages = 1;
        }

        if (refresh) {
          _myRequests = list;
        } else {
          _myRequests.addAll(list);
        }
      }
    } catch (e) {
      debugPrint('[RegularizationProvider] fetchRegularizations error: $e');
      _error = 'Failed to load regularizations.';
    } finally {
      _loading = false;
      _loadingMore = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreRegularizations({String? status}) async {
    if (_loading || _loadingMore || !hasMore) return;

    _loadingMore = true;
    _page++;
    notifyListeners();

    await fetchRegularizations(refresh: false, status: status);
  }

  Future<bool> applyRegularization({
    required int employeeId,
    required String requestDate,
    required String requestType,
    required String punchTarget,
    String? punchTimeIn,
    String? punchTimeOut,
    String? reason,
    bool waivePenalty = true,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.post('/regularizations', data: {
        'employeeId': employeeId,
        'requestType': requestType,
        'waivePenalty': waivePenalty,
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
        await fetchRegularizations(refresh: true);
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
