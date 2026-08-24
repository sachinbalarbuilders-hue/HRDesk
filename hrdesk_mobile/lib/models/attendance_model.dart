class MonthlyAttendanceSummary {
  final double presentCount;
  final double absentCount;
  final double halfDayCount;
  final double weekoffCount;
  final double holidayCount;
  final double leaveCount;
  final double unpaidLeaveCount;
  final double payableDays;

  MonthlyAttendanceSummary({
    this.presentCount = 0.0,
    this.absentCount = 0.0,
    this.halfDayCount = 0.0,
    this.weekoffCount = 0.0,
    this.holidayCount = 0.0,
    this.leaveCount = 0.0,
    this.unpaidLeaveCount = 0.0,
    this.payableDays = 0.0,
  });

  factory MonthlyAttendanceSummary.fromJson(Map<String, dynamic> json) {
    return MonthlyAttendanceSummary(
      presentCount: ((json['presentCount'] ?? json['presentDays'] ?? 0) as num).toDouble(),
      absentCount: ((json['absentCount'] ?? json['absentDays'] ?? 0) as num).toDouble(),
      halfDayCount: ((json['halfDayCount'] ?? json['halfDays'] ?? 0) as num).toDouble(),
      weekoffCount: ((json['weekoffCount'] ?? json['weekOffs'] ?? 0) as num).toDouble(),
      holidayCount: ((json['holidayCount'] ?? json['holidays'] ?? 0) as num).toDouble(),
      leaveCount: ((json['leaveCount'] ?? json['paidLeaves'] ?? 0) as num).toDouble(),
      unpaidLeaveCount: ((json['unpaidLeaveCount'] ?? json['unpaidLeaves'] ?? 0) as num).toDouble(),
      payableDays: ((json['payableDays'] ?? 0.0) as num).toDouble(),
    );
  }
}

class AttendanceDayItem {
  final int day;
  final String date;
  final String dayOfWeek;
  final String fullDayOfWeek;
  final String status;
  final String? inTime;
  final String? outTime;
  final int workMinutes;
  final String workDuration;
  final bool isLate;
  final int lateMinutes;
  final bool isHalfDay;
  final bool hasLeave;
  final String? leaveType;
  final bool hasHoliday;
  final String? holidayName;

  AttendanceDayItem({
    required this.day,
    required this.date,
    required this.dayOfWeek,
    required this.fullDayOfWeek,
    required this.status,
    this.inTime,
    this.outTime,
    this.workMinutes = 0,
    required this.workDuration,
    this.isLate = false,
    this.lateMinutes = 0,
    this.isHalfDay = false,
    this.hasLeave = false,
    this.leaveType,
    this.hasHoliday = false,
    this.holidayName,
  });

  factory AttendanceDayItem.fromJson(Map<String, dynamic> json) {
    return AttendanceDayItem(
      day: (json['day'] as num?)?.toInt() ?? 0,
      date: json['date']?.toString() ?? '',
      dayOfWeek: json['dayOfWeek']?.toString() ?? '',
      fullDayOfWeek: json['fullDayOfWeek']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Absent',
      inTime: json['inTime']?.toString(),
      outTime: json['outTime']?.toString(),
      workMinutes: (json['workMinutes'] as num?)?.toInt() ?? 0,
      workDuration: json['workDuration']?.toString() ?? '--',
      isLate: json['isLate'] == true,
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      isHalfDay: json['isHalfDay'] == true,
      hasLeave: json['hasLeave'] == true,
      leaveType: json['leaveType']?.toString(),
      hasHoliday: json['hasHoliday'] == true,
      holidayName: json['holidayName']?.toString(),
    );
  }
}

class DayPunchItem {
  final dynamic longOrIntId;
  final String time;
  final String timeShort;
  final String punchType; // "In", "Out"
  final String verifyType; // "Biometric", "Face", "Mobile", "Web"
  final String machineNumber;
  final String? ipAddress;
  final double? latitude;
  final double? longitude;
  final bool? isGeofenceValid;
  final bool? isIpValid;
  final String? photoUrl;

  DayPunchItem({
    this.longOrIntId,
    required this.time,
    required this.timeShort,
    required this.punchType,
    required this.verifyType,
    required this.machineNumber,
    this.ipAddress,
    this.latitude,
    this.longitude,
    this.isGeofenceValid,
    this.isIpValid,
    this.photoUrl,
  });

  factory DayPunchItem.fromJson(Map<String, dynamic> json) {
    return DayPunchItem(
      longOrIntId: json['id'],
      time: json['time']?.toString() ?? '',
      timeShort: json['timeShort']?.toString() ?? '',
      punchType: json['punchType']?.toString() ?? 'In',
      verifyType: json['verifyType']?.toString() ?? 'Biometric',
      machineNumber: json['machineNumber']?.toString() ?? 'Biometric Device',
      ipAddress: json['ipAddress']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isGeofenceValid: json['isGeofenceValid'] as bool?,
      isIpValid: json['isIpValid'] as bool?,
      photoUrl: json['photoUrl']?.toString(),
    );
  }
}

class DayDetailsModel {
  final String date;
  final String formattedDate;
  final String status;
  final String? inTime;
  final String? outTime;
  final int workMinutes;
  final String workDurationFormatted;
  final int breakMinutes;
  final bool isLate;
  final int lateMinutes;
  final bool isEarly;
  final int earlyMinutes;
  final bool isHalfDay;
  final String? shiftName;
  final String? shiftStartTime;
  final String? shiftEndTime;
  final String? leaveType;
  final String? leaveReason;
  final String? holidayName;
  final List<DayPunchItem> punches;
  final int totalPunches;

  DayDetailsModel({
    required this.date,
    required this.formattedDate,
    required this.status,
    this.inTime,
    this.outTime,
    this.workMinutes = 0,
    required this.workDurationFormatted,
    this.breakMinutes = 0,
    this.isLate = false,
    this.lateMinutes = 0,
    this.isEarly = false,
    this.earlyMinutes = 0,
    this.isHalfDay = false,
    this.shiftName,
    this.shiftStartTime,
    this.shiftEndTime,
    this.leaveType,
    this.leaveReason,
    this.holidayName,
    this.punches = const [],
    this.totalPunches = 0,
  });

  factory DayDetailsModel.fromJson(Map<String, dynamic> json) {
    final shift = json['shift'] as Map<String, dynamic>?;
    final leave = json['leave'] as Map<String, dynamic>?;
    final holiday = json['holiday'] as Map<String, dynamic>?;
    final punchesList = (json['punches'] as List?)
            ?.map((p) => DayPunchItem.fromJson(p as Map<String, dynamic>))
            .toList() ??
        [];

    return DayDetailsModel(
      date: json['date']?.toString() ?? '',
      formattedDate: json['formattedDate']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Absent',
      inTime: json['inTime']?.toString(),
      outTime: json['outTime']?.toString(),
      workMinutes: (json['workMinutes'] as num?)?.toInt() ?? 0,
      workDurationFormatted: json['workDurationFormatted']?.toString() ?? '--',
      breakMinutes: (json['breakMinutes'] as num?)?.toInt() ?? 0,
      isLate: json['isLate'] == true,
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      isEarly: json['isEarly'] == true,
      earlyMinutes: (json['earlyMinutes'] as num?)?.toInt() ?? 0,
      isHalfDay: json['isHalfDay'] == true,
      shiftName: shift?['name']?.toString(),
      shiftStartTime: shift?['startTime']?.toString(),
      shiftEndTime: shift?['endTime']?.toString(),
      leaveType: leave?['type']?.toString(),
      leaveReason: leave?['reason']?.toString(),
      holidayName: holiday?['name']?.toString(),
      punches: punchesList,
      totalPunches: (json['totalPunches'] as num?)?.toInt() ?? punchesList.length,
    );
  }
}

class DailyAttendanceLog {
  final String date;
  final String? inTime;
  final String? outTime;
  final int workMinutes;
  final int breakMinutes;
  final String status;
  final bool isLate;
  final int lateMinutes;
  final bool isHalfDay;
  final String? shiftName;
  final String? locationName;
  final bool isGeofenceVerified;

  DailyAttendanceLog({
    required this.date,
    this.inTime,
    this.outTime,
    this.workMinutes = 0,
    this.breakMinutes = 0,
    this.status = 'Present',
    this.isLate = false,
    this.lateMinutes = 0,
    this.isHalfDay = false,
    this.shiftName,
    this.locationName,
    this.isGeofenceVerified = true,
  });

  factory DailyAttendanceLog.fromJson(Map<String, dynamic> json) {
    return DailyAttendanceLog(
      date: json['date']?.toString() ?? json['recordDate']?.toString() ?? '',
      inTime: json['inTime']?.toString(),
      outTime: json['outTime']?.toString(),
      workMinutes: (json['workMinutes'] as num?)?.toInt() ?? 0,
      breakMinutes: (json['breakMinutes'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'Present',
      isLate: json['isLate'] == true,
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      isHalfDay: json['isHalfDay'] == true,
      shiftName: json['shiftName']?.toString(),
      locationName: json['locationName']?.toString(),
      isGeofenceVerified: json['isGeofenceVerified'] == true,
    );
  }

  String get totalHoursFormatted {
    if (workMinutes <= 0) return '-';
    final hours = workMinutes ~/ 60;
    final mins = workMinutes % 60;
    return '${hours}h ${mins}m';
  }
}
