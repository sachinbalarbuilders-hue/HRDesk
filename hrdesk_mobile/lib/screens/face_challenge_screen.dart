import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';

/// Active liveness challenge screen.
///
/// Flow:
///   1. On open → POST /api/attendance/request-challenge → server returns
///      { challengeId, challengeType, instruction, expiresAt, frameCount, intervalMs }
///   2. Show instruction ("Turn your head LEFT") + countdown
///   3. At T=0 capture frame[0] (baseline), then capture frame[1..N-1] at intervalMs
///   4. POST /api/attendance/punch with { challengeId, frames[] }
///      (no boolean like "challengeCompleted" — server decides)
///   5. Show success or error with retry option
///
/// The last captured frame is sent as the attendance photo by the server.
/// Intermediate frames are used only for motion analysis and are not stored.
class FaceChallengeScreen extends StatefulWidget {
  final String punchType;
  const FaceChallengeScreen({super.key, required this.punchType});

  @override
  State<FaceChallengeScreen> createState() => _FaceChallengeScreenState();
}

class _FaceChallengeScreenState extends State<FaceChallengeScreen>
    with WidgetsBindingObserver {
  // GPS
  Position? _position;

  // Camera
  CameraController? _camera;
  bool _cameraReady = false;

  // Challenge state from server
  String? _challengeId;
  String? _instruction;
  int _frameCount = 5;
  int _intervalMs = 500;

  // Screen state machine
  _ScreenState _state = _ScreenState.requestingChallenge;
  String? _errorMessage;

  // Countdown before capture starts (seconds)
  int _countdown = 3;
  Timer? _countdownTimer;

  // Capture progress
  int _capturedFrames = 0;
  final List<String> _frames = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
    _loadInitialLocation();
    // Request the challenge after the first frame renders so context is ready
    WidgetsBinding.instance.addPostFrameCallback((_) => _requestChallenge());
  }

  Future<void> _loadInitialLocation() async {
    try {
      final pos = await LocationService().getFreshPosition(
        timeout: const Duration(seconds: 4),
      );
      if (mounted) setState(() => _position = pos);
    } catch (_) {}
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _camera = CameraController(
        front,
        // Camera is initialized with ResolutionPreset.medium (~720p on most
        // Android devices). Keeps each JPEG frame to ~200-400 KB.
        // Do not upgrade to ResolutionPreset.high.
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _camera!.initialize();
      if (mounted) setState(() => _cameraReady = true);
    } catch (e) {
      debugPrint('Camera error: $e');
    }
  }

  // ── Step 1: Request challenge from server ──────────────────────────────────
  Future<void> _requestChallenge() async {
    if (!mounted) return;
    setState(() {
      _state = _ScreenState.requestingChallenge;
      _errorMessage = null;
    });

    final punchProvider = context.read<PunchProvider>();
    final authProvider = context.read<AuthProvider>();
    final employeeId = authProvider.user?.employeeId;

    final result = await punchProvider.requestChallenge(
      employeeId: employeeId,
      punchType: widget.punchType,
    );

    if (!mounted) return;

    if (result == null) {
      setState(() {
        _state = _ScreenState.error;
        _errorMessage = punchProvider.message ??
            'Failed to get liveness challenge. Please try again.';
      });
      // Log for debugging
      debugPrint(
          '[FaceChallenge] requestChallenge failed: ${punchProvider.message}');
      return;
    }

    setState(() {
      _challengeId = result['challengeId'] as String?;
      _instruction = result['instruction'] as String?;
      _frameCount = (result['frameCount'] as num?)?.toInt() ?? 5;
      _intervalMs = (result['intervalMs'] as num?)?.toInt() ?? 500;
      _capturedFrames = 0;
      _frames.clear();
      _countdown = 3;
      _state = _ScreenState.showingInstruction;
    });

    _startCountdown();
  }

  // ── Step 2: Countdown before capture ──────────────────────────────────────
  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() => _countdown--);
      if (_countdown <= 0) {
        t.cancel();
        _startCapture();
      }
    });
  }

  // ── Step 3: Capture frames at intervalMs ──────────────────────────────────
  Future<void> _startCapture() async {
    if (!mounted) return;
    setState(() => _state = _ScreenState.capturingFrames);

    for (int i = 0; i < _frameCount; i++) {
      if (!mounted) return;
      final b64 = await _captureFrame();
      if (b64 == null) {
        if (mounted) {
          setState(() {
            _state = _ScreenState.error;
            _errorMessage = 'Camera capture failed. Please try again.';
          });
        }
        return;
      }
      _frames.add(b64);
      if (mounted) setState(() => _capturedFrames = _frames.length);

      if (i < _frameCount - 1) {
        await Future<void>.delayed(Duration(milliseconds: _intervalMs));
      }
    }

    // All frames captured — submit
    if (mounted) _submitPunch();
  }

  Future<String?> _captureFrame() async {
    if (_camera == null || !_cameraReady) return null;
    try {
      final xFile = await _camera!.takePicture();
      final bytes = await File(xFile.path).readAsBytes();
      return 'data:image/jpeg;base64,${base64Encode(bytes)}';
    } catch (e) {
      debugPrint('Frame capture error: $e');
      return null;
    }
  }

  // ── Step 4: Submit punch with frames ──────────────────────────────────────
  Future<void> _submitPunch() async {
    if (!mounted) return;
    setState(() {
      _state = _ScreenState.submitting;
    });

    // Read providers BEFORE any await — context must not be used across async gaps
    final authProvider = context.read<AuthProvider>();
    final punchProvider = context.read<PunchProvider>();
    final user = authProvider.user;
    final employeeId = user?.employeeId;

    // Refresh GPS at submit time
    final pos = await LocationService().getFreshPosition(
      timeout: const Duration(seconds: 4),
    );
    if (pos != null && mounted) _position = pos;

    if (employeeId == null || _challengeId == null || _frames.isEmpty) {
      if (mounted) {
        setState(() {
          _state = _ScreenState.error;
          _errorMessage = 'Missing punch data. Please start over.';
        });
      }
      return;
    }

    final success = await punchProvider.punchWithChallenge(
      employeeId: employeeId,
      punchType: widget.punchType,
      challengeId: _challengeId!,
      frames: List.unmodifiable(_frames),
      latitude: _position?.latitude,
      longitude: _position?.longitude,
    );

    if (!mounted) return;
    setState(() {
      _state = success ? _ScreenState.done : _ScreenState.error;
      _errorMessage = success
          ? null
          : (punchProvider.message ?? 'Verification failed. Please try again.');
    });

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(punchProvider.message ?? 'Attendance recorded.'),
        backgroundColor: const Color(0xFF059669),
        duration: const Duration(seconds: 4),
      ));
      authProvider.tryAutoLogin();
      Navigator.of(context).pop(true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _camera?.dispose();
    super.dispose();
  }

  // ── UI ────────────────────────────────────────────────────────────────────
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
          isIn ? 'Clock In — Liveness Check' : 'Clock Out — Liveness Check',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (!_cameraReady) return _buildStatus('Starting camera...');

    return switch (_state) {
      _ScreenState.requestingChallenge =>
        _buildStatus('Getting liveness challenge...'),
      _ScreenState.showingInstruction => _buildInstruction(),
      _ScreenState.capturingFrames => _buildCapturing(),
      _ScreenState.submitting =>
        _buildStatus('Verifying and recording attendance...'),
      _ScreenState.error => _buildError(),
      _ScreenState.done => _buildStatus('Done.'),
    };
  }

  // ── Status / loading screen ───────────────────────────────────────────────
  Widget _buildStatus(String message) => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const CircularProgressIndicator(color: Color(0xFF0D9488)),
          const SizedBox(height: 16),
          Text(message,
              style: const TextStyle(color: Colors.white70, fontSize: 14)),
        ]),
      );

  // ── Instruction + countdown ───────────────────────────────────────────────
  Widget _buildInstruction() {
    return Stack(children: [
      // Camera preview in background
      SizedBox.expand(child: CameraPreview(_camera!)),
      CustomPaint(size: Size.infinite, painter: _OvalGuide()),

      // Dark overlay with instruction
      Container(color: Colors.black.withAlpha(120)),

      Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          // Direction arrow icon
          Icon(
            _instruction?.contains('LEFT') == true
                ? Icons.arrow_back_rounded
                : Icons.arrow_forward_rounded,
            color: const Color(0xFF0D9488),
            size: 72,
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              _instruction ?? 'Follow the instruction',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(height: 32),

          // Countdown ring
          SizedBox(
            width: 80,
            height: 80,
            child: Stack(alignment: Alignment.center, children: [
              CircularProgressIndicator(
                value: _countdown / 3.0,
                strokeWidth: 5,
                color: const Color(0xFF0D9488),
                backgroundColor: Colors.white24,
              ),
              Text(
                '$_countdown',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          const Text(
            'Get ready — capture will start automatically',
            style: TextStyle(color: Colors.white54, fontSize: 13),
          ),
        ]),
      ),

      // GPS pill
      _buildGpsPill(),
    ]);
  }

  // ── Capturing frames ──────────────────────────────────────────────────────
  Widget _buildCapturing() {
    final progress = _frameCount > 0 ? _capturedFrames / _frameCount : 0.0;
    return Stack(children: [
      SizedBox.expand(child: CameraPreview(_camera!)),
      CustomPaint(size: Size.infinite, painter: _OvalGuide()),

      // Top instruction banner
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
          child: Column(children: [
            Text(
              _instruction ?? 'Keep moving',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: progress,
              color: const Color(0xFF0D9488),
              backgroundColor: Colors.white24,
              minHeight: 6,
              borderRadius: BorderRadius.circular(4),
            ),
            const SizedBox(height: 4),
            Text(
              'Frame $_capturedFrames / $_frameCount',
              style: const TextStyle(color: Colors.white54, fontSize: 11),
            ),
          ]),
        ),
      ),

      _buildGpsPill(),
    ]);
  }

  // ── Error state ───────────────────────────────────────────────────────────
  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.warning_amber_rounded,
              color: Color(0xFFEF4444), size: 56),
          const SizedBox(height: 16),
          Text(
            _errorMessage ?? 'Verification failed.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: _requestChallenge,
              icon: const Icon(Icons.refresh, color: Colors.white),
              label: const Text(
                'Try Again',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Colors.white),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child:
                const Text('Cancel', style: TextStyle(color: Colors.white38)),
          ),
        ]),
      ),
    );
  }

  Widget _buildGpsPill() => Positioned(
        bottom: 16,
        left: 16,
        right: 16,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withAlpha(130),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
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
                  ? 'GPS: ${_position!.latitude.toStringAsFixed(4)}, '
                      '${_position!.longitude.toStringAsFixed(4)}'
                  : 'Acquiring GPS...',
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ]),
        ),
      );
}

enum _ScreenState {
  requestingChallenge,
  showingInstruction,
  capturingFrames,
  submitting,
  error,
  done,
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
      Paint()..color = Colors.black.withAlpha(100),
    );
    canvas.drawOval(
      rect,
      Paint()
        ..color = const Color(0xFF0D9488)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
  }

  @override
  bool shouldRepaint(_OvalGuide old) => false;
}
