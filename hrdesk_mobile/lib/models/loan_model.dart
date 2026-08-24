class LoanTypeModel {
  final int id;
  final String name;
  final double maxAmount;
  final double interestRate;
  final int maxTenureMonths;

  LoanTypeModel({
    required this.id,
    required this.name,
    this.maxAmount = 50000.0,
    this.interestRate = 0.0,
    this.maxTenureMonths = 12,
  });

  factory LoanTypeModel.fromJson(Map<String, dynamic> json) {
    return LoanTypeModel(
      id: (json['loanTypeId'] ?? json['id'] ?? 0) as int,
      name: json['name'] ?? json['loanTypeName'] ?? 'Salary Advance',
      maxAmount: ((json['maxAmount'] ?? 50000.0) as num).toDouble(),
      interestRate: ((json['interestRate'] ?? 0.0) as num).toDouble(),
      maxTenureMonths: (json['maxTenureMonths'] ?? 12) as int,
    );
  }
}

class LoanScheduleItem {
  final int installmentNumber;
  final String dueDate;
  final double emiAmount;
  final double principalAmount;
  final String status; // 'Paid', 'Pending', 'Waived'

  LoanScheduleItem({
    required this.installmentNumber,
    required this.dueDate,
    required this.emiAmount,
    required this.principalAmount,
    this.status = 'Pending',
  });

  factory LoanScheduleItem.fromJson(Map<String, dynamic> json) {
    return LoanScheduleItem(
      installmentNumber: (json['installmentNumber'] ?? json['seq'] ?? 1) as int,
      dueDate: json['dueDate']?.toString().split('T').first ?? '',
      emiAmount: ((json['emiAmount'] ?? json['amount'] ?? 0.0) as num).toDouble(),
      principalAmount: ((json['principalAmount'] ?? 0.0) as num).toDouble(),
      status: json['status'] ?? 'Pending',
    );
  }
}

class LoanModel {
  final int id;
  final String loanNumber;
  final String loanTypeName;
  final double principalAmount;
  final double totalAmount;
  final double emiAmount;
  final int tenureMonths;
  final double balanceAmount;
  final double paidAmount;
  final String status; // 'Pending', 'Approved', 'Active', 'Completed', 'Rejected'
  final String startDate;
  final String? reason;
  final List<LoanScheduleItem> schedule;

  LoanModel({
    required this.id,
    required this.loanNumber,
    this.loanTypeName = 'Salary Advance',
    required this.principalAmount,
    required this.totalAmount,
    required this.emiAmount,
    required this.tenureMonths,
    this.balanceAmount = 0.0,
    this.paidAmount = 0.0,
    this.status = 'Pending',
    required this.startDate,
    this.reason,
    this.schedule = const [],
  });

  factory LoanModel.fromJson(Map<String, dynamic> json) {
    var rawSchedule = json['schedules'] ?? json['schedule'] ?? [];
    List<LoanScheduleItem> scheduleItems = [];
    if (rawSchedule is List) {
      scheduleItems = rawSchedule
          .map((s) => LoanScheduleItem.fromJson(s as Map<String, dynamic>))
          .toList();
    }

    final principal = ((json['principalAmount'] ?? json['amount'] ?? 0.0) as num).toDouble();
    final balance = ((json['remainingAmount'] ?? json['balanceAmount'] ?? json['remainingBalance'] ?? principal) as num).toDouble();
    final paid = ((json['paidAmount'] ?? (principal - balance)) as num).toDouble();

    final rawLoanType = json['loanType'];
    String typeName = 'Salary Advance';
    if (rawLoanType is Map) {
      typeName = rawLoanType['name']?.toString() ?? 'Salary Advance';
    } else if (rawLoanType is String && rawLoanType.isNotEmpty) {
      typeName = rawLoanType;
    } else if (json['loanTypeName'] != null) {
      typeName = json['loanTypeName'].toString();
    }

    final rawTenure = json['tenureMonths'] ?? json['installments'] ?? 6;
    final tenure = rawTenure is num ? rawTenure.toInt() : int.tryParse(rawTenure.toString()) ?? 6;

    final rawEmi = json['monthlyEmi'] ?? json['emiAmount'] ?? (tenure > 0 ? principal / tenure : 0.0);
    final emi = rawEmi is num ? rawEmi.toDouble() : double.tryParse(rawEmi.toString()) ?? 0.0;

    return LoanModel(
      id: (json['id'] ?? json['loanId'] ?? 0) as int,
      loanNumber: json['loanNumber'] ?? json['applicationNumber'] ?? json['appNumber'] ?? json['applicationNo'] ?? 'LN-001',
      loanTypeName: typeName,
      principalAmount: principal,
      totalAmount: ((json['totalAmount'] ?? principal) as num).toDouble(),
      emiAmount: emi,
      tenureMonths: tenure,
      balanceAmount: balance < 0 ? 0.0 : balance,
      paidAmount: paid < 0 ? 0.0 : paid,
      status: json['status'] ?? 'Pending',
      startDate: json['startDate']?.toString().split('T').first ?? '',
      reason: json['reason'],
      schedule: scheduleItems,
    );
  }
}
