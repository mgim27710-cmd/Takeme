import '../../widgets/load_error_view.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../staff/teacher_board_view.dart';
import '../teacher/homeroom_change_requests_view.dart';

class ChatConversationScreen extends StatefulWidget {
  final int roomId;
  final String title;
  final Map<String, dynamic>? targetUser;
  final bool isSystem;
  final Map<String, dynamic>? room;

  const ChatConversationScreen({
    super.key,
    required this.roomId,
    required this.title,
    this.targetUser,
    this.isSystem = false,
    this.room,
  });

  @override
  State<ChatConversationScreen> createState() => _ChatConversationScreenState();
}

class _ChatConversationScreenState extends State<ChatConversationScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  String? _loadError; // 메시지 불러오기 실패 이유 (null 이면 정상)
  bool _isSending = false;
  int? _currentUserId;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _currentUserId = ApiService().currentUser?.id;
    _initChat();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    SocketService().leaveChatRoom(widget.roomId);
    SocketService().offChatEvents();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initChat() async {
    // 1. Join Socket Room
    SocketService().joinChatRoom(widget.roomId);

    // 2. Load Messages & Mark Read
    await _loadMessages();

    // 3. Listen to real-time socket events
    SocketService().onReceiveMessage((data) {
      if (!mounted) return;
      final msgRoomId = data['room']?['id'] ?? data['roomId'];
      if (msgRoomId != null && _toNumber(msgRoomId) == widget.roomId) {
        setState(() {
          final id = data['id'];
          final exists = id != null && _messages.any((m) => m['id'] == id);
          if (!exists) {
            if (data['sender'] == null && data['senderName'] != null) {
              data['sender'] = {
                'id': data['senderId'],
                'name': data['senderName'],
              };
            }
            if (data['text'] == null && data['message'] != null) {
              data['text'] = data['message'];
            }
            _messages.add(data);
          }
        });
        _scrollToBottom();
        // 화면을 보고 있는 중이므로 즉시 읽음 처리
        ApiService().markChatRoomAsRead(widget.roomId);
      }
    });

    SocketService().onMessagesRead((data) {
      if (!mounted) return;
      final msgRoomId = data['roomId'];
      if (msgRoomId != null && _toNumber(msgRoomId) == widget.roomId) {
        // 상대방이 읽었으므로 내 메시지의 unreadCount 를 0으로 업데이트
        setState(() {
          for (final m in _messages) {
            m['unreadCount'] = 0;
          }
        });
      }
    });

    // 4. 보조 실시간 폴링 타이머 (소켓 지연/일시단절 대비 3초 주기 자동 동기화)
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) {
        _loadMessages(silent: true);
      }
    });
  }

  int _toNumber(dynamic v) {
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }

  /// userInitiated: 사용자가 직접 새로고침/다시 시도한 경우
  Future<void> _loadMessages({bool userInitiated = false, bool silent = false}) async {
    if (!silent && _messages.isEmpty && mounted) {
      setState(() {
        _isLoading = true;
        _loadError = null;
      });
    }
    try {
      final list = await ApiService().getChatMessages(widget.roomId, throwOnError: !silent);
      if (mounted) {
        final hasChanges = list.length != _messages.length ||
            (list.isNotEmpty && _messages.isNotEmpty && list.last['id'] != _messages.last['id']);
        setState(() {
          _messages = list;
          _isLoading = false;
          _loadError = null;
        });
        if (hasChanges) {
          _scrollToBottom();
        }
        // 메시지를 실제로 불러왔을 때만 읽음 처리 (못 본 메시지를 읽은 것으로 처리하지 않는다)
        ApiService().markChatRoomAsRead(widget.roomId);
      }
    } catch (e) {
      if (!mounted || silent) return;
      final message = friendlyError(e);
      setState(() {
        _isLoading = false;
        // 이미 보이는 메시지가 없을 때만 오류 화면, 있으면 그대로 두고 안내만 한다
        if (_messages.isEmpty) _loadError = message;
      });
      if (_messages.isNotEmpty && userInitiated) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('메시지를 새로 불러오지 못했습니다. $message')),
        );
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0, // reverse 목록: 0 = 맨 아래(가장 최근 메시지)
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSendMessage() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _textController.clear();

    final result = await ApiService().sendChatMessage(widget.roomId, text);
    if (!mounted) return;

    setState(() => _isSending = false);

    if (result != null) {
      setState(() {
        final exists = _messages.any((m) => m['id'] == result['id']);
        if (!exists) {
          _messages.add(result);
        }
      });
      _scrollToBottom();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('메시지 전송에 실패했습니다. 다시 시도해주세요.'),
          action: SnackBarAction(
            label: '재시도',
            textColor: Colors.amber,
            onPressed: () {
              _textController.text = text;
              _handleSendMessage();
            },
          ),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  // =========================================================================
  // 전자결재 및 서식 신청 모달 / 핸들러
  // =========================================================================

  void _showQuickActionsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('빠른 서식 / 전자결재 신청', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF64748B), size: 20),
                    onPressed: () => Navigator.pop(ctx),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildFormTile(
                icon: Icons.directions_bus,
                color: const Color(0xFF2563EB),
                title: '셔틀 탑승 및 결재 신청',
                subtitle: '탑승지 변경 및 신규 셔틀 배정 요청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showShuttleApprovalDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.event_busy,
                color: const Color(0xFFE11D48),
                title: '원아 결석계 (결석원)',
                subtitle: '질병·가정사 등 공식 결석 서식 신청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showAbsenceDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.more_time,
                color: const Color(0xFFD97706),
                title: '등원 지각 알림서',
                subtitle: '병원 진료 등 예상 등원 시간 안내',
                onTap: () {
                  Navigator.pop(ctx);
                  _showLatenessDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.family_restroom,
                color: const Color(0xFF7C3AED),
                title: '연장 보육 / 개별 하원 신청서',
                subtitle: '직접 픽업 및 셔틀 하차 제외 신청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showExtendedCareDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.beach_access,
                color: const Color(0xFF059669),
                title: '임직원 휴가·연차 신청서',
                subtitle: '원장님께 휴가 결재 및 대체 인력 요청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showStaffLeaveDialog();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFormTile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFF94A3B8), size: 20),
          ],
        ),
      ),
    );
  }

  /// 1. 셔틀 탑승 및 결재 신청 다이얼로그
  void _showShuttleApprovalDialog() {
    final nameCtrl = TextEditingController(text: widget.targetUser?['name'] ?? '');
    final busCtrl = TextEditingController(text: '1호차');
    final locCtrl = TextEditingController();
    final timeCtrl = TextEditingController(text: '08:40');
    final noteCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('셔틀 탑승 결재 신청', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: '원아 이름', hintText: '예: 김하늘', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: busCtrl,
                decoration: const InputDecoration(labelText: '배정 희망 차량', hintText: '예: 1호차', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: locCtrl,
                decoration: const InputDecoration(labelText: '신청 탑승 장소', hintText: '예: 래미안아파트 후문', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: timeCtrl,
                decoration: const InputDecoration(labelText: '예상 탑승 시간', hintText: '예: 08:40', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: const InputDecoration(labelText: '신청 메모 / 사유', hintText: '상담 내용 및 요청사항', isDense: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              final bus = busCtrl.text.trim();
              final loc = locCtrl.text.trim();
              final time = timeCtrl.text.trim();
              final note = noteCtrl.text.trim();
              if (name.isEmpty || loc.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('원아 이름과 탑승 장소를 입력해주세요.')));
                return;
              }
              Navigator.pop(ctx);

              final text = '[신규 탑승 및 결재 신청]\n원아: $name\n탑승 차량: $bus\n신청 탑승지: $loc\n예상 시간: $time\n메모: ${note.isNotEmpty ? note : '신규 탑승 승인 요청'}\n\n승인 결재를 부탁드립니다.';
              final payload = {
                'roomId': widget.roomId,
                'studentName': name,
                'busNumber': bus,
                'boardingLocation': loc,
                'targetTime': time,
                'note': note,
                'type': 'change_request',
              };

              final res = await ApiService().submitPaymentRequest(payload);
              if (res != null && mounted) {
                setState(() => _messages.add(res));
                _scrollToBottom();
              } else {
                // 일반 채팅 메시지로 폴백 전송
                _textController.text = text;
                _handleSendMessage();
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            child: const Text('신청서 보내기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// 2. 원아 결석계 서식 다이얼로그
  void _showAbsenceDialog() {
    final nameCtrl = TextEditingController(text: widget.targetUser?['name'] ?? '');
    String reason = '감기/발열';
    final detailCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('원아 결석계 (결석원)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '원아 이름', hintText: '예: 박민준', isDense: true),
                ),
                const SizedBox(height: 12),
                const Text('결석 사유 선택:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                DropdownButton<String>(
                  value: reason,
                  isExpanded: true,
                  items: ['감기/발열', '병원 진료', '가정사', '체험학습', '기타']
                      .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setDState(() => reason = v);
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: detailCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: '상세 사유', hintText: '증상 또는 기타 상세 내용 입력', isDense: true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
            ElevatedButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                final detail = detailCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);
                final text = '[원아 결석계 (결석원)]\n원아명: $name\n결석 일자: 오늘\n결석 사유: $reason\n상세 내용: ${detail.isNotEmpty ? detail : '사유 기재 없음'}\n\n출결 및 통학버스 결석 승인을 요청합니다.';
                _textController.text = text;
                _handleSendMessage();
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48)),
              child: const Text('결석계 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  /// 3. 등원 지각 알림서 다이얼로그
  void _showLatenessDialog() {
    final nameCtrl = TextEditingController(text: widget.targetUser?['name'] ?? '');
    final timeCtrl = TextEditingController(text: '10:30');
    final reasonCtrl = TextEditingController(text: '병원 진료 후 등원');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('등원 지각 알림서', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: '원아 이름', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: timeCtrl,
                decoration: const InputDecoration(labelText: '예상 등원 시간', hintText: '예: 10:30', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: reasonCtrl,
                decoration: const InputDecoration(labelText: '지각 사유', isDense: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              final text = '[등원 지각 알림서]\n원아명: $name\n지각 일자: 오늘\n예상 등원 시간: ${timeCtrl.text.trim()}\n사유: ${reasonCtrl.text.trim()}\n\n확인 부탁드립니다.';
              _textController.text = text;
              _handleSendMessage();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
            child: const Text('전송하기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// 4. 연장 보육 / 개별 하원 신청서 다이얼로그
  void _showExtendedCareDialog() {
    final nameCtrl = TextEditingController(text: widget.targetUser?['name'] ?? '');
    final timeCtrl = TextEditingController(text: '17:30');
    final parentCtrl = TextEditingController(text: '학부모 직접 픽업');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('연장 보육 / 개별 하원 신청서', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: '원아 이름', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: timeCtrl,
                decoration: const InputDecoration(labelText: '직접 픽업 예정 시간', hintText: '예: 17:30', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: parentCtrl,
                decoration: const InputDecoration(labelText: '보호자 / 픽업자 정보', isDense: true),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              final text = '[연장 보육 / 개별 하원 신청서]\n원아명: $name\n픽업 예정 시간: ${timeCtrl.text.trim()}\n보호자 정보: ${parentCtrl.text.trim()}\n셔틀 하차 제외: 신청 완료\n\n확인 결재를 부탁드립니다.';
              _textController.text = text;
              _handleSendMessage();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('신청서 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// 5. 임직원 휴가·연차 신청서 다이얼로그
  void _showStaffLeaveDialog() {
    final rawName = ApiService().currentUser?.name ?? '교사';
    final cleanName = rawName.replaceAll(RegExp(r'(?:\s*(?:담임선생님|선생님|담임교사|교사))+$'), '').trim();
    final nameCtrl = TextEditingController(text: cleanName.isNotEmpty ? cleanName : rawName);
    String leaveType = '연차';
    final periodCtrl = TextEditingController(text: '오늘');
    bool needSub = false;
    final reasonCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('임직원 휴가·연차 신청서', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '신청자 성명', isDense: true),
                ),
                const SizedBox(height: 10),
                const Text('휴가 구분:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                const SizedBox(height: 4),
                DropdownButton<String>(
                  value: leaveType,
                  isExpanded: true,
                  items: ['연차', '오전 반차', '오후 반차', '병가', '경조사', '공가']
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) setDState(() => leaveType = v);
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: periodCtrl,
                  decoration: const InputDecoration(labelText: '휴가 기간', hintText: '예: 2026-11-25 ~ 2026-11-26', isDense: true),
                ),
                const SizedBox(height: 10),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('대체 인력 배정 필요 (대체 교사/기사)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  value: needSub,
                  onChanged: (v) => setDState(() => needSub = v ?? false),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                TextField(
                  controller: reasonCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: '휴가 사유', hintText: '개인 사정 등', isDense: true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
            ElevatedButton(
              onPressed: () async {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);

                final rawPeriod = periodCtrl.text.trim();
                final now = DateTime.now();
                final todayStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
                String startDate = todayStr;
                String endDate = todayStr;
                if (rawPeriod.contains('~')) {
                  final parts = rawPeriod.split('~');
                  startDate = parts[0].trim();
                  endDate = parts.length > 1 ? parts[1].trim() : startDate;
                } else if (rawPeriod.isNotEmpty && rawPeriod != '오늘') {
                  startDate = rawPeriod;
                  endDate = rawPeriod;
                }

                final myRole = ApiService().currentUser?.role ?? 'TEACHER';
                final res = await ApiService().createLeaveRequest(
                  roomId: widget.roomId,
                  applicantName: name,
                  applicantRole: myRole == 'DRIVER' ? '기사' : '교사',
                  leaveType: leaveType,
                  startDate: startDate,
                  endDate: endDate,
                  needSubstitute: needSub,
                  reason: reasonCtrl.text.trim().isNotEmpty ? reasonCtrl.text.trim() : '개인 사유',
                );

                if (!mounted) return;

                if (res['success'] == true) {
                  // ignore: use_build_context_synchronously
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('휴가·연차 결재 신청서가 원장님께 전송되었습니다.'),
                      backgroundColor: Color(0xFF10B981),
                    ),
                  );
                  if (res['data'] != null && res['data'] is Map<String, dynamic>) {
                    setState(() {
                      final newMsg = res['data'] as Map<String, dynamic>;
                      final exists = _messages.any((m) => m['id'] == newMsg['id']);
                      if (!exists) _messages.add(newMsg);
                    });
                    _scrollToBottom();
                  } else {
                    _loadMessages(userInitiated: true);
                  }
                } else {
                  // ignore: use_build_context_synchronously
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(res['message']?.toString() ?? '휴가 신청서 전송에 실패했습니다.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669)),
              child: const Text('결재 신청', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  /// 결재 승인 또는 반려 처리
  Future<void> _handleDecision(int messageId, String decision) async {
    final isApprove = decision == 'APPROVED';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isApprove ? '결재 승인' : '결재 반려', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(isApprove
            ? '해당 결재 신청을 승인하시겠습니까?\n승인 시 통학 및 관련 정보에 즉시 반영됩니다.'
            : '해당 결재 신청을 반려하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isApprove ? const Color(0xFF10B981) : const Color(0xFFEF4444),
            ),
            child: Text(isApprove ? '승인' : '반려', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (ok != true) return;

    final targetMsg = _messages.firstWhere((m) => m['id'] == messageId, orElse: () => <String, dynamic>{});
    final isLeaveRequest = targetMsg['type'] == 'LEAVE_REQUEST' || targetMsg['payload']?['type'] == 'STAFF_LEAVE';

    final res = isLeaveRequest
        ? await ApiService().decideLeaveRequest(messageId, decision)
        : await ApiService().decidePaymentRequest(messageId, decision);

    if (res != null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isApprove ? '결재가 승인되었습니다.' : '결재가 반려되었습니다.'),
          backgroundColor: isApprove ? const Color(0xFF10B981) : const Color(0xFFEF4444),
        ),
      );
      setState(() {
        for (final m in _messages) {
          if (m['id'] == messageId) {
            final p = Map<String, dynamic>.from(m['payload'] ?? {});
            p['status'] = decision;
            p['decidedBy'] = ApiService().currentUser?.name ?? '원장';
            m['payload'] = p;
          }
        }
      });
      _loadMessages(userInitiated: true);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('결재 처리에 실패했습니다. 권한을 확인해주세요.'), backgroundColor: Colors.red),
      );
    }
  }

  /// 전자결재 카드 위젯 빌더
  Widget _buildApprovalCard(Map<String, dynamic> msg, bool isMe) {
    final payload = msg['payload'] as Map<String, dynamic>? ?? {};
    final text = msg['text']?.toString() ?? '';
    final status = (payload['status']?.toString() ?? 'PENDING').toUpperCase();
    final msgId = msg['id'] as int?;

    Color statusColor;
    String statusText;
    IconData statusIcon;

    if (status == 'APPROVED') {
      statusColor = const Color(0xFF10B981);
      statusText = '승인 완료';
      statusIcon = Icons.check_circle;
    } else if (status == 'REJECTED') {
      statusColor = const Color(0xFFEF4444);
      statusText = '반려됨';
      statusIcon = Icons.cancel;
    } else {
      statusColor = const Color(0xFFF59E0B);
      statusText = '결재 대기';
      statusIcon = Icons.hourglass_top;
    }

    final isLeave = msg['type'] == 'LEAVE_REQUEST' ||
        payload['type'] == 'STAFF_LEAVE' ||
        text.contains('[임직원 휴가·연차 신청서]');
    final cardTitle = isLeave ? '휴가·연차 결재 신청서' : '전자결재 신청서';

    // 결재 권한 및 신청자 여부 정밀 판별
    final myUser = ApiService().currentUser;
    final myRole = (myUser?.role ?? '').toUpperCase();
    final bool isDirectorOrAdmin = myRole == 'ACADEMY_ADMIN' || myRole == 'SUPER_ADMIN' || myRole == 'DIRECTOR';

    final myId = _toNumber(myUser?.id ?? _currentUserId);
    final myEmail = (myUser?.email ?? '').toLowerCase().trim();
    final senderId = _toNumber(msg['sender']?['id'] ?? msg['senderId']);
    final senderEmail = (msg['sender']?['email'] ?? msg['senderEmail'] ?? '').toString().toLowerCase().trim();
    final applicantId = _toNumber(payload['applicantId'] ?? payload['requesterId']);
    final applicantEmail = (payload['applicantEmail'] ?? payload['requesterEmail'] ?? '').toString().toLowerCase().trim();

    final bool isApplicant = isMe ||
        (myId > 0 && (myId == senderId || myId == applicantId)) ||
        (myEmail.isNotEmpty && (myEmail == senderEmail || myEmail == applicantEmail));

    final bool canApprove = isDirectorOrAdmin && !isApplicant;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.5), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: statusColor.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 카드 상단 헤더
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Row(
              children: [
                Icon(isLeave ? Icons.badge : Icons.assignment, size: 16, color: statusColor),
                const SizedBox(width: 6),
                Text(cardTitle, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 12, color: Colors.white),
                      const SizedBox(width: 4),
                      Text(statusText, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // 카드 본문
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  text,
                  style: const TextStyle(fontSize: 13.5, color: Color(0xFF1E293B), height: 1.45),
                ),
                if (payload['decidedBy'] != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    '결재 처리자: ${payload['decidedBy']}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                ],
                // 결재 대기 중일 때
                if (status == 'PENDING' && msgId != null) ...[
                  if (canApprove) ...[
                    // 오직 결재 권한자(원장/관리자)에게만 승인/반려 버튼 노출!
                    const SizedBox(height: 12),
                    const Divider(height: 1, color: Color(0xFFE2E8F0)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _handleDecision(msgId, 'REJECTED'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFEF4444),
                              side: const BorderSide(color: Color(0xFFEF4444)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                            child: const Text('반려', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => _handleDecision(msgId, 'APPROVED'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              elevation: 0,
                            ),
                            child: const Text('승인', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ),
                        ),
                      ],
                    ),
                  ] else ...[
                    // 신청자 본인 및 결재 권한이 없는 교사에게는 대기 배지만 노출 (자가 결재 원천 차단)
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.hourglass_empty, size: 14, color: Color(0xFFD97706)),
                          SizedBox(width: 6),
                          Text(
                            '원장선생님 결재 대기 중입니다.',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFB45309),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatMessageTime(dynamic createdAt) {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt.toString()).toLocal();
      return DateFormat('a h:mm', 'ko_KR').format(dt);
    } catch (_) {
      return '';
    }
  }

  String _formatDateHeader(dynamic createdAt) {
    if (createdAt == null) return '';
    try {
      final dt = DateTime.parse(createdAt.toString()).toLocal();
      return DateFormat('yyyy년 M월 d일 EEEE', 'ko_KR').format(dt);
    } catch (_) {
      return '';
    }
  }

  bool _isSameDay(dynamic dateA, dynamic dateB) {
    if (dateA == null || dateB == null) return false;
    try {
      final dtA = DateTime.parse(dateA.toString()).toLocal();
      final dtB = DateTime.parse(dateB.toString()).toLocal();
      return dtA.year == dtB.year && dtA.month == dtB.month && dtA.day == dtB.day;
    } catch (_) {
      return false;
    }
  }

  Widget _buildDateSeparator(String text) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 14),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          text,
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF475569),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildMessageItem(Map<String, dynamic> msg, bool showDate, String dateText) {
    final senderId = msg['sender']?['id'];
    final isMe = (_currentUserId != null && senderId == _currentUserId);
    final text = msg['text']?.toString() ?? '';
    final timeStr = _formatMessageTime(msg['createdAt']);
    final unreadCount = _toNumber(msg['unreadCount']);
    final senderName = msg['sender']?['name'] ?? '상대방';
    final isSystemMessage = msg['sender'] == null ||
        msg['messageType'] == 'SYSTEM' ||
        widget.isSystem ||
        widget.title == 'TakeMe 알림' ||
        widget.room?['type'] == 'SYSTEM' || widget.room?['type'] == 'NOTIFICATION_SYSTEM' ||
        widget.room?['name'] == 'TakeMe 알림';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showDate) _buildDateSeparator(dateText),
        if (isSystemMessage && !isMe)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.notifications_active, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: InkWell(
                    onTap: () {
                      if (text.contains('알림장')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => Scaffold(
                              appBar: AppBar(
                                title: const Text(
                                  '학급 알림장',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                ),
                                backgroundColor: Colors.white,
                                elevation: 0,
                                iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
                              ),
                              body: const TeacherBoardView(initialCategory: 'NOTICE'),
                            ),
                          ),
                        );
                      } else if (text.contains('게시물') || text.contains('게시글') || text.contains('활동 사진')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => Scaffold(
                              appBar: AppBar(
                                title: const Text(
                                  '학급 게시물',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                ),
                                backgroundColor: Colors.white,
                                elevation: 0,
                                iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
                              ),
                              body: const TeacherBoardView(initialCategory: 'POST'),
                            ),
                          ),
                        );
                      } else if (text.contains('통학') || text.contains('변동') || text.contains('결석') || text.contains('신청')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => Scaffold(
                              appBar: AppBar(
                                title: const Text(
                                  '통학 변동 현황',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                ),
                                backgroundColor: Colors.white,
                                elevation: 0,
                                iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
                              ),
                              body: const HomeroomChangeRequestsView(),
                            ),
                          ),
                        );
                      }
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                text.contains('알림장')
                                    ? 'TakeMe 알림장 알림'
                                    : text.contains('게시물') || text.contains('게시글')
                                        ? 'TakeMe 게시물 알림'
                                        : text.contains('통학') || text.contains('변동') || text.contains('신청')
                                            ? 'TakeMe 통학 변동 알림'
                                            : 'TakeMe 시스템 알림',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: text.contains('알림장')
                                      ? const Color(0xFFEA580C)
                                      : text.contains('통학') || text.contains('변동')
                                          ? const Color(0xFF0D9488)
                                          : const Color(0xFF2563EB),
                                ),
                              ),
                              Text(
                                timeStr,
                                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            text,
                            style: const TextStyle(
                              fontSize: 13.5,
                              color: Color(0xFF1E293B),
                              height: 1.45,
                            ),
                          ),
                          if (text.contains('알림장')) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFFDBA74)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.campaign, size: 14, color: Color(0xFFEA580C)),
                                  SizedBox(width: 4),
                                  Text(
                                    '알림장 보기 >',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFEA580C)),
                                  ),
                                ],
                              ),
                            ),
                          ] else if (text.contains('게시물') || text.contains('게시글') || text.contains('활동 사진')) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.article, size: 14, color: Color(0xFF2563EB)),
                                  SizedBox(width: 4),
                                  Text(
                                    '게시물 보기 >',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                                  ),
                                ],
                              ),
                            ),
                          ] else if (text.contains('통학') || text.contains('변동') || text.contains('결석') || text.contains('신청')) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDFA),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFF99F6E4)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.edit_calendar, size: 14, color: Color(0xFF0D9488)),
                                  SizedBox(width: 4),
                                  Text(
                                    '통학 변동 확인 >',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0D9488)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: (msg['type'] == 'PAYMENT_REQUEST' ||
                    msg['type'] == 'LEAVE_REQUEST' ||
                    (msg['payload'] != null && (msg['payload']['type'] == 'change_request' || msg['payload']['type'] == 'STAFF_LEAVE')) ||
                    text.contains('[신규 탑승 및 결재 신청]') ||
                    text.contains('[신규 결재 신청]') ||
                    text.contains('[임직원 휴가·연차 신청서]') ||
                    text.contains('[원아 결석계') ||
                    text.contains('[등원 지각 알림서]') ||
                    text.contains('[연장 보육 / 개별 하원 신청서]'))
                ? Align(
                    alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                    child: _buildApprovalCard(msg, isMe),
                  )
                : (isMe
                ? Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Time and Unread count (Kakao-style left of my bubble)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (unreadCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 2),
                            child: Text(
                              '$unreadCount',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFFF59E0B),
                              ),
                            ),
                          ),
                        Text(
                          timeStr,
                          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                    const SizedBox(width: 6),
                    // My Bubble
                    Flexible(
                      child: Container(
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.of(context).size.width * 0.68,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: const BoxDecoration(
                          color: Color(0xFF2563EB),
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(16),
                            topRight: Radius.circular(4),
                            bottomLeft: Radius.circular(16),
                            bottomRight: Radius.circular(16),
                          ),
                        ),
                        child: Text(
                          text,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Profile Avatar
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: const Color(0xFFDBEAFE),
                      child: Text(
                        senderName.isNotEmpty ? senderName.substring(0, 1) : '?',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1D4ED8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Counterpart Bubble with Name
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            senderName,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Flexible(
                                child: Container(
                                  constraints: BoxConstraints(
                                    maxWidth: MediaQuery.of(context).size.width * 0.68,
                                  ),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.only(
                                      topLeft: Radius.circular(4),
                                      topRight: Radius.circular(16),
                                      bottomLeft: Radius.circular(16),
                                      bottomRight: Radius.circular(16),
                                    ),
                                  ),
                                  child: Text(
                                    text,
                                    style: const TextStyle(
                                      color: Color(0xFF1E293B),
                                      fontSize: 14,
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (unreadCount > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2),
                                      child: Text(
                                        '$unreadCount',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFFF59E0B),
                                        ),
                                      ),
                                    ),
                                  Text(
                                    timeStr,
                                    style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                )),
        ),
      ],
    );
  }

  /// 알림 전용 방(TakeMe 알림·공지사항)인지: 메시지 입력을 막는다
  bool get _isAlertOnlyRoom =>
      widget.isSystem ||
      widget.title == 'TakeMe 알림' ||
      widget.title == '공지사항' ||
      widget.room?['type'] == 'SYSTEM' ||
      widget.room?['type'] == 'NOTIFICATION_SYSTEM' ||
      widget.room?['name'] == 'TakeMe 알림' ||
      widget.room?['isSystem'] == true;

  @override
  Widget build(BuildContext context) {
    // 알림 전용 방: TakeMe 알림(나에게 온 알림) / 공지사항(기관 전체 공지)
    final isNoticeRoom = widget.title == '공지사항' ||
        (widget.room?['type'] == 'NOTIFICATION_SYSTEM' && widget.room?['name'] != 'TakeMe 알림');
    final isAlertRoom = _isAlertOnlyRoom;
    final subText = isAlertRoom
        ? (isNoticeRoom ? '유치원 전체 공지가 오는 방이에요' : '나와 우리 아이 관련 알림이 오는 방이에요')
        : (widget.targetUser?['subText'] ?? '');

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1E293B), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            if (isAlertRoom) ...[
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: isNoticeRoom ? const Color(0xFFECFDF5) : const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(
                  isNoticeRoom ? Icons.campaign_rounded : Icons.notifications_active,
                  color: isNoticeRoom ? const Color(0xFF059669) : Colors.white,
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            if (subText.isNotEmpty)
              Text(
                subText,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
          ],
        )),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: () => _loadMessages(userInitiated: true),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: SafeArea(
        top: false, // 상단은 AppBar 가 처리
        child: Column(
          children: [
            // Message List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                  : (_loadError != null && _messages.isEmpty)
                      ? LoadErrorView(
                          title: '메시지를 불러오지 못했습니다.',
                          message: _loadError!,
                          onRetry: () => _loadMessages(userInitiated: true),
                        )
                  : _messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.chat_bubble_outline, color: Color(0xFF94A3B8), size: 28),
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                '대화 내용이 없습니다.\n첫 메시지를 보내보세요!',
                                style: TextStyle(color: Color(0xFF64748B), fontSize: 13, height: 1.5),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          reverse: true, // 아래에서 위로 쌓임: 최신 메시지가 입력창 바로 위
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          itemCount: _messages.length,
                          itemBuilder: (ctx, i) {
                            final idx = _messages.length - 1 - i; // 화면 위치(i) -> 시간순 인덱스
                            final msg = _messages[idx];
                            final prevMsg = idx > 0 ? _messages[idx - 1] : null;
                            final showDate = (idx == 0) || !_isSameDay(prevMsg?['createdAt'], msg['createdAt']);
                            final dateText = _formatDateHeader(msg['createdAt']);
                            return _buildMessageItem(msg, showDate, dateText);
                          },
                        ),
            ),
            // Bottom Input Bar or System Room Notice
            if (isAlertRoom)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_outline, size: 16, color: Color(0xFF64748B)),
                    SizedBox(width: 8),
                    Text(
                      '알림 전용 방이라 메시지를 보낼 수 없어요.',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              )
            else
              Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
                ),
                padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // [+] 빠른 서식 / 결재 신청 버튼
                    IconButton(
                      icon: const Icon(Icons.add_circle, color: Color(0xFF2563EB), size: 28),
                      tooltip: '빠른 서식 / 결재 신청',
                      onPressed: _showQuickActionsSheet,
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 4),
                    // 단일 캡슐형 입력창 (이중 테두리 박스 제거)
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(22),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        child: TextField(
                          controller: _textController,
                          maxLines: 4,
                          minLines: 1,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _handleSendMessage(),
                          decoration: const InputDecoration(
                            hintText: '메시지를 입력하세요...',
                            hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            focusedErrorBorder: InputBorder.none,
                            filled: false,
                            fillColor: Colors.transparent,
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(vertical: 9),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _isSending ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        icon: _isSending
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                        onPressed: _isSending ? null : _handleSendMessage,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
