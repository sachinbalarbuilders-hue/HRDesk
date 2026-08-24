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

  bool get loading => _loading;
  String? get error => _error;
  MonthlyAttendanceSummary get summary => _summary;
  List<AttendanceDayItem> get monthDays => _monthDays;
  int get selectedYear => _selectedYear;
  int get selectedMonth => _selectedMonth;

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

  void changeMonth(int delta, {int? employeeId}) {
    var newMonth = _selectedMonth + delta;
    var newYear = _selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    fetchAttendance(employeeId: employeeId, year: newYear, month: newMonth);
  }
}
