class BranchModel {
  final int id;
  final int? organizationId;
  final String publicId;
  final String name;
  final String code;
  final String? address;
  final String? city;
  final String? state;
  final double? latitude;
  final double? longitude;
  final double radiusMeters;
  final bool isActive;

  BranchModel({
    required this.id,
    this.organizationId,
    required this.publicId,
    required this.name,
    required this.code,
    this.address,
    this.city,
    this.state,
    this.latitude,
    this.longitude,
    this.radiusMeters = 100,
    this.isActive = true,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: (json['id'] ?? json['Id'] ?? 0) as int,
      organizationId: json['organizationId'] is int
          ? json['organizationId'] as int
          : int.tryParse(json['organizationId']?.toString() ?? ''),
      publicId: (json['publicId'] ?? json['PublicId'] ?? '').toString(),
      name: (json['name'] ?? json['Name'] ?? 'Branch').toString(),
      code: (json['code'] ?? json['Code'] ?? '').toString(),
      address: json['address']?.toString(),
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      radiusMeters: ((json['radiusMeters'] ?? 100) as num).toDouble(),
      isActive: (json['isActive'] ?? true) as bool,
    );
  }
}
