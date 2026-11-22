import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'api_service.dart';

/// 앱이 꺼져 있거나 백그라운드일 때 받은 푸시. 반드시 최상위 함수여야 한다.
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
        // 운행 시작·도착 예정·하차는 앱이 켜져 있으면 LocalPush 가 소켓 이벤트로 이미 띄운다 (두 번 뜨지 않게)
        if (message.data['type'] == 'shuttle' &&
            (title == '운행 시작 안내' || title == '버스 도착 예정' || title == '셔틀 하차 안내')) {
          return;
        }
        showNotification(
          title: title,
          body: body,
          payload: jsonEncode(message.data),
        );
      });

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

  /// Show notification banner via FlutterLocalNotifications
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    final cleanBody = body.trim();
    if (cleanBody.isEmpty) {
      // 본문이 없는 빈 푸시 알림은 표시하지 않음
      return;
    }
    try {
      const androidDetails = AndroidNotificationDetails(
        kPushChannelId,
        'TakeMe 알림',
        channelDescription: 'TakeMe 통학차량 및 알림장 실시간 푸시 채널',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
      );
      const iosDetails = DarwinNotificationDetails();
      const details = NotificationDetails(android: androidDetails, iOS: iosDetails);

      await _localNotifications.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
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
