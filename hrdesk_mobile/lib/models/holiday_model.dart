class HolidayModel {
  final int id;
  final String title;
  final String date;
  final String? dayName;
  final String? type; // 'Mandatory', 'Restricted', 'Optional'
  final String? description;

  HolidayModel({
    required this.id,
    required this.title,
    required this.date,
    this.dayName,
    this.type = 'Mandatory',
    this.description,
  });

  factory HolidayModel.fromJson(Map<String, dynamic> json) {
    return HolidayModel(
      id: (json['holidayId'] ?? json['id'] ?? 0) as int,
      title: json['title'] ?? json['name'] ?? 'Holiday',
      date: json['holidayDate']?.toString().split('T').first ?? json['date']?.toString().split('T').first ?? '',
      dayName: json['dayOfWeek'] ?? json['dayName'],
      type: json['type'] ?? 'Mandatory',
      description: json['description'],
    );
  }
}
