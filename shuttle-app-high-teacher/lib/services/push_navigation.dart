import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'api_service.dart';
import '../screens/chat/chat_conversation_screen.dart';
import '../screens/staff/teacher_board_view.dart';
import '../screens/teacher/homeroom_change_requests_view.dart';

/// 화면 어디서든 이동할 수 있게 앱 전체 내비게이터 키 (MaterialApp 에 연결)
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

/// 푸시 알림을 눌렀을 때 그 알림과 관련된 화면으로 이동한다.
/// - 앱이 켜져 있을 때(알림 배너), 백그라운드일 때, 꺼져 있다 알림으로 켜졌을 때 모두 여기로 들어온다.
/// - 앱이 아직 준비되지 않았으면(꺼져 있다 시작 중, 로그인 전) 잠깐 기다렸다가 준비되면 이동한다.
class PushNavigation {
  static Map<String, dynamic>? _pending;
  static Timer? _timer;
  static int _tries = 0;

  /// 로컬 알림(앱이 켜져 있을 때 띄우는 배너)을 눌렀을 때: payload 는 JSON 글자
  static void onPayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map) onTap(Map<String, dynamic>.from(decoded));
    } catch (e) {
      debugPrint('[PushNavigation] payload 해석 실패: $e');
    }
  }

  /// 알림 data(type, roomId, postId …)를 받아 이동을 예약한다. coldStart: 앱이 꺼져 있다 알림으로 켜진 경우
  static void onTap(Map<String, dynamic> data, {bool coldStart = false}) {
    _pending = data;
    _tries = 0;
    _timer?.cancel();
    Timer(Duration(milliseconds: coldStart ? 1200 : 0), () {
      if (_tryOpen()) return;
      _timer = Timer.periodic(const Duration(milliseconds: 500), (t) {
        _tries++;
        if (_tryOpen() || _tries >= 30) t.cancel();
      });
    });
  }

  /// 이동했으면(또는 더 할 일이 없으면) true, 아직 준비가 안 됐으면 false
  static bool _tryOpen() {
    final data = _pending;
    if (data == null) return true;
    final nav = appNavigatorKey.currentState;
    if (nav == null || !ApiService().isLoggedIn) return false;
    _pending = null;
    try {
      _open(nav, data);
    } catch (e) {
      debugPrint('[PushNavigation] 이동 실패: $e');
    }
    return true;
  }

  static void _push(NavigatorState nav, Widget screen) {
    nav.push(MaterialPageRoute(builder: (_) => screen));
  }

  static Widget _scaffold(String title, Widget body) => Scaffold(
        appBar: AppBar(
          title: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          backgroundColor: Colors.white,
          elevation: 0,
          iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
        ),
        body: body,
      );

  static void _open(NavigatorState nav, Map<String, dynamic> data) {
    debugPrint('[PushNavigation] _open called with data: $data');
    final rawType = (data['type'] ?? '').toString();
    final type = rawType.toLowerCase().trim();

    // roomId 추출 (camelCase, snake_case, 중첩 객체 모두 대응)
    int? roomId = int.tryParse((data['roomId'] ?? data['room_id'] ?? '').toString());
    if (roomId == null && data['room'] is Map) {
      roomId = int.tryParse((data['room']['id'] ?? '').toString());
    }

    final postId = (data['postId'] ?? data['post_id'] ?? '').toString();
    final hasPost = postId.isNotEmpty;
    final title = ((data['title'] ?? '').toString().trim().isEmpty) ? '대화방' : (data['title']).toString().trim();
    final isChat = type == 'chat' || type == 'notice' || type == 'chat_message' || type == 'message';

    // 홈 위에 쌓여 있던 화면은 정리하고 이동한다 (알림을 여러 번 눌러도 화면이 계속 쌓이지 않게)
    nav.popUntil((r) => r.isFirst);

    // 통학 변동 신청 접수·결과 → 신청 현황 화면
    if (type == 'change_request') {
      _push(nav, _scaffold('통학 변동 현황', const HomeroomChangeRequestsView()));
      return;
    }
    // 알림장·게시판 새 글 → 학급 알림장 / 학급 게시물
    if (hasPost || type == 'post' || type == 'board') {
      final cat = (type == 'notice' || type == 'post_notice') ? 'NOTICE' : 'POST';
      _push(nav, _scaffold(cat == 'NOTICE' ? '학급 알림장' : '학급 게시물', TeacherBoardView(initialCategory: cat)));
      return;
    }
    // 운행 시작·종료 → 홈 화면 (popUntil로 홈에 머무름)
    if (type == 'shuttle') return;

    // 채팅·공지사항 → 그 대화방 (그 밖의 알림은 TakeMe 알림방)
    if (roomId != null) {
      _push(nav, ChatConversationScreen(roomId: roomId, title: isChat ? title : 'TakeMe 알림', isSystem: !isChat));
      return;
    }

    // 그 외 roomId가 없는 일반 공지/알림일 때 type이 notice인 경우 알림장으로 이동
    if (type == 'notice') {
      _push(nav, _scaffold('학급 알림장', const TeacherBoardView(initialCategory: 'NOTICE')));
    }
  }
}
