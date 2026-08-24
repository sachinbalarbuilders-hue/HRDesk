import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/holiday_model.dart';

class HolidayProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  List<HolidayModel> _holidays = [];

  bool get loading => _loading;
  String? get error => _error;
  List<HolidayModel> get holidays => _holidays;

  HolidayModel? get nextUpcomingHoliday {
    final now = DateTime.now();
    final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
    try {
      return _holidays.firstWhere((h) => h.date.compareTo(todayStr) >= 0);
    } catch (_) {
      return _holidays.isNotEmpty ? _holidays.first : null;
    }
  }

  Future<void> fetchHolidays({int? year}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final targetYear = year ?? DateTime.now().year;
      final response = await _api.dio.get('/holidays', queryParameters: {'year': targetYear});
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<HolidayModel> list = [];
        if (data is List) {
          list = data.map((h) => HolidayModel.fromJson(h as Map<String, dynamic>)).toList();
        } else if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((h) => HolidayModel.fromJson(h as Map<String, dynamic>))
              .toList();
        }
        _holidays = list;
      }
    } catch (e) {
      debugPrint('[HolidayProvider] fetchHolidays error: $e');
      _error = 'Failed to load holiday calendar.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
