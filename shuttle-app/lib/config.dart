import 'package:flutter/foundation.dart';

class AppConfig {
  static const String defaultApiHost = 'https://52.63.245.203.sslip.io';
  static String _customApiHost = '';

  static String get apiHost {
    if (_customApiHost.isNotEmpty) return _customApiHost;
    if (kIsWeb) return Uri.base.origin;
    return defaultApiHost;
  }

  static set apiHost(String host) {
    _customApiHost = host;
  }

  static const String appTitle = 'TAKEME';
  static const String appVersion = '1.0.0';
}
