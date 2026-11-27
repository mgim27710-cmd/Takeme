import 'package:flutter/foundation.dart';

class AppConfig {
  static const String defaultApiHost = String.fromEnvironment('API_HOST', defaultValue: 'https://takemesafely.com');
  static const String fallbackApiHost = 'http://52.63.245.203:3000';
  static String _customApiHost = '';

  /// 암호화되지 않은(http) 대체 주소로 자동 전환해도 되는지.
  /// 로그인 정보(이메일·비밀번호)가 평문으로 전송되므로, 개발(디버그) 실행이거나
  /// --dart-define=ALLOW_HTTP_FALLBACK=true 로 명시한 경우에만 허용한다. 배포용(release) 앱은 항상 꺼져 있다.
  static const bool _allowHttpFallbackFlag = bool.fromEnvironment('ALLOW_HTTP_FALLBACK', defaultValue: false);
  static bool get canUseHttpFallback => !kIsWeb && (kDebugMode || _allowHttpFallbackFlag);

  static String get apiHost {
    if (_customApiHost.isNotEmpty) return _customApiHost;
    if (kIsWeb) return Uri.base.origin;
    return defaultApiHost;
  }

  static set apiHost(String host) {
    _customApiHost = host;
  }

  static void useFallback() {
    _customApiHost = fallbackApiHost;
  }

  static const String appTitle = 'TAKEME';
  static const String appVersion = '1.0.0';
}
