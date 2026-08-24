class OrganizationModel {
  final int id;
  final String name;
  final String? code;
  final String? address;
  final bool isActive;

  OrganizationModel({
    required this.id,
    required this.name,
    this.code,
    this.address,
    this.isActive = true,
  });

  factory OrganizationModel.fromJson(Map<String, dynamic> json) {
    return OrganizationModel(
      id: (json['id'] ?? json['Id'] ?? 0) is int
          ? (json['id'] ?? json['Id'] ?? 0) as int
          : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: (json['name'] ?? json['Name'] ?? 'Company').toString(),
      code: json['code']?.toString(),
      address: json['address']?.toString(),
      isActive: (json['isActive'] ?? true) as bool,
    );
  }
}
