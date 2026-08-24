class EmployeeProfileModel {
  final int employeeId;
  final String employeeName;
  final String? employeeCode;
  final String? designation;
  final String? department;
  final String? branch;
  final String? branchCode;
  final String? branchAddress;
  final String? organizationName;
  final String? organizationAddress;
  final String? phone;
  final String? email;
  final String? personalEmail;
  final String? gender;
  final String? bloodGroup;
  final String? maritalStatus;
  final String? nationality;
  final String? dateOfBirth;
  final String? joiningDate;
  final String? resignationDate;
  final String? lastWorkingDate;
  final String? status;
  final String? weekoff;
  final String? shiftName;
  final String? shiftTiming;
  final String? reportingManagerName;
  final String? currentAddress;
  final String? permanentAddress;
  final String? employmentType;
  final String? attendanceType;
  final bool hasProbation;
  final int? probationDays;
  final int? contractDurationMonths;
  final String? contractEndDate;
  final String? photoBase64;
  final bool hasFaceEnrolled;

  EmployeeProfileModel({
    required this.employeeId,
    required this.employeeName,
    this.employeeCode,
    this.designation,
    this.department,
    this.branch,
    this.branchCode,
    this.branchAddress,
    this.organizationName,
    this.organizationAddress,
    this.phone,
    this.email,
    this.personalEmail,
    this.gender,
    this.bloodGroup,
    this.maritalStatus,
    this.nationality,
    this.dateOfBirth,
    this.joiningDate,
    this.resignationDate,
    this.lastWorkingDate,
    this.status,
    this.weekoff,
    this.shiftName,
    this.shiftTiming,
    this.reportingManagerName,
    this.currentAddress,
    this.permanentAddress,
    this.employmentType,
    this.attendanceType,
    this.hasProbation = false,
    this.probationDays,
    this.contractDurationMonths,
    this.contractEndDate,
    this.photoBase64,
    this.hasFaceEnrolled = false,
  });

  factory EmployeeProfileModel.fromJson(Map<String, dynamic> json) {
    return EmployeeProfileModel(
      employeeId: (json['employeeId'] ?? json['id'] ?? 0) as int,
      employeeName: json['employeeName'] ?? json['name'] ?? '',
      employeeCode: json['employeeCode'] ?? json['code'] ?? 'EMP#${json['employeeId']}',
      designation: json['designation']?['designationName'] ?? json['designationName'] ?? json['designation']?.toString(),
      department: json['department']?['departmentName'] ?? json['departmentName'] ?? json['department']?.toString(),
      branch: json['branch']?['name'] ?? json['branchName'] ?? json['branch']?.toString(),
      branchCode: json['branchCode']?.toString(),
      branchAddress: json['branchAddress']?.toString(),
      organizationName: json['organizationName']?.toString(),
      organizationAddress: json['organizationAddress']?.toString(),
      phone: json['phone'] ?? json['mobileNumber'] ?? json['contactNumber'],
      email: json['workEmail'] ?? json['email'] ?? json['officialEmail'],
      personalEmail: json['personalEmail'],
      gender: json['gender'],
      bloodGroup: json['bloodGroup'],
      maritalStatus: json['maritalStatus'],
      nationality: json['nationality'],
      dateOfBirth: json['dateOfBirth']?.toString().split('T').first,
      joiningDate: json['joiningDate']?.toString().split('T').first,
      resignationDate: json['resignationDate']?.toString().split('T').first,
      lastWorkingDate: json['lastWorkingDate']?.toString().split('T').first,
      status: json['status'],
      weekoff: json['weekoff'],
      shiftName: json['shiftName'] ?? json['shift']?['shiftName'],
      shiftTiming: json['shiftTiming'] ?? (json['shiftStart'] != null && json['shiftEnd'] != null ? '${json['shiftStart']} - ${json['shiftEnd']}' : null),
      reportingManagerName: json['reportingManager']?['employeeName'] ?? json['reportingManager']?.toString() ?? json['managerName'],
      currentAddress: json['currentAddress'] ?? json['address'],
      permanentAddress: json['permanentAddress'],
      employmentType: json['employmentType'],
      attendanceType: json['attendanceType'],
      hasProbation: json['hasProbation'] == true,
      probationDays: (json['probationDays'] as num?)?.toInt(),
      contractDurationMonths: (json['contractDurationMonths'] as num?)?.toInt(),
      contractEndDate: json['contractEndDate']?.toString().split('T').first,
      photoBase64: json['photoBase64'] ?? json['photoData'] ?? json['photoPath'],
      hasFaceEnrolled: json['faceId'] != null || json['isFaceEnrolled'] == true || json['hasFaceEnrolled'] == true,
    );
  }
}

class DirectoryEmployeeItem {
  final int employeeId;
  final String name;
  final String? code;
  final String? designation;
  final String? department;
  final String? branch;
  final String? phone;
  final String? email;
  final String? photoBase64;

  DirectoryEmployeeItem({
    required this.employeeId,
    required this.name,
    this.code,
    this.designation,
    this.department,
    this.branch,
    this.phone,
    this.email,
    this.photoBase64,
  });

  factory DirectoryEmployeeItem.fromJson(Map<String, dynamic> json) {
    return DirectoryEmployeeItem(
      employeeId: (json['employeeId'] ?? json['id'] ?? 0) as int,
      name: json['employeeName'] ?? json['name'] ?? '',
      code: json['employeeCode'] ?? json['code'],
      designation: json['designation']?['designationName'] ?? json['designationName'] ?? json['designation']?.toString(),
      department: json['department']?['departmentName'] ?? json['departmentName'] ?? json['department']?.toString(),
      branch: json['branch']?['name'] ?? json['branchName'] ?? json['branch']?.toString(),
      phone: json['phone'] ?? json['mobileNumber'],
      email: json['workEmail'] ?? json['email'] ?? json['officialEmail'],
      photoBase64: json['photoBase64'] ?? json['photoData'] ?? json['photoPath'],
    );
  }
}
