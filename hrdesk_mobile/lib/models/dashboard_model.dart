class TeamMemberTodayModel {
  final int employeeId;
  final String employeeName;
  final String department;
  final String designation;
  final String? inTime;
  final String? outTime;
  final String status;
  final bool isLate;
  final String? photoUrl;
  final String? phone;

  TeamMemberTodayModel({
    required this.employeeId,
    required this.employeeName,
    required this.department,
    required this.designation,
    this.inTime,
    this.outTime,
    required this.status,
    this.isLate = false,
    this.photoUrl,
    this.phone,
  });

  factory TeamMemberTodayModel.fromJson(Map<String, dynamic> json) {
    return TeamMemberTodayModel(
      employeeId: (json['employeeId'] ?? json['EmployeeId'] ?? 0) as int,
      employeeName: (json['employeeName'] ?? json['EmployeeName'] ?? 'Staff').toString(),
      department: (json['department'] ?? json['Department'] ?? 'General').toString(),
      designation: (json['designation'] ?? json['Designation'] ?? 'Staff').toString(),
      inTime: json['inTime']?.toString(),
      outTime: json['outTime']?.toString(),
      status: (json['status'] ?? json['Status'] ?? 'Not Checked In').toString(),
      isLate: (json['isLate'] ?? json['IsLate'] ?? false) as bool,
      photoUrl: json['photoUrl']?.toString(),
      phone: json['phone']?.toString(),
    );
  }

  bool get isPresent => inTime != null || status.toLowerCase() == 'present';
  bool get isOnLeave => status.toLowerCase().contains('leave');
}

class AnnouncementModel {
  final String id;
  final String title;
  final String message;
  final String category;
  final String date;
  final String priority;

  AnnouncementModel({
    required this.id,
    required this.title,
    required this.message,
    required this.category,
    required this.date,
    this.priority = 'Normal',
  });

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    return AnnouncementModel(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Notice').toString(),
      message: (json['message'] ?? '').toString(),
      category: (json['category'] ?? 'General').toString(),
      date: (json['date'] ?? '').toString(),
      priority: (json['priority'] ?? 'Normal').toString(),
    );
  }
}

class CelebrationModel {
  final int employeeId;
  final String employeeName;
  final String department;
  final int day;
  final int? years;
  final String type; // "Birthday" or "Work Anniversary"
  final String? photoUrl;

  CelebrationModel({
    required this.employeeId,
    required this.employeeName,
    required this.department,
    required this.day,
    this.years,
    required this.type,
    this.photoUrl,
  });

  factory CelebrationModel.fromJson(Map<String, dynamic> json) {
    return CelebrationModel(
      employeeId: (json['employeeId'] ?? json['EmployeeId'] ?? 0) as int,
      employeeName: (json['employeeName'] ?? json['EmployeeName'] ?? 'Staff').toString(),
      department: (json['department'] ?? json['Department'] ?? 'General').toString(),
      day: (json['day'] ?? json['Day'] ?? 1) as int,
      years: (json['years'] ?? json['Years']) as int?,
      type: (json['type'] ?? json['Type'] ?? 'Celebration').toString(),
      photoUrl: json['photoUrl']?.toString(),
    );
  }

  bool get isBirthday => type.toLowerCase().contains('birthday');
  bool get isToday => day == DateTime.now().day;
}
