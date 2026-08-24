import 'dart:convert';
import 'package:flutter/material.dart';
import '../core/api_client.dart';

class EmployeeAvatar extends StatelessWidget {
  final int? employeeId;
  final String name;
  final String? photoUrl;
  final String? photoBase64;
  final double radius;
  final Color? backgroundColor;
  final Color? textColor;

  const EmployeeAvatar({
    super.key,
    this.employeeId,
    required this.name,
    this.photoUrl,
    this.photoBase64,
    this.radius = 20,
    this.backgroundColor,
    this.textColor,
  });

  String _buildFullPhotoUrl(String raw) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    final base = ApiClient().dio.options.baseUrl.replaceAll(RegExp(r'/api/?$'), '');
    final cleanPath = raw.startsWith('/') ? raw : '/$raw';
    return '$base$cleanPath';
  }

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : 'E';
    final bg = backgroundColor ?? const Color(0xFF0D9488).withValues(alpha: 0.2);
    final fg = textColor ?? const Color(0xFF0D9488);

    // 1. Try Base64 image
    if (photoBase64 != null && photoBase64!.isNotEmpty) {
      try {
        final cleanBase64 = photoBase64!.contains(',')
            ? photoBase64!.split(',').last
            : photoBase64!;
        final bytes = base64Decode(cleanBase64);
        return CircleAvatar(
          radius: radius,
          backgroundColor: bg,
          backgroundImage: MemoryImage(bytes),
        );
      } catch (_) {}
    }

    // 2. Try photoUrl
    String? targetUrl;
    if (photoUrl != null && photoUrl!.isNotEmpty && photoUrl != '-' && photoUrl != '—') {
      targetUrl = _buildFullPhotoUrl(photoUrl!);
    } else if (employeeId != null && employeeId! > 0) {
      targetUrl = _buildFullPhotoUrl('/api/employees/$employeeId/public-photo');
    }

    if (targetUrl != null) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: bg,
        child: ClipOval(
          child: Image.network(
            targetUrl,
            width: radius * 2,
            height: radius * 2,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return Center(
                child: Text(
                  initial,
                  style: TextStyle(
                    color: fg,
                    fontSize: radius * 0.85,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              );
            },
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return Center(
                child: Text(
                  initial,
                  style: TextStyle(
                    color: fg,
                    fontSize: radius * 0.85,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              );
            },
          ),
        ),
      );
    }

    // 3. Fallback Initial
    return CircleAvatar(
      radius: radius,
      backgroundColor: bg,
      child: Text(
        initial,
        style: TextStyle(
          color: fg,
          fontSize: radius * 0.85,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
