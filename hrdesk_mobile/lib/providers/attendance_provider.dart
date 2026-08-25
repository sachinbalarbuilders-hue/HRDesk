import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/attendance_model.dart';

class AttendanceProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  MonthlyAttendanceSummary _summary = MonthlyAttendanceSummary();
  List<AttendanceDayItem> _monthDays = [];
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = DateTime.now().month;

  List<dynamic> _teamMatrixItems = [];
  int _teamDaysInMonth = 31;
  bool _teamLoading = false;
  bool _teamLoadingMore = false;
  String? _teamError;
  int _teamPage = 1;
  final int _teamPageSize = 25;
  int _teamTotalCount = 0;
  int _teamTotalPages = 1;

  bool get loading => _loading;
  String? get error => _error;
  MonthlyAttendanceSummary get summary => _summary;
  List<AttendanceDayItem> get monthDays => _monthDays;
  int get selectedYear => _selectedYear;
  int get selectedMonth => _selectedMonth;

  List<dynamic> get teamMatrixItems => _teamMatrixItems;
  int get teamDaysInMonth => _teamDaysInMonth;
  bool get teamLoading => _teamLoading;
  bool get teamLoadingMore => _teamLoadingMore;
  String? get teamError => _teamError;
  int get teamTotalCount => _teamTotalCount;
  int get teamPage => _teamPage;
  bool get hasMoreTeam => _teamPage < _teamTotalPages;

  Future<void> fetchAttendance({int? employeeId, int? year, int? month}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    _selectedYear = year ?? _selectedYear;
    _selectedMonth = month ?? _selectedMonth;

    try {
      final response = await _api.dio.get(
        '/attendance/my-monthly',
        queryParameters: {
          if (employeeId != null) 'employeeId': employeeId,
          'year': _selectedYear,
          'month': _selectedMonth,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          if (data['summary'] != null) {
            _summary = MonthlyAttendanceSummary.fromJson(data['summary']);
          }
          if (data['days'] != null && data['days'] is List) {
            _monthDays = (data['days'] as List)
                .map((d) => AttendanceDayItem.fromJson(d as Map<String, dynamic>))
                .toList();
          }
        }
      }
    } catch (e) {
      debugPrint('[AttendanceProvider] fetchAttendance error: $e');
      _error = 'Failed to load attendance sheet.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTeamMatrix({int? year, int? month, String? search, int? branchId, bool refresh = true}) async {
    if (refresh) {
      _teamLoading = true;
      _teamPage = 1;
      _teamMatrixItems = [];
    }
    _teamError = null;
    notifyListeners();

    _selectedYear = year ?? _selectedYear;
    _selectedMonth = month ?? _selectedMonth;

    try {
      final response = await _api.dio.get(
        '/attendance/monthly-sheet',
        queryParameters: {
          'year': _selectedYear,
          'month': _selectedMonth,
          if (search != null && search.isNotEmpty) 'search': search,
          if (branchId != null && branchId > 0) 'branchId': branchId,
          'page': _teamPage,
          'pageSize': _teamPageSize,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is Map<String, dynamic>) {
          _teamDaysInMonth = (data['daysInMonth'] as num?)?.toInt() ?? 31;
          _teamTotalCount = (data['totalCount'] as num?)?.toInt() ?? 0;
          _teamTotalPages = (data['totalPages'] as num?)?.toInt() ?? 1;
          final newItems = (data['items'] as List<dynamic>?) ?? [];
          if (refresh) {
            _teamMatrixItems = newItems;
          } else {
            _teamMatrixItems.addAll(newItems);
          }
        }
      }
    } catch (e) {
      debugPrint('[AttendanceProvider] fetchTeamMatrix error: $e');
      _teamError = 'Failed to load team attendance matrix.';
    } finally {
      _teamLoading = false;
      _teamLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreTeamMatrix({String? search, int? branchId}) async {
    if (_teamLoading || _teamLoadingMore || !hasMoreTeam) return;

    _teamLoadingMore = true;
    _teamPage++;
    notifyListeners();

    await fetchTeamMatrix(
      year: _selectedYear,
      month: _selectedMonth,
      search: search,
      branchId: branchId,
      refresh: false,
    );
  }

  Future<DayDetailsModel?> fetchDayDetails({required int employeeId, required String date}) async {
    try {
      final response = await _api.dio.get(
        '/attendance/day-details',
        queryParameters: {
          'employeeId': employeeId,
          'date': date,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        return DayDetailsModel.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('[AttendanceProvider] fetchDayDetails error: $e');
    }
    return null;
  }

  Future<void> changeMonth(int delta, {int? employeeId, String? search, int? branchId}) async {
    var newMonth = _selectedMonth + delta;
    var newYear = _selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    _selectedYear = newYear;
    _selectedMonth = newMonth;
    await Future.wait([
      fetchAttendance(employeeId: employeeId, year: newYear, month: newMonth),
      fetchTeamMatrix(year: newYear, month: newMonth, search: search, branchId: branchId, refresh: true),
    ]);
  }
}
