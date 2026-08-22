class UserModel {
  final int id;
  final String username;
  final String? fullName;
  final String? role;
  final int? employeeId;
  final String? employeeCode;
  final String? attendanceType;
  final int? branchId;
  final int? organizationId;
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
    this.organizationId,
    this.isFaceEnrolled = false,
    this.faceId,
    required this.token,
  });

  bool get requiresFace =>
      (attendanceType ?? '').toLowerCase().contains('face');

  bool get requiresLocation =>
      requiresFace ||
      (attendanceType ?? '').toLowerCase().contains('geo') ||
      (attendanceType ?? '').toLowerCase().contains('location');

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
