import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

enum PunchState { idle, loading, success, error }

class PunchProvider extends ChangeNotifier {
  PunchState _state = PunchState.idle;
  String? _message;
  bool _isClockedIn = false;
  bool _statusLoaded = false;
  String? _inTime;
  String? _outTime;
  int _workMinutes = 0;
  String? _status;
  bool _isLate = false;
  int _lateMinutes = 0;
  String _shiftName = 'General Shift';
  String _shiftStart = '09:30 AM';
  String _shiftEnd = '06:30 PM';
  double _targetHours = 9.0;

  PunchState get state => _state;
  String? get message => _message;
  bool get isClockedIn => _isClockedIn;
  bool get statusLoaded => _statusLoaded;
  String? get inTime => _inTime;
  String? get outTime => _outTime;
  int get workMinutes => _workMinutes;
  String? get status => _status;
  bool get isLate => _isLate;
  int get lateMinutes => _lateMinutes;
  String get shiftName => _shiftName;
  String get shiftStart => _shiftStart;
  String get shiftEnd => _shiftEnd;
  double get targetHours => _targetHours;

  final _api = ApiClient();

  /// Fetches the current user's clock in/out state for today so the UI can show
  /// the correct single toggle button on load.
  Future<void> fetchTodayStatus() async {
    try {
      final res = await _api.dio.get('/attendance/today-status');
      if (res.data != null && res.data is Map) {
        _isClockedIn = res.data['isClockedIn'] == true;
        _inTime = res.data['inTime'];
        _outTime = res.data['outTime'];
        _workMinutes = (res.data['workMinutes'] as num?)?.toInt() ?? 0;
        _status = res.data['status'];
        _isLate = res.data['isLate'] == true;
        _lateMinutes = (res.data['lateMinutes'] as num?)?.toInt() ?? 0;
        _shiftName = res.data['shiftName'] ?? _shiftName;
        _shiftStart = res.data['shiftStart'] ?? _shiftStart;
        _shiftEnd = res.data['shiftEnd'] ?? _shiftEnd;
        _targetHours =
            (res.data['targetHours'] as num?)?.toDouble() ?? _targetHours;
      }
    } catch (_) {
      // Leave previous state on failure.
    } finally {
      _statusLoaded = true;
      notifyListeners();
    }
  }

  Future<bool> punch({
    required int employeeId,
    required String punchType,
    double? latitude,
    double? longitude,
    String? photoBase64,
    bool? livenessVerified,
    double? faceConfidence,
    String? faceId,
    bool? isFaceIdNew,
  }) async {
    _state = PunchState.loading;
    _message = null;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        'employeeId': employeeId,
        'punchType': punchType,
        // Drive source from photo presence — livenessVerified is always false now
        // because liveness is determined server-side, not by the client.
        'source':
            (photoBase64 != null && photoBase64.isNotEmpty) ? 'Face' : 'Mobile',
      };

      if (latitude != null) body['latitude'] = latitude;
      if (longitude != null) body['longitude'] = longitude;
      if (photoBase64 != null) body['photoBase64'] = photoBase64;
      if (livenessVerified != null) body['livenessVerified'] = livenessVerified;
      if (faceConfidence != null) body['faceConfidence'] = faceConfidence;
      if (faceId != null) body['faceId'] = faceId;
      if (isFaceIdNew != null) body['isFaceIdNew'] = isFaceIdNew;

      final res = await _api.dio.post('/attendance/punch', data: body);

      _state = PunchState.success;
      _message = res.data['message'] ?? 'Punch recorded successfully.';
      if (res.data['confidence'] != null) {
        final double conf = (res.data['confidence'] as num).toDouble();
        _message = '$_message (Match: ${(conf * 100).toStringAsFixed(1)}%)';
      }
      // Prefer the server's authoritative state; fall back to the requested action.
      if (res.data is Map && res.data['isClockedIn'] != null) {
        _isClockedIn = res.data['isClockedIn'] == true;
      } else {
        _isClockedIn = punchType == 'in';
      }
      await fetchTodayStatus();
      return true;
    } catch (e) {
      _state = PunchState.error;
      _message = _parseError(e);
      notifyListeners();
      return false;
    }
  }

  void reset() {
    _state = PunchState.idle;
    _message = null;
    notifyListeners();
  }

  String _parseError(dynamic e) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map && data['message'] != null) return data['message'];
    } catch (_) {}
    return 'Failed to record punch. Please try again.';
  }
}
