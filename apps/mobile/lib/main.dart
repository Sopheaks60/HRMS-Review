import "package:flutter/material.dart";
import "package:flutter_localizations/flutter_localizations.dart";
import "package:go_router/go_router.dart";
import "core/network/api_client.dart";
import "features/auth/login_page.dart";
import "features/attendance/attendance_page.dart";
import "features/leave/leave_page.dart";
import "features/payslip/payslip_page.dart";
import "features/ess/home_page.dart";

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KromPayApp());
}

final _authApi = ApiClient();
final _router = GoRouter(
  redirect: (context, state) async {
    final signedIn = await _authApi.hasSession();
    final atLogin = state.matchedLocation == "/login";
    if (!signedIn && !atLogin) return "/login";
    if (signedIn && atLogin) return "/";
    return null;
  },
  routes: [
    GoRoute(path: "/", builder: (_, __) => const HomePage()),
    GoRoute(path: "/login", builder: (_, __) => const LoginPage()),
    GoRoute(path: "/attendance", builder: (_, __) => const AttendancePage()),
    GoRoute(path: "/leave", builder: (_, __) => const LeavePage()),
    GoRoute(path: "/payslips", builder: (_, __) => const PayslipPage()),
  ],
);

class KromPayApp extends StatelessWidget {
  const KromPayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: "KromPay",
      locale: const Locale("km"),
      supportedLocales: const [Locale("km"), Locale("en")],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF047857)),
        useMaterial3: true,
      ),
      routerConfig: _router,
    );
  }
}
