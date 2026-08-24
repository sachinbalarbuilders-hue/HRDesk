class RegularizationItemModel {
  final int id;
  final int employeeId;
  final String employeeName;
  final String requestDate;
  final String requestType;
  final String punchTarget;
  final String? punchTimeIn;
  final String? punchTimeOut;
  final String? reason;
  final String status;
  final String? rejectionReason;
  final String? createdAt;

  RegularizationItemModel({
    required this.id,
    required this.employeeId,
    this.employeeName = '',
    required this.requestDate,
    this.requestType = 'Missed Punch',
    this.punchTarget = 'both',
    this.punchTimeIn,
    this.punchTimeOut,
    this.reason,
    this.status = 'Pending',
    this.rejectionReason,
    this.createdAt,
  });

  factory RegularizationItemModel.fromJson(Map<String, dynamic> json) {
    return RegularizationItemModel(
      id: (json['id'] ?? json['regularizationId'] ?? 0) as int,
      employeeId: (json['employeeId'] ?? 0) as int,
      employeeName: json['employee']?['employeeName'] ?? json['employeeName'] ?? '',
      requestDate: json['requestDate']?.toString().split('T').first ?? '',
      requestType: json['requestType'] ?? 'Missed Punch',
      punchTarget: json['punchTarget'] ?? 'both',
      punchTimeIn: json['punchTimeIn'] ?? json['inTime'],
      punchTimeOut: json['punchTimeOut'] ?? json['outTime'],
      reason: json['reason'],
      status: json['status'] ?? 'Pending',
      rejectionReason: json['rejectionReason'] ?? json['remarks'],
      createdAt: json['createdAt']?.toString().split('T').first,
    );
  }
}
