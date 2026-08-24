import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/notification_model.dart';

class NotificationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _loading = false;
  String? _error;
  List<InAppNotificationModel> _notifications = [];

  bool get loading => _loading;
  String? get error => _error;
  List<InAppNotificationModel> get notifications => _notifications;

  int get unreadCount => _notifications.where((n) => !n.isRead).length;

  Future<void> fetchNotifications() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.dio.get('/notifications');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List<InAppNotificationModel> list = [];
        if (data is List) {
          list = data.map((n) => InAppNotificationModel.fromJson(n as Map<String, dynamic>)).toList();
        } else if (data is Map && data['items'] is List) {
          list = (data['items'] as List)
              .map((n) => InAppNotificationModel.fromJson(n as Map<String, dynamic>))
              .toList();
        }
        _notifications = list;
      }
    } catch (e) {
      debugPrint('[NotificationProvider] fetchNotifications error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> markAsRead(int notificationId) async {
    try {
      await _api.dio.post('/notifications/$notificationId/read');
      final index = _notifications.indexWhere((n) => n.id == notificationId);
      if (index != -1) {
        final current = _notifications[index];
        _notifications[index] = InAppNotificationModel(
          id: current.id,
          title: current.title,
          message: current.message,
          type: current.type,
          isRead: true,
          createdAt: current.createdAt,
        );
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[NotificationProvider] markAsRead error: $e');
    }
  }
}
