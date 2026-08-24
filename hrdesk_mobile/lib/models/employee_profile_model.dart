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
      employeeId: (json['employeeId'] ?? json['EmployeeId'] ?? json['id'] ?? 0) as int,
      employeeName: (json['employeeName'] ?? json['EmployeeName'] ?? json['name'] ?? '').toString(),
      employeeCode: (json['employeeCode'] ?? json['EmployeeCode'] ?? json['code'] ?? 'EMP#${json['employeeId']}').toString(),
      designation: json['designation'] is Map ? json['designation']['designationName'] : (json['designation'] ?? json['Designation'] ?? json['designationName'])?.toString(),
      department: json['department'] is Map ? json['department']['departmentName'] : (json['department'] ?? json['Department'] ?? json['departmentName'])?.toString(),
      branch: json['branch'] is Map ? json['branch']['name'] : (json['branch'] ?? json['Branch'] ?? json['branchName'])?.toString(),
      branchCode: (json['branchCode'] ?? json['BranchCode'])?.toString(),
      branchAddress: (json['branchAddress'] ?? json['BranchAddress'])?.toString(),
      organizationName: (json['organizationName'] ?? json['OrganizationName'])?.toString(),
      organizationAddress: (json['organizationAddress'] ?? json['OrganizationAddress'])?.toString(),
      phone: (json['phone'] ?? json['Phone'] ?? json['mobileNumber'] ?? json['contactNumber'])?.toString(),
      email: (json['workEmail'] ?? json['WorkEmail'] ?? json['email'] ?? json['officialEmail'])?.toString(),
      personalEmail: (json['personalEmail'] ?? json['PersonalEmail'])?.toString(),
      gender: (json['gender'] ?? json['Gender'])?.toString(),
      bloodGroup: (json['bloodGroup'] ?? json['BloodGroup'])?.toString(),
      maritalStatus: (json['maritalStatus'] ?? json['MaritalStatus'])?.toString(),
      nationality: (json['nationality'] ?? json['Nationality'])?.toString(),
      dateOfBirth: json['dateOfBirth']?.toString().split('T').first ?? json['DateOfBirth']?.toString().split('T').first,
      joiningDate: json['joiningDate']?.toString().split('T').first ?? json['JoiningDate']?.toString().split('T').first,
      resignationDate: json['resignationDate']?.toString().split('T').first ?? json['ResignationDate']?.toString().split('T').first,
      lastWorkingDate: json['lastWorkingDate']?.toString().split('T').first ?? json['LastWorkingDate']?.toString().split('T').first,
      status: (json['status'] ?? json['Status'])?.toString(),
      weekoff: (json['weekoff'] ?? json['Weekoff'])?.toString(),
      shiftName: (json['shiftName'] ?? json['ShiftName'] ?? (json['shift'] is Map ? json['shift']['shiftName'] : null))?.toString(),
      shiftTiming: (json['shiftTiming'] ?? json['ShiftTiming'] ?? ((json['shiftStart'] != null && json['shiftEnd'] != null) ? '${json['shiftStart']} - ${json['shiftEnd']}' : null))?.toString(),
      reportingManagerName: (json['reportingManager'] is Map ? json['reportingManager']['employeeName'] : (json['reportingManager'] ?? json['ReportingManager'] ?? json['managerName']))?.toString(),
      currentAddress: (json['currentAddress'] ?? json['CurrentAddress'] ?? json['address'])?.toString(),
      permanentAddress: (json['permanentAddress'] ?? json['PermanentAddress'])?.toString(),
      employmentType: (json['employmentType'] ?? json['EmploymentType'])?.toString(),
      attendanceType: (json['attendanceType'] ?? json['AttendanceType'])?.toString(),
      hasProbation: json['hasProbation'] == true || json['HasProbation'] == true,
      probationDays: (json['probationDays'] ?? json['ProbationDays'] as num?)?.toInt(),
      contractDurationMonths: (json['contractDurationMonths'] ?? json['ContractDurationMonths'] as num?)?.toInt(),
      contractEndDate: json['contractEndDate']?.toString().split('T').first ?? json['ContractEndDate']?.toString().split('T').first,
      photoBase64: (json['photoBase64'] ?? json['photoData'] ?? json['photoPath'] ?? json['PhotoPath'])?.toString(),
      hasFaceEnrolled: json['faceId'] != null || json['FaceId'] != null || json['isFaceEnrolled'] == true || json['hasFaceEnrolled'] == true,
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
      employeeId: (json['employeeId'] ?? json['EmployeeId'] ?? json['id'] ?? 0) as int,
      name: (json['employeeName'] ?? json['EmployeeName'] ?? json['name'] ?? '').toString(),
      code: (json['employeeCode'] ?? json['EmployeeCode'] ?? json['code'])?.toString(),
      designation: json['designation'] is Map ? json['designation']['designationName'] : (json['designation'] ?? json['Designation'] ?? json['designationName'])?.toString(),
      department: json['department'] is Map ? json['department']['departmentName'] : (json['department'] ?? json['Department'] ?? json['departmentName'])?.toString(),
      branch: json['branch'] is Map ? json['branch']['name'] : (json['branch'] ?? json['Branch'] ?? json['branchName'])?.toString(),
      phone: (json['phone'] ?? json['Phone'] ?? json['mobileNumber'])?.toString(),
      email: (json['workEmail'] ?? json['WorkEmail'] ?? json['email'] ?? json['officialEmail'])?.toString(),
      photoBase64: (json['photoBase64'] ?? json['photoData'] ?? json['photoPath'] ?? json['PhotoPath'])?.toString(),
    );
  }
}

