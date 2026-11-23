import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'api_service.dart';
import '../screens/parent/board_community_screen.dart';
import '../screens/parent/daily_notice_screen.dart';
import '../screens/parent/my_requests_screen.dart';
import '../screens/parent/parent_chat_room_screen.dart';

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

  static void _open(NavigatorState nav, Map<String, dynamic> data) {
    final type = (data['type'] ?? '').toString();
    final roomId = int.tryParse((data['roomId'] ?? '').toString());
    final hasPost = (data['postId'] ?? '').toString().isNotEmpty;
    final title = ((data['title'] ?? '').toString().trim().isEmpty) ? '대화방' : (data['title']).toString().trim();
    final isChat = type == 'chat' || type == 'notice';
    // 홈 위에 쌓여 있던 화면은 정리하고 이동한다 (알림을 여러 번 눌러도 화면이 계속 쌓이지 않게)
    nav.popUntil((r) => r.isFirst);

    // 통학 변동 신청 접수·결과 → 내 신청 내역
    if (type == 'change_request') {
      _push(nav, const MyRequestsScreen());
      return;
    }
    // 알림장·게시판 새 글 → 알림장 / 게시판
    if (hasPost) {
      _push(nav, type == 'notice' ? const DailyNoticeScreen() : const BoardCommunityScreen());
      return;
    }
    // 운행 시작·종료·도착 예정 → 홈 화면(지도)
    if (type == 'shuttle') return;
    // 채팅·공지사항 → 그 대화방 (그 밖의 알림은 TakeMe 알림방)
    if (roomId != null) {
      final isGroup = (data['isGroup'] ?? '').toString() == 'true';
      final memberCount = int.tryParse((data['memberCount'] ?? '').toString());
      _push(
        nav,
        ParentChatRoomScreen(
          roomId: roomId,
          roomName: isChat ? title : 'TakeMe 알림',
          isGroup: isGroup,
          memberCount: memberCount,
        ),
      );
    }
  }
}
