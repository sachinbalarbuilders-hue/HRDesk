import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api_client.dart';
import '../../widgets/employee_avatar.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> with SingleTickerProviderStateMixin {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  final ApiClient _api = ApiClient();

  bool _isProcessing = false;
  bool _torchOn = false;
  late AnimationController _animController;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _handleBarcodeScanned(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final String? rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.trim().isEmpty) return;

    setState(() => _isProcessing = true);
    await _scannerController.stop();

    try {
      String verificationId = rawValue.trim();
      if (verificationId.contains('/')) {
        final uri = Uri.tryParse(verificationId);
        if (uri != null && uri.pathSegments.isNotEmpty) {
          verificationId = uri.pathSegments.last;
        }
      }

      final response = await _api.dio.get('/employees/$verificationId/public-verify');

      if (response.statusCode == 200 && response.data != null && mounted) {
        _showVerifiedResultSheet(response.data as Map<String, dynamic>);
      } else {
        _showErrorDialog('Employee Badge Not Found. This QR is not registered in the system.');
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog('Verification failed: Invalid QR code or network error ($e).');
      }
    }
  }

  void _showVerifiedResultSheet(Map<String, dynamic> data) {
    final fullName = data['fullName'] ?? data['employeeName'] ?? 'Employee';
    final empCode = data['employeeCode'] ?? data['code'] ?? '—';
    final dept = data['department'] ?? data['departmentName'] ?? 'General';
    final designation = data['designation'] ?? data['designationName'] ?? 'Staff';
    final empId = (data['employeeId'] as num?)?.toInt();
    final isActive = (data['status']?.toString().toLowerCase() ?? 'active') == 'active';
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? Colors.white24 : Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),

            // Verified Badge Pill
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: (isActive ? const Color(0xFF059669) : const Color(0xFFDC2626)).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: (isActive ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isActive ? Icons.verified_rounded : Icons.cancel_rounded,
                    color: isActive ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isActive ? 'OFFICIAL BADGE VERIFIED' : 'INACTIVE / TERMINATED',
                    style: TextStyle(
                      color: isActive ? const Color(0xFF059669) : const Color(0xFFDC2626),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Avatar & Info
            Row(
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF0D9488), width: 2),
                  ),
                  child: EmployeeAvatar(
                    employeeId: empId,
                    name: fullName,
                    radius: 30,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fullName,
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Code: $empCode',
                        style: const TextStyle(
                          color: Color(0xFF0D9488),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '$designation • $dept',
                        style: TextStyle(
                          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),

            // Actions Grid
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.login_rounded, size: 16),
                    label: const Text('GATE IN', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                    onPressed: () => _recordGatePass(data, 'Granted', 'Gate Entry IN'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE11D48),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.logout_rounded, size: 16),
                    label: const Text('GATE OUT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                    onPressed: () => _recordGatePass(data, 'Granted', 'Gate Exit OUT'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.of(context).pop();
                  _resumeScanning();
                },
                child: const Text('Scan Next Badge', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Future<void> _recordGatePass(Map<String, dynamic> data, String status, String reason) async {
    Navigator.of(context).pop();

    final empId = (data['employeeId'] as num?)?.toInt();
    final empCode = data['employeeCode'] ?? data['code'] ?? '—';
    final fullName = data['fullName'] ?? data['employeeName'] ?? 'Employee';
    final dept = data['department'] ?? data['departmentName'] ?? 'General';
    final designation = data['designation'] ?? data['designationName'] ?? 'Staff';

    try {
      await _api.dio.post('/gate-scans/log', data: {
        'employeeId': empId,
        'employeeCode': empCode,
        'employeeName': fullName,
        'departmentName': dept,
        'designationName': designation,
        'status': status,
        'scanMode': 'Camera_QR',
        'reason': reason,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            content: Text('Gate Pass logged: $reason for $fullName'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (_) {}

    _resumeScanning();
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 22),
            SizedBox(width: 8),
            Text('Scan Error', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _resumeScanning();
            },
            child: const Text('Try Again', style: TextStyle(color: Color(0xFF0D9488), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _resumeScanning() {
    setState(() => _isProcessing = false);
    _scannerController.start();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final scanBoxSize = size.width * 0.70;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        title: const Text('QR Badge Scanner', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(
              _torchOn ? Icons.flash_on : Icons.flash_off,
              color: _torchOn ? Colors.amber : Colors.white70,
            ),
            onPressed: () async {
              await _scannerController.toggleTorch();
              setState(() => _torchOn = !_torchOn);
            },
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios, color: Colors.white70),
            onPressed: () => _scannerController.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Camera Viewfinder
          MobileScanner(
            controller: _scannerController,
            onDetect: _handleBarcodeScanned,
          ),

          // Dark Overlay with Cutout
          ColorFiltered(
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.65),
              BlendMode.srcOut,
            ),
            child: Stack(
              children: [
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.transparent,
                  ),
                ),
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: scanBoxSize,
                    height: scanBoxSize,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scan Box Frame with Glowing Corners
          Container(
            width: scanBoxSize,
            height: scanBoxSize,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.8), width: 2),
            ),
            child: Stack(
              children: [
                // Animated Laser Scanner Line
                AnimatedBuilder(
                  animation: _animation,
                  builder: (context, child) {
                    return Positioned(
                      top: _animation.value * (scanBoxSize - 4),
                      left: 10,
                      right: 10,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2DD4BF),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF2DD4BF).withValues(alpha: 0.8),
                              blurRadius: 8,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          // Header Instruction Pill
          Positioned(
            top: 30,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white24),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.qr_code_scanner, color: Color(0xFF2DD4BF), size: 16),
                  SizedBox(width: 8),
                  Text(
                    'Point camera at Employee QR Badge',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
