import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'api_service.dart';
import 'push_navigation.dart';

/// 앱이 꺼져 있거나 백그라운드일 때 받은 푸시. 반드시 최상위 함수여야 한다.
/// 서버가 notification(제목·내용)을 함께 보내므로 알림창 표시는 안드로이드가 직접 한다
/// (여기서 또 띄우면 두 번 뜬다).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[PushNotificationService] Background message: ${message.messageId}');
}

/// 서버(sns.util.ts ANDROID_PUSH_CHANNEL_ID)와 AndroidManifest 의 기본 채널과 같은 ID
const String kPushChannelId = 'takeme_push_channel';

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  bool _initialized = false;
  String? _lastToken;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // Setup Local Notifications
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);

      await _localNotifications.initialize(
        initSettings,
        onDidReceiveNotificationResponse: (response) {
          debugPrint('[LocalNoti] Clicked notification: ${response.payload}');
          // 앱이 켜져 있을 때 뜬 알림 배너를 눌렀을 때 → 관련 화면으로 이동
          PushNavigation.onPayload(response.payload);
        },
      );

      // Create Android Notification Channel
      const androidChannel = AndroidNotificationChannel(
        kPushChannelId,
        'TakeMe 알림',
        description: 'TakeMe 통학차량 및 알림장 실시간 푸시 채널',
        importance: Importance.max,
        playSound: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      // Request permission (안드로이드 13+ POST_NOTIFICATIONS 포함)
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('[PushNotificationService] Permission status: ${settings.authorizationStatus}');

      // Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final title = _firstText([message.notification?.title, message.data['title']]) ?? 'TakeMe 알림';
        final body = _firstText([message.notification?.body, message.data['body'], message.data['message']]) ?? '';
        debugPrint('[PushNotificationService] Foreground message: $title / $body');
        showNotification(
          title: title,
          body: body,
          payload: jsonEncode(message.data),
        );
      });

      // 알림창의 알림을 눌러 앱이 백그라운드에서 열렸을 때 → 관련 화면으로 이동
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        PushNavigation.onTap(Map<String, dynamic>.from(message.data));
      });
      // 앱이 꺼져 있다가 알림을 눌러 켜졌을 때 → 앱이 준비되면 관련 화면으로 이동
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        PushNavigation.onTap(Map<String, dynamic>.from(initialMessage.data), coldStart: true);
      }

      // Token refresh listener
      FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        _lastToken = token;
        debugPrint('[PushNotificationService] FCM Token refreshed: $token');
        registerTokenWithServer(token);
      });

      // Register initial token
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        _lastToken = token;
        debugPrint('[PushNotificationService] Initial FCM Token: $token');
        await registerTokenWithServer(token);
      }

      Map<String, dynamic> extractData(RemoteMessage msg) {
        final d = Map<String, dynamic>.from(msg.data);
        if (!d.containsKey('title') && msg.notification?.title != null) {
          d['title'] = msg.notification!.title;
        }
        if (!d.containsKey('body') && msg.notification?.body != null) {
          d['body'] = msg.notification!.body;
        }
        return d;
      }

      // 알림을 눌러 앱을 열었을 때 (백그라운드)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('[PushNotificationService] onMessageOpenedApp: ${message.data}');
        PushNavigation.onTap(extractData(message));
      });

      // 앱이 꺼져 있다가 알림을 눌러 켜졌을 때
      FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
        if (message != null) {
          debugPrint('[PushNotificationService] getInitialMessage: ${message.data}');
          PushNavigation.onTap(extractData(message), coldStart: true);
        }
      });
    } catch (e) {
      debugPrint('[PushNotificationService] Initialize error: $e');
    }
  }

  /// 비어 있지 않은 첫 글자열 (서버가 빈 문자열을 보내도 data 쪽 값을 쓰게)
  static String? _firstText(List<Object?> values) {
    for (final v in values) {
      final t = v?.toString().trim();
      if (t != null && t.isNotEmpty) return t;
    }
    return null;
  }

  /// 중복 푸시/소켓 알림 방지용 최근 알림 타임스탬프 캐시
  final Map<String, int> _recentNotificationTimestamps = {};

  /// Show notification banner via FlutterLocalNotifications
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
    String? dedupeKey,
  }) async {
    final cleanBody = body.trim();
    if (cleanBody.isEmpty) return;

    // 1. 중복 방지 (Deduplication): 3초 이내에 동일한 내용의 알림은 최초 1회만 표시
    final key = dedupeKey ?? '$title|$cleanBody';
    final now = DateTime.now().millisecondsSinceEpoch;
    final lastTime = _recentNotificationTimestamps[key];
    if (lastTime != null && (now - lastTime) < 3000) {
      debugPrint('[PushNotificationService] Suppressed duplicate notification within 3s: $key');
      return;
    }
    _recentNotificationTimestamps[key] = now;

    // 오래된 캐시 정리 (30초 이상 경과 시 제거)
    if (_recentNotificationTimestamps.length > 50) {
      _recentNotificationTimestamps.removeWhere((_, time) => now - time > 30000);
    }

    try {
      const androidDetails = AndroidNotificationDetails(
        kPushChannelId,
        'TakeMe 알림',
        channelDescription: 'TakeMe 통학차량 및 알림장 실시간 푸시 채널',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        autoCancel: true,
        visibility: NotificationVisibility.public,
      );
      const iosDetails = DarwinNotificationDetails();
      const details = NotificationDetails(android: androidDetails, iOS: iosDetails);

      // Notification ID: 고유 해시코드를 사용하여 동일 알림 재도착 시 덮어쓰도록 처리
      final notiId = key.hashCode & 0x7FFFFFFF;

      await _localNotifications.show(
        notiId,
        title,
        cleanBody,
        details,
        payload: payload,
      );
    } catch (e) {
      debugPrint('[PushNotificationService] Show notification error: $e');
    }
  }

  /// Register FCM token with backend -> AWS SNS endpoint
  Future<void> registerTokenWithServer([String? token]) async {
    final tokenToRegister = token ?? _lastToken;
    if (tokenToRegister == null || tokenToRegister.isEmpty) return;

    final authToken = ApiService().accessToken;
    if (authToken == null || authToken.isEmpty) {
      debugPrint('[PushNotificationService] User not logged in, token registration postponed.');
      return;
    }

    try {
      final url = Uri.parse('${AppConfig.apiHost}/me/device-token');
      final res = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        },
        body: jsonEncode({
          'deviceToken': tokenToRegister,
          'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        }),
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (res.headers['content-type']?.contains('application/json') == true) {
          debugPrint('[PushNotificationService] Device token registered to AWS SNS successfully!');
        } else {
          debugPrint('[PushNotificationService] Received non-JSON response for device token registration: ${res.statusCode}');
        }
      } else {
        debugPrint('[PushNotificationService] Failed to register token: ${res.statusCode} ${res.body}');
      }
    } catch (e) {
      debugPrint('[PushNotificationService] Register token error: $e');
    }
  }
}
