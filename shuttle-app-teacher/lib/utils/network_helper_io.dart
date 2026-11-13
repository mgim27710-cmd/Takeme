import 'dart:io';

class _AppHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) {
        // 52.63.245.203 및 관련 도메인의 SSL 인증서 유효성 통과 보장
        return true;
      };
  }
}

void setupNetworkSecurity() {
  HttpOverrides.global = _AppHttpOverrides();
}

