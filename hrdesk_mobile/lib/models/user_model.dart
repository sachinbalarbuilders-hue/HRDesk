class UserModel {
  final int id;
  final String username;
  final String? fullName;
  final String? role;
  final int? employeeId;
  final String? employeeCode;
  final String? attendanceType;
  final int? branchId;
  final String? branchName;
  final int? organizationId;
  final String? organizationName;
  final bool isFaceEnrolled;
  final String? faceId;
  final String token;

  const UserModel({
    required this.id,
    required this.username,
    this.fullName,
    this.role,
    this.employeeId,
    this.employeeCode,
    this.attendanceType,
    this.branchId,
    this.branchName,
    this.organizationId,
    this.organizationName,
    this.isFaceEnrolled = false,
    this.faceId,
    required this.token,
  });

  bool get requiresFace =>
      (attendanceType ?? '').toLowerCase().contains('face');

  bool get isGeoFencing =>
      (attendanceType ?? '').toLowerCase().contains('geo');

  bool get isBiometricOnly =>
      (attendanceType ?? '').toLowerCase().contains('biometric');

  bool get isIpRestricted =>
      (attendanceType ?? '').toLowerCase().contains('ip');

  bool get isWebOnly =>
      (attendanceType ?? '').toLowerCase().contains('web');

  bool get requiresLocation =>
      requiresFace ||
      isGeoFencing ||
      (attendanceType ?? '').toLowerCase().contains('location');

  String get locationPolicyDescription {
    final type = (attendanceType ?? '').toLowerCase();
    if (type.contains('geo')) {
      return 'Office Geofence (100m Radius)';
    } else if (type.contains('face') && type.contains('location')) {
      return 'Face Recognition + GPS Location';
    } else if (type.contains('face')) {
      return 'Face Recognition Attendance';
    } else if (type.contains('ip')) {
      return 'Office Wi-Fi IP Restricted';
    } else if (type.contains('biometric')) {
      return 'Biometric Device Punch';
    } else if (type.contains('web')) {
      return 'Web Clock-in Only';
    }
    return attendanceType ?? 'Standard Office Branch';
  }

  factory UserModel.fromJson(Map<String, dynamic> json, String token) {
    // /api/auth/me wraps the user object under a "user" key
    final u = json['user'] as Map<String, dynamic>? ?? json;
    return UserModel(
      id: u['id'] ?? 0,
      username: u['username'] ?? '',
      fullName: u['fullName'],
      role: u['roleName'] ?? u['role'],
      employeeId: u['employeeId'],
      employeeCode: u['employeeCode'],
      attendanceType: u['attendanceType'],
      branchId: u['branchId'],
      organizationId: u['organizationId'],
      isFaceEnrolled: u['isFaceEnrolled'] == true,
      faceId: u['faceId'],
      token: token,
    );
  }
}
