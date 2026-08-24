import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static const String defaultBaseUrl = 'http://10.229.155.51:5283/api';

  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  final _storage = const FlutterSecureStorage();
  late final Dio _dio;

  Dio get dio => _dio;

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: defaultBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Load custom baseUrl if previously saved
    _storage.read(key: 'custom_base_url').then((savedUrl) {
      if (savedUrl != null && savedUrl.trim().isNotEmpty) {
        _dio.options.baseUrl = savedUrl.trim();
      }
    }).catchError((_) {});

    // Auth interceptor — inject Bearer token on every request
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'auth_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) {
        return handler.next(e);
      },
    ));
  }

  Future<void> setBaseUrl(String url) async {
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    final finalUrl = cleanUrl.endsWith('/api') ? cleanUrl : '$cleanUrl/api';
    _dio.options.baseUrl = finalUrl;
    await _storage.write(key: 'custom_base_url', value: finalUrl);
  }

  Future<String> getBaseUrl() async {
    final saved = await _storage.read(key: 'custom_base_url');
    return (saved != null && saved.trim().isNotEmpty) ? saved : defaultBaseUrl;
  }

  Future<void> saveToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  Future<void> clearToken() async {
    await _storage.delete(key: 'auth_token');
  }
}

