import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';

/// Face Punch Screen — simple selfie capture.
/// No liveness challenge. Server-side ONNX ArcFace verifies identity
/// against the employee's stored profile photo.
class FacePunchScreen extends StatefulWidget {
  final String punchType;
  const FacePunchScreen({super.key, required this.punchType});

  @override
  State<FacePunchScreen> createState() => _FacePunchScreenState();
}

class _FacePunchScreenState extends State<FacePunchScreen>
    with WidgetsBindingObserver {
  // GPS
  Position? _position;

  // Camera
  CameraController? _camera;
  bool _cameraReady = false;

  // State
  String? _capturedPhotoBase64;
  bool _submitting = false;
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
    _loadInitialLocation();
  }

  Future<void> _loadInitialLocation() async {
    try {
      final pos = await LocationService().getFreshPosition(
        timeout: const Duration(seconds: 4),
      );
      if (mounted) {
        setState(() {
          _position = pos;
        });
      }
    } catch (_) {}
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _camera =
          CameraController(front, ResolutionPreset.medium, enableAudio: false);
      await _camera!.initialize();
      if (mounted) setState(() => _cameraReady = true);
    } catch (e) {
      debugPrint('Camera error: $e');
    }
  }

  Future<void> _takeSelfie() async {
    if (_camera == null || !_cameraReady) return;
    setState(() => _capturing = true);
    try {
      final xFile = await _camera!.takePicture();
      final bytes = await File(xFile.path).readAsBytes();
      setState(() {
        _capturedPhotoBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        _capturing = false;
      });
    } catch (e) {
      setState(() => _capturing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Failed to capture photo: $e'),
          backgroundColor: const Color(0xFFDC2626),
        ));
      }
    }
  }

  Future<void> _submitPunch() async {
    final authProvider = context.read<AuthProvider>();
    final punchProvider = context.read<PunchProvider>();
    final user = authProvider.user;
    final employeeId = user?.employeeId;
    if (user == null || employeeId == null || _capturedPhotoBase64 == null) return;

    setState(() => _submitting = true);
    // Guarantee verified fresh position at time of punch
    final pos = await LocationService().getFreshPosition(
      timeout: const Duration(seconds: 4),
    );
    if (pos != null) {
      _position = pos;
    }

    final success = await punchProvider.punch(
      employeeId: employeeId,
      punchType: widget.punchType,
      latitude: _position?.latitude,
      longitude: _position?.longitude,
      photoBase64: _capturedPhotoBase64,
      livenessVerified: true, // selfie captured intentionally by the user
      faceConfidence: null,
      faceId: null,
      isFaceIdNew: null,
    );

    setState(() => _submitting = false);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(punchProvider.message ?? ''),
      backgroundColor:
          success ? const Color(0xFF059669) : const Color(0xFFDC2626),
      duration: const Duration(seconds: 4),
    ));
    if (success) {
      authProvider.tryAutoLogin();
      Navigator.of(context).pop(true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isIn = widget.punchType == 'in';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          isIn
              ? 'Clock In — Face Verification'
              : 'Clock Out — Face Verification',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: !_cameraReady
          ? _buildLoading('Starting camera...')
          : _submitting
              ? _buildLoading('Verifying face & recording punch...')
              : _capturedPhotoBase64 != null
                  ? _buildConfirmState()
                  : _buildCameraView(),
    );
  }

  Widget _buildLoading(String msg) => Center(
          child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: Color(0xFF0D9488)),
          const SizedBox(height: 16),
          Text(msg,
              style: const TextStyle(color: Colors.white70, fontSize: 14)),
        ],
      ));

  Widget _buildCameraView() {
    return Column(children: [
      // Camera preview
      Expanded(
          child: Stack(alignment: Alignment.center, children: [
        SizedBox(width: double.infinity, child: CameraPreview(_camera!)),

        // Oval face guide
        CustomPaint(size: Size.infinite, painter: _OvalGuide()),

        // Instruction
        Positioned(
          top: 24,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.black.withAlpha(160),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text(
              'Position your face in the oval and tap Take Selfie',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 14),
            ),
          ),
        ),

        // GPS status pill
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black.withAlpha(130),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _position != null ? Icons.location_on : Icons.location_searching,
                  color: _position != null
                      ? const Color(0xFF0D9488)
                      : Colors.amberAccent,
                  size: 14,
                ),
                const SizedBox(width: 4),
                Text(
                  _position != null
                      ? 'GPS: ${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}'
                      : 'Acquiring GPS location...',
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      ])),

      // Capture button
      Container(
        color: const Color(0xFF1E293B),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: _capturing ? null : _takeSelfie,
            icon: _capturing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.camera_alt, color: Colors.white),
            label: Text(
              _capturing ? 'Capturing...' : 'Take Selfie',
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.white),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0D9488),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
          ),
        ),
      ),
    ]);
  }

  Widget _buildConfirmState() {
    final isIn = widget.punchType == 'in';
    return Center(
        child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: const Color(0xFF0D9488).withAlpha(38),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.face, color: Color(0xFF0D9488), size: 48),
        ),
        const SizedBox(height: 20),
        const Text('Selfie Captured ✓',
            style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text(
          'Server will verify your face against your profile photo.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white54, fontSize: 13),
        ),
        if (_position != null) ...[
          const SizedBox(height: 8),
          Text(
            'GPS: ${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
        const SizedBox(height: 36),
        SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _submitPunch,
              icon:
                  Icon(isIn ? Icons.login : Icons.logout, color: Colors.white),
              label: Text(
                isIn ? 'Confirm Clock In' : 'Confirm Clock Out',
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    isIn ? const Color(0xFF059669) : const Color(0xFFDC2626),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
            )),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() => _capturedPhotoBase64 = null),
          child: const Text('Retake',
              style: TextStyle(color: Colors.white38, fontSize: 13)),
        ),
      ]),
    ));
  }
}

class _OvalGuide extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.42),
      width: size.width * 0.65,
      height: size.height * 0.50,
    );
    final outer = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final oval = Path()..addOval(rect);
    canvas.drawPath(
      Path.combine(PathOperation.difference, outer, oval),
      Paint()..color = Colors.black.withAlpha(130),
    );
    canvas.drawOval(
        rect,
        Paint()
          ..color = const Color(0xFF0D9488)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5);
  }

  @override
  bool shouldRepaint(_OvalGuide old) => false;
}
