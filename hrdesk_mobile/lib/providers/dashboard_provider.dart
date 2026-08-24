import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/dashboard_model.dart';

class DashboardProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<TeamMemberTodayModel> _myTeam = [];
  List<AnnouncementModel> _announcements = [];
  List<CelebrationModel> _celebrations = [];

  bool _loading = false;
  String? _error;

  List<TeamMemberTodayModel> get myTeam => _myTeam;
  List<AnnouncementModel> get announcements => _announcements;
  List<CelebrationModel> get celebrations => _celebrations;
  bool get loading => _loading;
  String? get error => _error;

  int get teamPresentCount => _myTeam.where((m) => m.isPresent).length;
  int get teamTotalCount => _myTeam.length;

  Future<void> fetchDashboardOverview({int? branchId}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get(
        '/dashboard/overview',
        queryParameters: {
          if (branchId != null && branchId > 0) 'branchId': branchId,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;

        // 1. My Team
        if (data['myTeam'] is List) {
          final list = data['myTeam'] as List<dynamic>;
          _myTeam = list.map((t) => TeamMemberTodayModel.fromJson(t as Map<String, dynamic>)).toList();
        }

        // 2. Announcements
        if (data['announcements'] is List) {
          final list = data['announcements'] as List<dynamic>;
          _announcements = list.map((a) => AnnouncementModel.fromJson(a as Map<String, dynamic>)).toList();
        }

        // 3. Celebrations
        _celebrations = [];
        if (data['celebrations'] is Map<String, dynamic>) {
          final cel = data['celebrations'] as Map<String, dynamic>;
          if (cel['birthdays'] is List) {
            _celebrations.addAll((cel['birthdays'] as List).map((b) => CelebrationModel.fromJson(b as Map<String, dynamic>)));
          }
          if (cel['anniversaries'] is List) {
            _celebrations.addAll((cel['anniversaries'] as List).map((a) => CelebrationModel.fromJson(a as Map<String, dynamic>)));
          }
          if (cel['newJoiners'] is List) {
            _celebrations.addAll((cel['newJoiners'] as List).map((n) => CelebrationModel.fromJson(n as Map<String, dynamic>)));
          }
        }
      }
    } catch (e) {
      debugPrint('[DashboardProvider] fetchDashboardOverview error: $e');
      _error = 'Failed to load homepage overview.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
