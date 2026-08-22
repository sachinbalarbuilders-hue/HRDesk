import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter_face_liveness/flutter_face_liveness.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';

/// Face Punch Screen
/// Uses flutter_face_liveness for production-grade liveness detection + Face ID.
///
/// Flow:
///   First punch  → FaceIdMode.auto   → enrolls face, stores FaceId on server
///   Later punches → FaceIdMode.auto  → verifies same face matches enrolled FaceId
///
/// If faces don't match the server rejects with "Face identity does not match".
class FacePunchScreen extends StatefulWidget {
  final String punchType; // 'in' or 'out'
  const FacePunchScreen({super.key, required this.punchType});

  @override
  State<FacePunchScreen> createState() => _FacePunchScreenState();
}

class _FacePunchScreenState extends State<FacePunchScreen> {
  // GPS
  Position? _position;
  bool _locationLoading = true;
  String? _locationError;

  // Result from liveness
  LivenessResult? _livenessResult;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _getLocation();
  }

  Future<void> _getLocation() async {
    setState(() {
      _locationLoading = true;
      _locationError = null;
    });

    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locationLoading = false;
          _locationError = 'Location services disabled. Please enable GPS.';
        });
        return;
      }

      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        setState(() {
          _locationLoading = false;
          _locationError = 'Location permission denied.';
        });
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 15),
        ),
      );
      setState(() {
        _position = pos;
        _locationLoading = false;
      });
    } catch (e) {
      setState(() {
        _locationLoading = false;
        _locationError = 'Location failed: $e';
      });
    }
  }

  Future<void> _submitPunch(LivenessResult result) async {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;

    setState(() => _submitting = true);

    // flutter_face_liveness does not expose captured image bytes in LivenessResult.
    // The selfie is handled by the library internally.
    // We send liveness status, faceId, and GPS to the backend.
    final punchProvider = context.read<PunchProvider>();
    final success = await punchProvider.punch(
      employeeId: user.employeeId!,
      punchType: widget.punchType,
      latitude: _position?.latitude,
      longitude: _position?.longitude,
      livenessVerified: result.isSuccess && result.isRealHuman,
      faceConfidence: result.confidenceScore,
      faceId: result.faceId,
      isFaceIdNew: result.isFaceIdNew,
    );

    setState(() => _submitting = false);

    if (!mounted) return;
    final msg = punchProvider.message ?? '';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor:
          success ? const Color(0xFF059669) : const Color(0xFFDC2626),
      duration: const Duration(seconds: 4),
    ));
    if (success) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
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
      body: _locationLoading
          ? _buildLoading('Getting your location...')
          : _locationError != null
              ? _buildError(_locationError!, onRetry: _getLocation)
              : _submitting
                  ? _buildLoading('Recording your punch...')
                  : _livenessResult != null
                      ? _buildConfirmState(_livenessResult!, user)
                      : _buildLivenessWidget(user),
    );
  }

  Widget _buildLoading(String msg) {
    return Center(
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        const CircularProgressIndicator(color: Color(0xFF0D9488)),
        const SizedBox(height: 16),
        Text(msg, style: const TextStyle(color: Colors.white70, fontSize: 14)),
      ]),
    );
  }

  Widget _buildError(String msg, {VoidCallback? onRetry}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.location_off, color: Colors.redAccent, size: 48),
          const SizedBox(height: 16),
          Text(msg,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 14)),
          if (onRetry != null) ...[
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: onRetry,
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488)),
              child: const Text('Retry', style: TextStyle(color: Colors.white)),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _buildLivenessWidget(user) {
    // Determine mode based on enrollment status
    // isFaceEnrolled = false → auto mode enrolls on first pass
    // isFaceEnrolled = true  → auto mode verifies against stored embedding
    final isFaceEnrolled = user?.isFaceEnrolled ?? false;

    return FlutterFaceLiveness(
      // Single blink action — faster, less friction, still proves live person
      actions: const [
        LivenessAction.blink,
      ],
      config: LivenessConfig(
        // Face identity — persistent FaceNet embedding per person
        enableFaceId: true,
        faceIdMode: FaceIdMode.auto, // enroll first time, verify after
        faceIdSimilarityThreshold: 0.80,

        // Anti-spoof (9 heuristic signals)
        enableAntiSpoof: true,
        antiSpoofThreshold: 0.40, // slightly lenient for varied lighting

        // Randomize action order to prevent replay attacks
        randomizeActions: true,

        // Session timeout
        sessionTimeoutMs: 60000,

        // Camera
        cameraResolution: ResolutionPreset.medium,

        // UI
        themeMode: ThemeMode.dark,

        // Enable debug overlay during development — remove for production
        showDebugOverlay: true,
      ),
      onSuccess: (LivenessResult result) {
        setState(() => _livenessResult = result);
      },
      onFailed: (String reason) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Liveness check failed: $reason'),
          backgroundColor: const Color(0xFFDC2626),
          duration: const Duration(seconds: 4),
        ));
        // Pop back so user can retry from dashboard
        Navigator.of(context).pop(false);
      },
    );
  }

  Widget _buildConfirmState(LivenessResult result, user) {
    final isIn = widget.punchType == 'in';
    final isNew = result.isFaceIdNew == true;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Status icon
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: const Color(0xFF059669).withAlpha(38),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.verified_user,
                  color: Color(0xFF059669), size: 48),
            ),
            const SizedBox(height: 20),

            Text(
              isNew ? 'Face Enrolled ✓' : 'Face Verified ✓',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),

            if (isNew)
              const Text(
                'First time — your face has been registered.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.amber, fontSize: 13),
              )
            else
              const Text(
                'Identity confirmed.',
                style: TextStyle(color: Colors.white54, fontSize: 13),
              ),

            const SizedBox(height: 12),

            // Confidence
            Text(
              'Confidence: ${(result.confidenceScore * 100).toStringAsFixed(0)}%',
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),

            // GPS
            if (_position != null) ...[
              const SizedBox(height: 4),
              Text(
                'GPS: ${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
            ],

            const SizedBox(height: 36),

            // Confirm button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                onPressed: () => _submitPunch(result),
                icon: Icon(isIn ? Icons.login : Icons.logout,
                    color: Colors.white),
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
              ),
            ),
            const SizedBox(height: 12),

            // Retry
            TextButton(
              onPressed: () => setState(() => _livenessResult = null),
              child: const Text('Retry verification',
                  style: TextStyle(color: Colors.white38, fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
