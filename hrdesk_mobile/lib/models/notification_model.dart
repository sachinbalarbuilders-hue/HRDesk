class InAppNotificationModel {
  final int id;
  final String title;
  final String message;
  final String type; // 'Attendance', 'Leave', 'Loan', 'Regularization', 'General'
  final bool isRead;
  final String createdAt;

  InAppNotificationModel({
    required this.id,
    required this.title,
    required this.message,
    this.type = 'General',
    this.isRead = false,
    required this.createdAt,
  });

  factory InAppNotificationModel.fromJson(Map<String, dynamic> json) {
    return InAppNotificationModel(
      id: (json['id'] ?? json['notificationId'] ?? 0) as int,
      title: json['title'] ?? 'Notification',
      message: json['message'] ?? json['content'] ?? '',
      type: json['type'] ?? json['category'] ?? 'General',
      isRead: (json['isRead'] ?? false) as bool,
      createdAt: json['createdAt']?.toString().split('T').first ?? '',
    );
  }
}
