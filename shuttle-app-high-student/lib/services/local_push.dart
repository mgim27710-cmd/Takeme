import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 학부모 휴대폰 알림창(상단 푸시)에 띄우는 알림.
///
/// 서버가 소켓으로 보내는 실시간 이벤트를 받아 휴대폰 알림으로 보여준다.
///  1) 버스 운행 시작
///  2) 내 아이 정류장 도착 N분 전 (설정 > 버스 도착 알림 시점)
///  3) 내 아이 하차
///
/// 앱이 켜져 있거나 백그라운드에 살아 있는 동안 동작한다. 앱을 완전히 종료한 상태에서도 받으려면
/// 서버 푸시(Firebase Cloud Messaging)가 필요하다 (google-services.json 과 서버 키 필요).
class LocalPush {
  LocalPush._();
  static final LocalPush instance = LocalPush._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  static const _channel = AndroidNotificationDetails(
    'takeme_shuttle',
    '통학버스 알림',
    channelDescription: '버스 운행 시작, 도착 임박, 아이 하차 알림',
    importance: Importance.high,
    priority: Priority.high,
    icon: '@mipmap/ic_launcher',
  );

  Future<void> init() async {
    if (_ready || kIsWeb) return;
    try {
      await _plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(),
        ),
      );
      _ready = true;
    } catch (e) {
      debugPrint('[LocalPush] init error: $e');
    }
  }

  /// 안드로이드 13 이상은 알림 권한을 따로 받아야 한다 (로그인 후 홈 화면에서 한 번 묻는다)
  Future<void> requestPermission() async {
    await init();
    try {
      await _plugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      await _plugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
    } catch (e) {
      debugPrint('[LocalPush] permission error: $e');
    }
  }

  /// 같은 [dedupeKey] 알림은 [within] 안에 다시 띄우지 않는다 (서버가 같은 일을 두 번 보내거나, 앱을 다시 열었을 때 중복 방지)
  Future<void> show({
    required String dedupeKey,
    required String title,
    required String body,
    Duration within = const Duration(minutes: 30),
  }) async {
    await init();
    if (!_ready) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final k = 'push_sent_$dedupeKey';
      final last = prefs.getInt(k);
      final now = DateTime.now().millisecondsSinceEpoch;
      if (last != null && now - last < within.inMilliseconds) return;
      await prefs.setInt(k, now);
      await _plugin.show(
        dedupeKey.hashCode & 0x7fffffff,
        title,
        body,
        const NotificationDetails(
          android: _channel,
          iOS: DarwinNotificationDetails(),
        ),
      );
    } catch (e) {
      debugPrint('[LocalPush] show error: $e');
    }
  }
}
