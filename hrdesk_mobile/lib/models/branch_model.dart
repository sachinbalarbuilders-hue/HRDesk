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
    int parsedId = 0;
    final rawId = json['id'] ?? json['Id'];
    if (rawId is int) {
      parsedId = rawId;
    } else if (rawId != null) {
      parsedId = int.tryParse(rawId.toString()) ?? 0;
    }

    int? parsedOrgId;
    final rawOrgId = json['organizationId'] ?? json['OrganizationId'];
    if (rawOrgId is int) {
      parsedOrgId = rawOrgId;
    } else if (rawOrgId != null) {
      parsedOrgId = int.tryParse(rawOrgId.toString());
    }

    double parsedRadius = 100.0;
    final rawRadius = json['radiusMeters'] ?? json['RadiusMeters'];
    if (rawRadius is num) {
      parsedRadius = rawRadius.toDouble();
    } else if (rawRadius != null) {
      parsedRadius = double.tryParse(rawRadius.toString()) ?? 100.0;
    }

    bool parsedActive = true;
    final rawActive = json['isActive'] ?? json['IsActive'];
    if (rawActive is bool) {
      parsedActive = rawActive;
    } else if (rawActive != null) {
      parsedActive = rawActive.toString().toLowerCase() == 'true';
    }

    return BranchModel(
      id: parsedId,
      organizationId: parsedOrgId,
      publicId: (json['publicId'] ?? json['PublicId'] ?? '').toString(),
      name: (json['name'] ?? json['Name'] ?? 'Branch').toString(),
      code: (json['code'] ?? json['Code'] ?? '').toString(),
      address: json['address']?.toString(),
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      radiusMeters: parsedRadius,
      isActive: parsedActive,
    );
  }
}
