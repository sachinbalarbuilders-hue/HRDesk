import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:camera/camera.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../core/location_service.dart';
import '../providers/auth_provider.dart';
import '../providers/punch_provider.dart';

/// Active liveness challenge screen — fast, voice-guided, auto-capture.
///
/// Flow (total ~4-5 seconds):
///   1. Camera opens → face detected → request challenge from server
///   2. Voice speaks "Turn left" / "Turn right" + large animated arrow
///   3. Auto-captures 3 frames × 500ms (1.5s total)
///   4. Submits challengeId + frames[] → server verifies temporal movement
///   5. Success haptic + pop, or error with retry
///
/// No countdown. No button tap. No text to read.
/// Works for factory workers, non-English speakers, and low-literacy users.
class FaceChallengeScreen extends StatefulWidget {
  final String punchType;
  const FaceChallengeScreen({super.key, required this.punchType});

  @override
  State<FaceChallengeScreen> createState() => _FaceChallengeScreenState();
}

class _FaceChallengeScreenState extends State<FaceChallengeScreen>
    with WidgetsBindingObserver, TickerProviderStateMixin {
  // GPS
  Position? _position;

  // Camera
  CameraController? _camera;
  bool _cameraReady = false;

  // TTS
  final FlutterTts _tts = FlutterTts();

  // Challenge state from server
  String? _challengeId;
  String? _instruction;
  String? _challengeType; // "TurnLeft" or "TurnRight"
  int _frameCount = 5;
  int _intervalMs = 500;

  // Screen state machine
  _Phase _phase = _Phase.initializing;
  String? _errorMessage;

  // Capture
  int _capturedFrames = 0;
  final List<String> _frames = [];

  // Animation
  late AnimationController _arrowBounce;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Arrow bounce animation (left-right oscillation)
    _arrowBounce = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);

    // Pulse animation for the capture ring
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _initTts();
    _initCamera();
    _loadInitialLocation();
  }

  Future<void> _initTts() async {
    await _tts.setVolume(1.0);
    await _tts.setSpeechRate(0.45); // Slightly slow for clarity
    // Try Hindi first, fallback to English
    final languages = await _tts.getLanguages;
    final langList = (languages as List).map((l) => l.toString()).toList();
    if (langList.any((l) => l.contains('hi'))) {
      await _tts.setLanguage('hi-IN');
    } else {
      await _tts.setLanguage('en-IN');
    }
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
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _camera!.initialize();
      if (mounted) {
        setState(() => _cameraReady = true);
        // Auto-start: request challenge immediately
        _requestChallenge();
      }
    } catch (e) {
      debugPrint('Camera error: $e');
      if (mounted) {
        setState(() {
          _phase = _Phase.error;
          _errorMessage = 'Camera failed to start. Please restart the app.';
        });
      }
    }
  }

  // ── Step 1: Request challenge ──────────────────────────────────────────────
  Future<void> _requestChallenge() async {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.requesting;
      _errorMessage = null;
      _capturedFrames = 0;
      _frames.clear();
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
        _phase = _Phase.error;
        _errorMessage = punchProvider.message ??
            'Could not connect to server. Check your internet connection.';
      });
      return;
    }

    _challengeId = result['challengeId'] as String?;
    _instruction = result['instruction'] as String?;
    _challengeType = result['challengeType'] as String?;
    _frameCount = (result['frameCount'] as num?)?.toInt() ?? 5;
    _intervalMs = (result['intervalMs'] as num?)?.toInt() ?? 500;

    // Immediately show instruction + speak + start capture
    setState(() => _phase = _Phase.instructing);
    _speakAndCapture();
  }

  // ── Step 2: Speak instruction + auto-start capture ─────────────────────────
  Future<void> _speakAndCapture() async {
    // Speak the instruction
    final isLeft = _challengeType == 'TurnLeft';
    // Speak in Hindi if available, otherwise English
    final hindiAvailable = (await _tts.getLanguages as List)
        .any((l) => l.toString().contains('hi'));

    if (hindiAvailable) {
      await _tts.setLanguage('hi-IN');
      await _tts.speak(isLeft
          ? 'Apna sir baayein taraf ghuymaayein'
          : 'Apna sir daayein taraf ghuymaayein');
    } else {
      await _tts.setLanguage('en-IN');
      await _tts.speak(isLeft ? 'Turn your head left' : 'Turn your head right');
    }

    // Small delay for the user to hear + start moving
    await Future<void>.delayed(const Duration(milliseconds: 800));

    if (!mounted) return;

    // Start capturing frames
    setState(() => _phase = _Phase.capturing);
    _pulseController.repeat(reverse: true);
    _startCapture();
  }

  // ── Step 3: Auto-capture frames ────────────────────────────────────────────
  Future<void> _startCapture() async {
    for (int i = 0; i < _frameCount; i++) {
      if (!mounted || _phase != _Phase.capturing) return;

      final b64 = await _captureFrame();
      if (b64 == null) {
        if (mounted) {
          setState(() {
            _phase = _Phase.error;
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

    _pulseController.stop();
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

  // ── Step 4: Submit ─────────────────────────────────────────────────────────
  Future<void> _submitPunch() async {
    if (!mounted) return;
    setState(() => _phase = _Phase.verifying);

    final authProvider = context.read<AuthProvider>();
    final punchProvider = context.read<PunchProvider>();
    final employeeId = authProvider.user?.employeeId;

    // Refresh GPS
    final pos = await LocationService().getFreshPosition(
      timeout: const Duration(seconds: 3),
    );
    if (pos != null && mounted) _position = pos;

    if (employeeId == null || _challengeId == null || _frames.isEmpty) {
      if (mounted) {
        setState(() {
          _phase = _Phase.error;
          _errorMessage = 'Session data lost. Please try again.';
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

    if (success) {
      // Success haptic + brief green state then pop
      HapticFeedback.mediumImpact();
      setState(() => _phase = _Phase.success);
      await Future<void>.delayed(const Duration(milliseconds: 1200));
      if (mounted) {
        authProvider.tryAutoLogin();
        Navigator.of(context).pop(true);
      }
    } else {
      HapticFeedback.heavyImpact();
      setState(() {
        _phase = _Phase.error;
        _errorMessage = punchProvider.message ?? 'Verification failed.';
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    _arrowBounce.dispose();
    _pulseController.dispose();
    _tts.stop();
    super.dispose();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(child: _buildBody()),
    );
  }

  Widget _buildBody() {
    return switch (_phase) {
      _Phase.initializing => _buildLoading('Starting camera...'),
      _Phase.requesting =>
        _buildCameraWithOverlay('Getting ready...', showProgress: false),
      _Phase.instructing => _buildCameraWithArrow(),
      _Phase.capturing => _buildCameraWithArrow(capturing: true),
      _Phase.verifying =>
        _buildCameraWithOverlay('Verifying...', showProgress: true),
      _Phase.success => _buildSuccess(),
      _Phase.error => _buildError(),
    };
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  Widget _buildLoading(String msg) => Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              color: Color(0xFF0D9488),
              strokeWidth: 3,
            ),
          ),
          const SizedBox(height: 20),
          Text(msg,
              style: const TextStyle(color: Colors.white70, fontSize: 15)),
        ]),
      );

  // ── Camera with semi-transparent overlay + message ─────────────────────────
  Widget _buildCameraWithOverlay(String msg, {required bool showProgress}) {
    return Stack(children: [
      if (_cameraReady) SizedBox.expand(child: CameraPreview(_camera!)),
      Container(color: Colors.black.withAlpha(150)),
      Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (showProgress)
            const SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(
                  color: Color(0xFF0D9488), strokeWidth: 3),
            )
          else
            const Icon(Icons.face, color: Color(0xFF0D9488), size: 56),
          const SizedBox(height: 16),
          Text(msg, style: const TextStyle(color: Colors.white, fontSize: 16)),
        ]),
      ),
    ]);
  }

  // ── Camera with directional arrow — the main challenge UI ──────────────────
  Widget _buildCameraWithArrow({bool capturing = false}) {
    final isLeft = _challengeType == 'TurnLeft';
    final progress = _frameCount > 0 ? _capturedFrames / _frameCount : 0.0;

    return Stack(children: [
      // Full-screen camera
      SizedBox.expand(child: CameraPreview(_camera!)),

      // Subtle face oval guide
      CustomPaint(size: Size.infinite, painter: _FaceGuide()),

      // Large animated arrow — the primary instruction
      Center(
        child: AnimatedBuilder(
          animation: _arrowBounce,
          builder: (_, child) {
            final offset = (isLeft ? -1 : 1) * _arrowBounce.value * 20;
            return Transform.translate(
              offset: Offset(offset, 0),
              child: child,
            );
          },
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: const Color(0xFF0D9488).withAlpha(200),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0D9488).withAlpha(100),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Icon(
              isLeft ? Icons.arrow_back_rounded : Icons.arrow_forward_rounded,
              color: Colors.white,
              size: 52,
            ),
          ),
        ),
      ),

      // Top instruction text (small, secondary)
      Positioned(
        top: 40,
        left: 24,
        right: 24,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.black.withAlpha(180),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            _instruction ?? (isLeft ? 'Turn left' : 'Turn right'),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ),

      // Bottom: capture progress bar + GPS
      Positioned(
        bottom: 0,
        left: 0,
        right: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black.withAlpha(200)],
            ),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (capturing) ...[
              // Animated progress bar
              ScaleTransition(
                scale: _pulseAnimation,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    color: const Color(0xFF0D9488),
                    backgroundColor: Colors.white24,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Hold still...',
                style: TextStyle(
                  color: Colors.white.withAlpha(180),
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ] else ...[
              Text(
                'Move now',
                style: TextStyle(
                  color: const Color(0xFF0D9488).withAlpha(220),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 12),
            _buildGpsPill(),
          ]),
        ),
      ),
    ]);
  }

  // ── Success state ──────────────────────────────────────────────────────────
  Widget _buildSuccess() {
    return Container(
      color: const Color(0xFF0F172A),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: const Color(0xFF059669).withAlpha(40),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_rounded,
                color: Color(0xFF059669), size: 64),
          ),
          const SizedBox(height: 20),
          Text(
            widget.punchType == 'in' ? 'Clocked In' : 'Clocked Out',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Attendance verified successfully',
            style: TextStyle(color: Colors.white54, fontSize: 14),
          ),
        ]),
      ),
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  Widget _buildError() {
    return Container(
      color: const Color(0xFF0F172A),
      padding: const EdgeInsets.all(32),
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withAlpha(30),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.refresh_rounded,
                color: Color(0xFFEF4444), size: 44),
          ),
          const SizedBox(height: 20),
          const Text(
            'Verification Failed',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _errorMessage ?? 'Please try again.',
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white60, fontSize: 14, height: 1.4),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _requestChallenge,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: const Text(
                'Try Again',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Colors.white38, fontSize: 14),
            ),
          ),
        ]),
      ),
    );
  }

  // ── GPS pill ───────────────────────────────────────────────────────────────
  Widget _buildGpsPill() => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            _position != null ? Icons.location_on : Icons.location_searching,
            color: _position != null ? const Color(0xFF0D9488) : Colors.amber,
            size: 12,
          ),
          const SizedBox(width: 4),
          Text(
            _position != null
                ? '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}'
                : 'GPS...',
            style: TextStyle(color: Colors.white.withAlpha(120), fontSize: 11),
          ),
        ],
      );
}

// ══════════════════════════════════════════════════════════════════════════════
// State machine
// ══════════════════════════════════════════════════════════════════════════════

enum _Phase {
  initializing, // Camera starting
  requesting, // Calling server for challenge
  instructing, // Voice speaking + arrow showing (before capture)
  capturing, // Auto-capturing frames
  verifying, // Submitting to server
  success, // Punch recorded
  error, // Failed — retry available
}

// ══════════════════════════════════════════════════════════════════════════════
// Face guide painter — subtle oval with glow
// ══════════════════════════════════════════════════════════════════════════════

class _FaceGuide extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.40),
      width: size.width * 0.62,
      height: size.height * 0.42,
    );
    // Dim everything outside the oval
    final outer = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final oval = Path()..addOval(rect);
    canvas.drawPath(
      Path.combine(PathOperation.difference, outer, oval),
      Paint()..color = Colors.black.withAlpha(90),
    );
    // Soft teal oval stroke
    canvas.drawOval(
      rect,
      Paint()
        ..color = const Color(0xFF0D9488).withAlpha(120)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0,
    );
  }

  @override
  bool shouldRepaint(_FaceGuide old) => false;
}
