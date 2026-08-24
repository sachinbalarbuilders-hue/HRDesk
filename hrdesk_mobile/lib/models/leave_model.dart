class LeaveTypeModel {
  final int id;
  final String code;
  final String name;
  final bool isPaid;
  final String? textColor;
  final String? backgroundColor;

  LeaveTypeModel({
    required this.id,
    required this.code,
    required this.name,
    this.isPaid = true,
    this.textColor,
    this.backgroundColor,
  });

  factory LeaveTypeModel.fromJson(Map<String, dynamic> json) {
    return LeaveTypeModel(
      id: (json['leaveTypeId'] ?? json['id'] ?? 0) as int,
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      isPaid: (json['isPaid'] ?? true) as bool,
      textColor: json['textColor'],
      backgroundColor: json['backgroundColor'],
    );
  }
}

class LeaveBalanceModel {
  final String leaveTypeCode;
  final String leaveTypeName;
  final double totalAllocated;
  final double used;
  final double remaining;

  LeaveBalanceModel({
    required this.leaveTypeCode,
    required this.leaveTypeName,
    this.totalAllocated = 0.0,
    this.used = 0.0,
    this.remaining = 0.0,
  });

  factory LeaveBalanceModel.fromJson(Map<String, dynamic> json) {
    return LeaveBalanceModel(
      leaveTypeCode: json['leaveTypeCode'] ?? json['code'] ?? 'CL',
      leaveTypeName: json['leaveTypeName'] ?? json['name'] ?? 'Leave',
      totalAllocated: ((json['totalAllocated'] ?? json['allocated'] ?? 0.0) as num).toDouble(),
      used: ((json['used'] ?? json['taken'] ?? 0.0) as num).toDouble(),
      remaining: ((json['remaining'] ?? json['balance'] ?? 0.0) as num).toDouble(),
    );
  }
}

class LeaveApplicationModel {
  final int id;
  final int employeeId;
  final String employeeName;
  final String leaveTypeCode;
  final String leaveTypeName;
  final String startDate;
  final String endDate;
  final double totalDays;
  final String dayType;
  final String? reason;
  final String status;
  final String? rejectionReason;
  final String? createdAt;

  LeaveApplicationModel({
    required this.id,
    required this.employeeId,
    this.employeeName = '',
    required this.leaveTypeCode,
    this.leaveTypeName = '',
    required this.startDate,
    required this.endDate,
    this.totalDays = 1.0,
    this.dayType = 'Full Day',
    this.reason,
    this.status = 'Pending',
    this.rejectionReason,
    this.createdAt,
  });

  factory LeaveApplicationModel.fromJson(Map<String, dynamic> json) {
    return LeaveApplicationModel(
      id: (json['id'] ?? json['leaveApplicationId'] ?? 0) as int,
      employeeId: (json['employeeId'] ?? 0) as int,
      employeeName: json['employee']?['employeeName'] ?? json['employeeName'] ?? '',
      leaveTypeCode: json['leaveType']?['code'] ?? json['leaveTypeCode'] ?? 'CL',
      leaveTypeName: json['leaveType']?['name'] ?? json['leaveTypeName'] ?? 'Casual Leave',
      startDate: json['startDate']?.toString().split('T').first ?? '',
      endDate: json['endDate']?.toString().split('T').first ?? '',
      totalDays: ((json['totalDays'] ?? 1.0) as num).toDouble(),
      dayType: json['dayType'] ?? 'Full Day',
      reason: json['reason'],
      status: json['status'] ?? 'Pending',
      rejectionReason: json['rejectionReason'] ?? json['remarks'],
      createdAt: json['createdAt']?.toString().split('T').first,
    );
  }
}
