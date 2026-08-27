import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/api_client.dart';
import '../models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _loading = false;
  String? _error;

  UserModel? get user => _user;
  bool get loading => _loading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;

  final _storage = const FlutterSecureStorage();
  final _api = ApiClient();

  Future<bool> login(String username, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.dio.post('/auth/login', data: {
        'username': username,
        'password': password,
      });

      final token = res.data['token'] as String;
      await _api.saveToken(token);

      // /auth/me now returns attendanceType, employeeCode, branchId in one call
      final meRes = await _api.dio.get('/auth/me');
      _user = UserModel.fromJson(meRes.data, token);

      await _storage.write(key: 'last_username', value: username);

      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _loading = false;
      _error = _parseError(e);
      notifyListeners();
      return false;
    }
  }

  Future<void> tryAutoLogin() async {
    final token = await _api.getToken();
    if (token == null) return;

    try {
      final meRes = await _api.dio.get('/auth/me');
      _user = UserModel.fromJson(meRes.data, token);
      notifyListeners();
    } catch (_) {
      await _api.clearToken();
    }
  }

  Future<void> logout() async {
    await _api.clearToken();
    _user = null;
    notifyListeners();
  }

  String _parseError(dynamic e) {
    try {
      final statusCode = (e as dynamic).response?.statusCode;
      if (statusCode == 429) {
        return 'Too many login attempts. Please wait a minute and try again.';
      }
      final data = (e as dynamic).response?.data;
      if (data is Map && data['message'] != null) return data['message'];
    } catch (_) {}
    return 'Login failed. Please check your credentials and connection.';
  }
}
