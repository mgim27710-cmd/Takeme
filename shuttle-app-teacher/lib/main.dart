import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/staff/staff_dashboard_screen.dart';
import 'screens/teacher/homeroom_teacher_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ko_KR', null);
  await ApiService().init();
  runApp(const TakeMeTeacherApp());
}

class TakeMeTeacherApp extends StatelessWidget {
  const TakeMeTeacherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TakeMe 교사',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ko', 'KR'),
        Locale('en', 'US'),
      ],
      locale: const Locale('ko', 'KR'),
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0D9488),
          primary: const Color(0xFF0D9488),
          surface: const Color(0xFFF8FAFC),
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
          scrolledUnderElevation: 1,
          titleTextStyle: TextStyle(
            color: Color(0xFF0F172A),
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF8FAFC),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.5),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0D9488),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      home: const TeacherInitialRouterScreen(),
    );
  }
}

class TeacherInitialRouterScreen extends StatelessWidget {
  const TeacherInitialRouterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = ApiService();
    if (!api.isLoggedIn || api.currentUser == null) {
      return const LoginScreen();
    }

    final user = api.currentUser!;
    final role = user.role;

    // 담임교사: 학급 게시판, 출결 및 학급 소통
    if (role == 'HOMEROOM_TEACHER') {
      return const HomeroomTeacherHomeScreen();
    }
    // 지도교사: 통학차량 동승 지도, 탑승 QR 스캔, 결제 요청
    if (role == 'SHUTTLE_TEACHER') {
      return const StaffDashboardScreen();
    }
    // 레거시 TEACHER 호환
    if (role == 'TEACHER') {
      final cls = user.assignedClass;
      if (cls != null && cls.isNotEmpty && cls != 'SHUTTLE') {
        return const HomeroomTeacherHomeScreen();
      }
      return const StaffDashboardScreen();
    }

    // 교사 계정이 아닌 경우 로그아웃 후 안내
    WidgetsBinding.instance.addPostFrameCallback((_) {
      api.logout();
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('접근 권한 안내', style: TextStyle(fontWeight: FontWeight.bold)),
          content: const Text('본 앱은 [선생님 전용 앱]입니다.\n기사님 또는 학부모 계정은 해당 전용 앱을 이용해 주시기 바랍니다.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('확인', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
    });

    return const LoginScreen();
  }
}
