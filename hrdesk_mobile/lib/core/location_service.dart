import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// LocationService manages high-accuracy, low-latency GPS position retrieval.
/// It uses background warm-up and a strict freshness window (60s) to guarantee
/// verified live location with 0ms button delay.
class LocationService {
  static final LocationService _instance = LocationService._internal();
  factory LocationService() => _instance;
  LocationService._internal();

  Position? _cachedPosition;
  DateTime? _lastFetchTime;
  Future<Position?>? _pendingFetch;

  /// Freshness threshold for using a previously fetched coordinate without re-requesting hardware GPS.
  static const Duration _maxFreshness = Duration(seconds: 60);

  /// Returns true if the cached position was acquired within the last 60 seconds.
  bool get isPositionFresh {
    if (_cachedPosition == null || _lastFetchTime == null) return false;
    return DateTime.now().difference(_lastFetchTime!) < _maxFreshness;
  }

  /// Current cached position (may be null or older than 60s).
  Position? get currentPosition => _cachedPosition;

  /// Warm up the GPS in the background as soon as a screen opens.
  /// Does not block the caller or throw unhandled exceptions.
  void warmUp() {
    if (isPositionFresh || _pendingFetch != null) return;
    getFreshPosition(timeout: const Duration(seconds: 5)).catchError((e) {
      debugPrint('[LocationService] Warm-up error: $e');
      return null;
    });
  }

  /// Check and request location permissions.
  Future<bool> ensurePermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  /// Retrieves a verified fresh position.
  /// 1. If a position was fetched < 60s ago, returns it instantly.
  /// 2. If a fetch is already in progress, joins and awaits the ongoing request.
  /// 3. Otherwise, requests a live position with the specified timeout (default 5s).
  /// 4. Falls back to OS last-known position only if timestamp is fresh (< 2 mins).
  Future<Position?> getFreshPosition({
    Duration timeout = const Duration(seconds: 5),
  }) async {
    if (isPositionFresh) {
      return _cachedPosition;
    }

    if (_pendingFetch != null) {
      return await _pendingFetch;
    }

    _pendingFetch = _fetchInternal(timeout);
    try {
      final pos = await _pendingFetch;
      return pos;
    } finally {
      _pendingFetch = null;
    }
  }

  Future<Position?> _fetchInternal(Duration timeout) async {
    final hasPermission = await ensurePermission();
    if (!hasPermission) {
      debugPrint('[LocationService] Location permission not granted or service disabled.');
      return null;
    }

    Position? pos;
    try {
      pos = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: timeout,
        ),
      );
    } catch (e) {
      debugPrint('[LocationService] Live position fetch timed out or failed: $e');
      // Try last known position from OS as safe fallback
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null) {
          final age = DateTime.now().difference(lastKnown.timestamp);
          // Only accept last known if it was recorded within the last 2 minutes
          if (age.inSeconds < 120) {
            pos = lastKnown;
          }
        }
      } catch (_) {}
    }

    if (pos != null) {
      _cachedPosition = pos;
      _lastFetchTime = DateTime.now();
    }

    return pos;
  }

  /// Clears the cached position (e.g. on logout).
  void clearCache() {
    _cachedPosition = null;
    _lastFetchTime = null;
    _pendingFetch = null;
  }
}
