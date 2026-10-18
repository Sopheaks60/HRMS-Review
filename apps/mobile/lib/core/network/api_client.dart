import "package:dio/dio.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

class ApiClient {
  ApiClient({String baseUrl = const String.fromEnvironment(
    "KROMPAY_API_URL",
    defaultValue: "http://10.0.2.2:4000/api/v1",
  )})
      : _dio = Dio(BaseOptions(baseUrl: baseUrl)),
        _storage = const FlutterSecureStorage() {
    _dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = await _storage.read(key: "accessToken");
      if (token != null) {
        options.headers["Authorization"] = "Bearer $token";
      }
      handler.next(options);
    }));
  }

  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<bool> hasSession() async => (await _storage.read(key: "accessToken")) != null;

  Future<void> login(String email, String password, String tenantSlug) async {
    final res = await _dio.post("/auth/login", data: {
      "email": email,
      "password": password,
      "tenantSlug": tenantSlug,
    });
    await _storage.write(key: "accessToken", value: res.data["accessToken"]);
  }

  Future<Map<String, dynamic>> punch({
    required String type,
    required String source,
    double? lat,
    double? lng,
    String? selfieId,
  }) async {
    final res = await _dio.post("/attendance/punch", data: {
      "type": type,
      "source": source,
      "latitude": lat,
      "longitude": lng,
      "selfieId": selfieId,
    });
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<List<dynamic>> getLeaveTypes() async {
    final res = await _dio.get("/leave/types");
    return List<dynamic>.from(res.data as List);
  }

  Future<List<dynamic>> getMyLeaveRequests() async {
    final res = await _dio.get("/leave");
    return List<dynamic>.from(res.data as List);
  }

  Future<List<dynamic>> getMyPayslips() async {
    final res = await _dio.get("/employees/me/payslips");
    return List<dynamic>.from(res.data as List);
  }

  Future<List<int>> downloadPayslip(String fileId) async {
    final res = await _dio.get<List<int>>(
      "/files/$fileId/download",
      options: Options(responseType: ResponseType.bytes),
    );
    return res.data ?? <int>[];
  }

  Future<Map<String, dynamic>> submitLeave({
    required String leaveTypeId,
    required DateTime startDate,
    required DateTime endDate,
    String? reason,
  }) async {
    final res = await _dio.post("/leave", data: {
      "leaveTypeId": leaveTypeId,
      "startDate": DateTime.utc(startDate.year, startDate.month, startDate.day).toIso8601String(),
      "endDate": DateTime.utc(endDate.year, endDate.month, endDate.day).toIso8601String(),
      if (reason != null && reason.trim().isNotEmpty) "reason": reason.trim(),
    });
    return Map<String, dynamic>.from(res.data as Map);
  }
}
