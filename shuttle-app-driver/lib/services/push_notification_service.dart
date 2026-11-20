import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'api_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[PushNotificationService] Background message: ${message.messageId}');
}

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
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

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
        'takeme_push_channel',
        'TakeMe 알림',
        description: 'TakeMe 통학차량 및 알림장 실시간 푸시 채널',
        importance: Importance.max,
        playSound: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      // Request permission
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint('[PushNotificationService] Permission status: ${settings.authorizationStatus}');

      // Foreground message listener
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('[PushNotificationService] Foreground message: ${message.notification?.title}');
        showNotification(
          title: message.notification?.title ?? message.data['title']?.toString() ?? 'TakeMe 알림',
          body: message.notification?.body ?? message.data['body']?.toString() ?? message.data['message']?.toString() ?? '',
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

  /// Show notification banner via FlutterLocalNotifications
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      const androidDetails = AndroidNotificationDetails(
        'takeme_push_channel',
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
        body,
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
      final url = Uri.parse('${AppConfig.apiHost}/api/me/device-token');
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
        debugPrint('[PushNotificationService] Device token registered to AWS SNS successfully!');
      } else {
        debugPrint('[PushNotificationService] Failed to register token: ${res.statusCode} ${res.body}');
      }
    } catch (e) {
      debugPrint('[PushNotificationService] Register token error: $e');
    }
  }
}
