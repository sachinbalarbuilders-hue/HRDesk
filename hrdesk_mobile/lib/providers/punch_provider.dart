import 'package:flutter/foundation.dart';
import '../core/api_client.dart';

enum PunchState { idle, loading, success, error }

class PunchProvider extends ChangeNotifier {
  PunchState _state = PunchState.idle;
  String? _message;

  PunchState get state => _state;
  String? get message => _message;

  final _api = ApiClient();

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
        'source': (livenessVerified == true) ? 'Face' : 'Mobile',
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
      notifyListeners();
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
