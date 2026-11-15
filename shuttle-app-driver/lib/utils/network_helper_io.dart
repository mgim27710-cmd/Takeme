import 'dart:io';

/// 인증서 검사를 건너뛰는 것을 허용하는 서버 (TakeMe 서버 주소만)
/// 그 외 모든 서버는 정상적으로 인증서를 검사한다. (중간자 공격 방지)
const Set<String> _trustedHosts = {
  '52.63.245.203',
  '52.63.245.203.sslip.io',
};

class _AppHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) {
        return _trustedHosts.contains(host);
      };
  }
}

void setupNetworkSecurity() {
  HttpOverrides.global = _AppHttpOverrides();
}
