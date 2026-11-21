import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../widgets/load_error_view.dart';
import 'board_community_screen.dart';
import 'class_board_screen.dart';

class ParentChatRoomScreen extends StatefulWidget {
  final int roomId;
  final String roomName;
  final String? opponentRole;
  final String? opponentName;
  final bool isGroup;
  final int? memberCount;
  final Map<String, dynamic>? targetUser;
  final bool isSystem;
  final Map<String, dynamic>? room;

  const ParentChatRoomScreen({
    super.key,
    required this.roomId,
    required this.roomName,
    this.opponentRole,
    this.opponentName,
    this.isGroup = false,
    this.memberCount,
    this.targetUser,
    this.isSystem = false,
    this.room,
  });

  @override
  State<ParentChatRoomScreen> createState() => _ParentChatRoomScreenState();
}

class _ParentChatRoomScreenState extends State<ParentChatRoomScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  List<Map<String, dynamic>> _messages = [];
  bool _isLoading = true;
  String? _loadError;
  bool _isSending = false;
  Timer? _pollingTimer;
  String? _myEmail;
  int? _myUserId;
  List<Map<String, dynamic>> _children = [];

  final List<String> _quickTemplates = [
    '💊 오늘 감기약 복용 부탁드립니다.',
    '🚗 하원 시 보호자(가족)가 직접 픽업 예정입니다.',
    '⏱️ 오늘 셔틀 도착 예상 시간 문의드립니다.',
    '🏥 아이 컨디션 저조로 오늘 결석 신청합니다.',
    '🙏 알림장 내용 잘 확인했습니다. 감사합니다!',
  ];

  @override
  void initState() {
    super.initState();
    _myEmail = ApiService().currentUser?.email ?? 'parent@takeme.com';
    _myUserId = ApiService().currentUser?.id;
    _initChat();
    _loadChildren();
  }

  @override
  void dispose() {
    SocketService().leaveChatRoom(widget.roomId);
    SocketService().offChatEvents();
    _pollingTimer?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadChildren() async {
    try {
      final list = await ApiService().getChildInfoList();
      if (mounted && list.isNotEmpty) {
        setState(() => _children = list);
      }
    } catch (_) {}
  }

  Future<void> _initChat() async {
    // 1. 소켓 방 입장
    SocketService().joinChatRoom(widget.roomId);

    // 2. 초기 메시지 로드 및 읽음 처리
    await _loadMessages(initial: true);

    // 3. 실시간 소켓 메시지 수신 리스너
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
                'email': data['senderEmail'] ?? '',
                'role': data['senderRole'] ?? '',
              };
            }
            if (data['text'] == null && data['message'] != null) {
              data['text'] = data['message'];
            }
            _messages.add(data);
          }
        });
        _scrollToBottom();
        ApiService().markChatRoomAsRead(widget.roomId);
      }
    });

    // 4. 상대방 읽음 처리 수신
    SocketService().onMessagesRead((data) {
      if (!mounted) return;
      final msgRoomId = data['roomId'];
      if (msgRoomId != null && _toNumber(msgRoomId) == widget.roomId) {
        setState(() {
          for (final m in _messages) {
            m['unreadCount'] = 0;
          }
        });
      }
    });

    // 5. 보조 폴링 타이머 (소켓 미연결/불안정 대비 3초 주기)
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) {
        _loadMessages(initial: false, silent: true);
      }
    });
  }

  int _toNumber(dynamic v) {
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }

  Future<void> _loadMessages({bool initial = false, bool silent = false}) async {
    if (initial && _messages.isEmpty && mounted) {
      setState(() {
        _isLoading = true;
        _loadError = null;
      });
    }
    try {
      final list = await ApiService().getChatMessages(
        widget.roomId,
        email: _myEmail,
        userId: _myUserId,
        throwOnError: true,
      );
      if (mounted) {
        final hasNew = list.length != _messages.length;
        setState(() {
          _messages = list;
          _isLoading = false;
          _loadError = null;
        });
        if (hasNew || initial) {
          _scrollToBottom();
        }
        ApiService().markChatRoomAsRead(widget.roomId);
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        setState(() {
          _isLoading = false;
          if (_messages.isEmpty) _loadError = _friendlyError(e);
        });
      }
    }
  }

  String _friendlyError(dynamic e) {
    final s = e.toString();
    if (s.contains('SocketException') || s.contains('Connection refused')) {
      return '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
    }
    if (s.contains('TimeoutException')) {
      return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    return s.replaceAll('Exception:', '').trim();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0, // reverse ListView: 0 = 맨 아래(가장 최신 메시지)
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  bool _isMe(Map<String, dynamic> msg) {
    final sender = msg['sender'] as Map<String, dynamic>? ?? {};
    final senderEmail = (sender['email'] ?? msg['senderEmail'] ?? '').toString().toLowerCase();
    final myEmail = (_myEmail ?? '').toLowerCase();
    if (myEmail.isNotEmpty && senderEmail.isNotEmpty && senderEmail == myEmail) {
      return true;
    }
    final senderId = sender['id'] ?? msg['senderId'];
    if (_myUserId != null && senderId != null && _toNumber(senderId) == _myUserId) {
      return true;
    }
    return false;
  }

  // =========================================================================
  // 메시지 전송 로직
  // =========================================================================

  Future<void> _handleSendMessage({String? presetText, String? type, Map<String, dynamic>? payload}) async {
    final text = (presetText ?? _textController.text).trim();
    if (text.isEmpty || _isSending) return;

    _textController.clear();
    setState(() => _isSending = true);

    // 낙관적 UI 즉시 반영
    final tempId = DateTime.now().millisecondsSinceEpoch;
    final optimisticMsg = {
      'id': tempId,
      'roomId': widget.roomId,
      'text': text,
      'type': type ?? 'TEXT',
      'createdAt': DateTime.now().toIso8601String(),
      'sender': {
        'id': _myUserId ?? 0,
        'name': ApiService().currentUser?.name ?? '학부모',
        'email': _myEmail ?? '',
        'role': 'PARENT',
      },
      'payload': payload,
      'unreadCount': 1,
    };

    setState(() {
      _messages.add(optimisticMsg);
    });
    _scrollToBottom();

    final res = await ApiService().sendChatMessage(
      roomId: widget.roomId,
      text: text,
      senderEmail: _myEmail ?? 'parent@takeme.com',
      type: type,
      payload: payload,
    );

    if (mounted) {
      setState(() => _isSending = false);
      if (res['success'] == true) {
        final data = res['data'];
        if (data is Map<String, dynamic>) {
          setState(() {
            final optIdx = _messages.indexWhere((m) => m['id'] == tempId);
            if (optIdx >= 0) {
              _messages[optIdx] = data;
            } else if (!_messages.any((m) => m['id'] == data['id'])) {
              _messages.add(data);
            }
          });
          _scrollToBottom();
        } else {
          _loadMessages(initial: false, silent: true);
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? '메시지 전송에 실패했습니다.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  // =========================================================================
  // [+] 버튼 빠른 서식 모달 바텀시트
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
                title: '등원 지각 알림서 (지각원)',
                subtitle: '병원 진료 등 예상 등원 시간 및 사유 안내',
                onTap: () {
                  Navigator.pop(ctx);
                  _showLatenessDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.family_restroom,
                color: const Color(0xFF7C3AED),
                title: '연장 보육 신청서',
                subtitle: '야근 등 하원 후 연장 보육 돌봄 신청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showExtendedCareDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.directions_car,
                color: const Color(0xFF0D9488),
                title: '학부모 직접 픽업 신청서',
                subtitle: '보호자 직접 픽업 및 셔틀 하차 제외 신청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showParentPickupDialog();
                },
              ),
              _buildFormTile(
                icon: Icons.directions_bus,
                color: const Color(0xFF2563EB),
                title: '셔틀 탑승 및 배정/변경 결재 신청',
                subtitle: '탑승지 변경 및 신규 셔틀 배정 요청',
                onTap: () {
                  Navigator.pop(ctx);
                  _showShuttleApprovalDialog();
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

  String _getDefaultChildName() {
    if (_children.isNotEmpty) {
      return _children[0]['name']?.toString() ?? '자녀';
    }
    return '';
  }

  // =========================================================================
  // 1. 원아 결석계 (결석원) 서식 다이얼로그
  // =========================================================================

  void _showAbsenceDialog() {
    final nameCtrl = TextEditingController(text: _getDefaultChildName());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final tomorrowStr = DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 1)));

    String startDate = todayStr;
    String endDate = todayStr;
    String reason = '감기 및 몸살';
    final detailCtrl = TextEditingController();

    final List<String> reasonChips = [
      '감기 및 몸살',
      '병원 진료/치료',
      '가정 체험 학습',
      '집안 경조사/개인사정',
      '수두/유행성 질환',
      '기타',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFE11D48).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.event_busy, color: Color(0xFFE11D48), size: 18),
              ),
              const SizedBox(width: 8),
              const Text('원아 결석계 (결석원)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: InputDecoration(
                    labelText: '대상 원아 이름',
                    hintText: '예: 박민준',
                    isDense: true,
                    suffixIcon: _children.length > 1
                        ? PopupMenuButton<String>(
                            icon: const Icon(Icons.arrow_drop_down),
                            onSelected: (val) => setDState(() => nameCtrl.text = val),
                            itemBuilder: (_) => _children.map((c) => PopupMenuItem(value: c['name']?.toString(), child: Text(c['name']?.toString() ?? ''))).toList(),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('결석 적용 일자:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    Row(
                      children: [
                        InkWell(
                          onTap: () => setDState(() {
                            startDate = todayStr;
                            endDate = todayStr;
                          }),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: startDate == todayStr && endDate == todayStr ? const Color(0xFFE11D48) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('오늘', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: startDate == todayStr && endDate == todayStr ? Colors.white : const Color(0xFF475569))),
                          ),
                        ),
                        const SizedBox(width: 6),
                        InkWell(
                          onTap: () => setDState(() {
                            startDate = tomorrowStr;
                            endDate = tomorrowStr;
                          }),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: startDate == tomorrowStr && endDate == tomorrowStr ? const Color(0xFFE11D48) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('내일', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: startDate == tomorrowStr && endDate == tomorrowStr ? Colors.white : const Color(0xFF475569))),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: DateTime.tryParse(startDate) ?? DateTime.now(),
                            firstDate: DateTime.now().subtract(const Duration(days: 7)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setDState(() {
                              startDate = DateFormat('yyyy-MM-dd').format(picked);
                              if (endDate.compareTo(startDate) < 0) endDate = startDate;
                            });
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: Text(startDate, style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('~', style: TextStyle(fontWeight: FontWeight.bold))),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: DateTime.tryParse(endDate) ?? DateTime.now(),
                            firstDate: DateTime.tryParse(startDate) ?? DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setDState(() => endDate = DateFormat('yyyy-MM-dd').format(picked));
                          }
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: Text(endDate, style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B))),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text('결석 사유 빠른 선택:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: reasonChips.map((r) {
                    final isSel = reason == r;
                    return InkWell(
                      onTap: () => setDState(() => reason = r),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isSel ? const Color(0xFFFFF1F2) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isSel ? const Color(0xFFE11D48) : const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          r,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            color: isSel ? const Color(0xFFE11D48) : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: detailCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: '상세 사유',
                    hintText: '증상 또는 기타 상세 내용 입력',
                    isDense: true,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
            ElevatedButton(
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final detail = detailCtrl.text.trim();
                if (name.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('원아 이름을 입력해주세요.')));
                  return;
                }
                Navigator.pop(ctx);

                final periodText = startDate == endDate ? startDate : '$startDate ~ $endDate';
                final fullReason = detail.isNotEmpty ? '$reason ($detail)' : reason;
                final text = '[원아 결석계 (결석원)]\n- 대상 원아: $name\n- 적용 기간: $periodText\n- 결석 사유: $reason\n- 상세 내용: ${detail.isNotEmpty ? detail : '사유 기재 없음'}\n\n출결 및 통학버스 결석 승인을 요청합니다.';

                final payload = {
                  'isAbsenceForm': true,
                  'formType': 'ABSENCE',
                  'formTitle': '원아 결석계 (결석원)',
                  'studentName': name,
                  'startDate': startDate,
                  'endDate': endDate,
                  'reason': fullReason,
                  'status': 'PENDING',
                  'type': 'change_request',
                };

                // 1. 채팅 메시지로 결재 카드 전송
                _handleSendMessage(presetText: text, type: 'ABSENCE_REQUEST', payload: payload);

                // 2. 백엔드 출결/오버라이드 시스템 비동기 연동
                try {
                  await ApiService().createOverride(
                    email: _myEmail ?? 'parent@takeme.com',
                    targetDate: startDate,
                    overrideType: 'ABSENCE',
                    reason: fullReason,
                  );
                } catch (_) {}
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48)),
              child: const Text('결석계 (결석원) 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // 2. 등원 지각 알림서 (지각원) 서식 다이얼로그
  // =========================================================================

  void _showLatenessDialog() {
    final nameCtrl = TextEditingController(text: _getDefaultChildName());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final tomorrowStr = DateFormat('yyyy-MM-dd').format(DateTime.now().add(const Duration(days: 1)));

    String date = todayStr;
    final timeCtrl = TextEditingController(text: '10:30');
    String reason = '병원 진료 후 등원';
    final detailCtrl = TextEditingController();

    final List<String> reasonChips = [
      '병원 진료 후 등원',
      '가정 사정 / 늦잠',
      '교통 정체 / 차량 지연',
      '기타',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFD97706).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.more_time, color: Color(0xFFD97706), size: 18),
              ),
              const SizedBox(width: 8),
              const Text('등원 지각 알림서 (지각원)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '대상 원아 이름', isDense: true),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('지각 일자:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                    Row(
                      children: [
                        InkWell(
                          onTap: () => setDState(() => date = todayStr),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: date == todayStr ? const Color(0xFFD97706) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('오늘', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: date == todayStr ? Colors.white : const Color(0xFF475569))),
                          ),
                        ),
                        const SizedBox(width: 6),
                        InkWell(
                          onTap: () => setDState(() => date = tomorrowStr),
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: date == tomorrowStr ? const Color(0xFFD97706) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text('내일', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: date == tomorrowStr ? Colors.white : const Color(0xFF475569))),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: timeCtrl,
                  decoration: const InputDecoration(labelText: '예상 등원 시간', hintText: '예: 10:30', isDense: true),
                ),
                const SizedBox(height: 14),
                const Text('지각 사유 빠른 선택:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: reasonChips.map((r) {
                    final isSel = reason == r;
                    return InkWell(
                      onTap: () => setDState(() => reason = r),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isSel ? const Color(0xFFFFFBEB) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isSel ? const Color(0xFFD97706) : const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          r,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            color: isSel ? const Color(0xFFD97706) : const Color(0xFF475569),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: detailCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: '상세 사유', hintText: '상세 내용 입력', isDense: true),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
            ElevatedButton(
              onPressed: () {
                final name = nameCtrl.text.trim();
                final time = timeCtrl.text.trim();
                final detail = detailCtrl.text.trim();
                if (name.isEmpty) return;
                Navigator.pop(ctx);

                final fullReason = detail.isNotEmpty ? '$reason ($detail)' : reason;
                final text = '[등원 지각 알림서 (지각원)]\n- 대상 원아: $name\n- 지각 일자: $date\n- 예상 등원 시간: $time\n- 지각 사유: $reason\n- 상세 내용: ${detail.isNotEmpty ? detail : '상세 사유 없음'}\n\n확인 및 출결 반영 부탁드립니다.';

                final payload = {
                  'isAbsenceForm': true,
                  'formType': 'LATENESS',
                  'formTitle': '등원 지각 알림서 (지각원)',
                  'studentName': name,
                  'targetTime': time,
                  'startDate': date,
                  'endDate': date,
                  'reason': fullReason,
                  'status': 'PENDING',
                  'type': 'change_request',
                };

                _handleSendMessage(presetText: text, type: 'ABSENCE_REQUEST', payload: payload);
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD97706)),
              child: const Text('지각원 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // 3. 연장 보육 신청서 서식 다이얼로그
  // =========================================================================

  void _showExtendedCareDialog() {
    final nameCtrl = TextEditingController(text: _getDefaultChildName());
    final timeCtrl = TextEditingController(text: '17:30');
    final parentCtrl = TextEditingController(text: '학부모 직접 픽업');
    final reasonCtrl = TextEditingController(text: '보호자 야근으로 인한 연장 보육 신청');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('연장 보육 / 개별 하원 신청서', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: '원아 이름', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: timeCtrl, decoration: const InputDecoration(labelText: '직접 픽업 예정 시간', hintText: '예: 17:30', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: parentCtrl, decoration: const InputDecoration(labelText: '보호자 / 픽업자 정보', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: '신청 사유', isDense: true)),
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

              final text = '[연장 보육 / 개별 하원 신청서]\n- 원아명: $name\n- 픽업 예정 시간: ${timeCtrl.text.trim()}\n- 보호자 정보: ${parentCtrl.text.trim()}\n- 사유: ${reasonCtrl.text.trim()}\n- 셔틀 하차 제외: 신청 완료\n\n확인 및 승인 부탁드립니다.';
              final payload = {
                'isAbsenceForm': true,
                'formType': 'EXTENDED_CARE',
                'formTitle': '연장 보육 / 개별 하원 신청서',
                'studentName': name,
                'targetTime': timeCtrl.text.trim(),
                'parentInfo': parentCtrl.text.trim(),
                'reason': reasonCtrl.text.trim(),
                'status': 'PENDING',
                'type': 'change_request',
              };

              _handleSendMessage(presetText: text, type: 'ABSENCE_REQUEST', payload: payload);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('신청서 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // 4. 학부모 직접 픽업 신청서 다이얼로그
  // =========================================================================

  void _showParentPickupDialog() {
    final nameCtrl = TextEditingController(text: _getDefaultChildName());
    final timeCtrl = TextEditingController(text: '16:30');
    final parentCtrl = TextEditingController(text: '보호자 직접 픽업');
    final reasonCtrl = TextEditingController(text: '개인 사정으로 직접 픽업 (셔틀 미탑승)');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('학부모 직접 픽업 신청서', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: '원아 이름', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: timeCtrl, decoration: const InputDecoration(labelText: '직접 픽업 예정 시간', hintText: '예: 16:30', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: parentCtrl, decoration: const InputDecoration(labelText: '보호자 / 픽업자 정보', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: '사유 및 비고', isDense: true)),
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

              final text = '[학부모 직접 픽업 신청서]\n- 원아명: $name\n- 픽업 예정 시간: ${timeCtrl.text.trim()}\n- 보호자 정보: ${parentCtrl.text.trim()}\n- 사유: ${reasonCtrl.text.trim()}\n- 셔틀 미탑승(하차 제외) 안내\n\n확인 부탁드립니다.';
              final payload = {
                'isAbsenceForm': true,
                'formType': 'PARENT_PICKUP',
                'formTitle': '학부모 직접 픽업 신청서',
                'studentName': name,
                'targetTime': timeCtrl.text.trim(),
                'parentInfo': parentCtrl.text.trim(),
                'reason': reasonCtrl.text.trim(),
                'status': 'PENDING',
                'type': 'change_request',
              };

              _handleSendMessage(presetText: text, type: 'ABSENCE_REQUEST', payload: payload);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D9488)),
            child: const Text('신청서 제출', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // 5. 셔틀 탑승 결재 신청 다이얼로그
  // =========================================================================

  void _showShuttleApprovalDialog() {
    final nameCtrl = TextEditingController(text: _getDefaultChildName());
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
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: '원아 이름', hintText: '예: 김하늘', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: busCtrl, decoration: const InputDecoration(labelText: '배정 희망 차량', hintText: '예: 1호차', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: locCtrl, decoration: const InputDecoration(labelText: '신청 탑승 장소', hintText: '예: 래미안아파트 후문', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: timeCtrl, decoration: const InputDecoration(labelText: '예상 탑승 시간', hintText: '예: 08:40', isDense: true)),
              const SizedBox(height: 10),
              TextField(controller: noteCtrl, maxLines: 2, decoration: const InputDecoration(labelText: '신청 메모 / 사유', hintText: '요청사항 및 메모', isDense: true)),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () {
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
                'studentName': name,
                'busNumber': bus,
                'boardingLocation': loc,
                'targetTime': time,
                'note': note,
                'status': 'PENDING',
                'type': 'change_request',
              };

              _handleSendMessage(presetText: text, type: 'PAYMENT_REQUEST', payload: payload);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            child: const Text('신청서 보내기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // 전자결재 / 서식 카드 위젯 빌더
  // =========================================================================

  Widget _buildApprovalCard(Map<String, dynamic> msg, bool isMe) {
    final payload = msg['payload'] as Map<String, dynamic>? ?? {};
    final text = msg['text']?.toString() ?? '';
    final status = (payload['status']?.toString() ?? 'PENDING').toUpperCase();
    final formTitle = payload['formTitle']?.toString() ?? '전자결재 신청서';

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
                Icon(Icons.assignment, size: 16, color: statusColor),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    formTitle,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // 날짜 헤더 및 메시지 뷰 빌더
  // =========================================================================

  bool _isSameDay(dynamic a, dynamic b) {
    if (a == null || b == null) return false;
    try {
      final da = DateTime.parse(a.toString()).toLocal();
      final db = DateTime.parse(b.toString()).toLocal();
      return da.year == db.year && da.month == db.month && da.day == db.day;
    } catch (_) {
      return false;
    }
  }

  String _formatDateHeader(dynamic dateStr) {
    if (dateStr == null) return '';
    try {
      final dt = DateTime.parse(dateStr.toString()).toLocal();
      return DateFormat('yyyy년 M월 d일 EEEE', 'ko_KR').format(dt);
    } catch (_) {
      return '';
    }
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

  Widget _buildDateSeparator(String text) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildMessageItem(Map<String, dynamic> msg, bool showDate, String dateText) {
    final isMe = _isMe(msg);
    final text = msg['text']?.toString() ?? msg['message']?.toString() ?? '';
    final timeStr = _formatMessageTime(msg['createdAt']);
    final unreadCount = _toNumber(msg['unreadCount'] ?? 0);
    final sender = msg['sender'] as Map<String, dynamic>? ?? {};
    final senderName = (sender['name'] ?? msg['senderName'] ?? (isMe ? '나' : (widget.opponentName ?? '상대방'))).toString();
    final senderRole = (sender['role'] ?? msg['senderRole'] ?? '').toString();

    final isSystemMessage = msg['sender'] == null ||
        msg['type'] == 'SYSTEM' ||
        widget.isSystem ||
        widget.roomName == 'TakeMe 알림' ||
        widget.room?['type'] == 'SYSTEM' ||
        widget.room?['name'] == 'TakeMe 알림';

    final isFormCard = msg['type'] == 'PAYMENT_REQUEST' ||
        msg['type'] == 'ABSENCE_REQUEST' ||
        (msg['payload'] != null && msg['payload']['type'] == 'change_request') ||
        text.contains('[원아 결석계') ||
        text.contains('[등원 지각 알림서') ||
        text.contains('[신규 탑승 및 결재 신청]') ||
        text.contains('[연장 보육 / 개별 하원 신청서]') ||
        text.contains('[학부모 직접 픽업 신청서]');

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
                          MaterialPageRoute(builder: (_) => const ClassBoardScreen()),
                        );
                      } else if (text.contains('게시물') || text.contains('게시글') || text.contains('활동 사진')) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const BoardCommunityScreen()),
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
                                        : 'TakeMe 시스템 알림',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: text.contains('알림장') ? const Color(0xFFEA580C) : const Color(0xFF2563EB),
                                ),
                              ),
                              Text(timeStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(text, style: const TextStyle(fontSize: 13.5, color: Color(0xFF1E293B), height: 1.45)),
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
                                  Text('알림장 확인 >', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFEA580C))),
                                ],
                              ),
                            ),
                          ] else if (text.contains('게시물') || text.contains('게시글')) ...[
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
                                  Text('게시판 확인 >', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
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
            child: isFormCard
                ? Align(
                    alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                    child: _buildApprovalCard(msg, isMe),
                  )
                : (isMe
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              if (unreadCount > 0)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text(
                                    '$unreadCount',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFF59E0B)),
                                  ),
                                ),
                              Text(timeStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                            ],
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Container(
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.68),
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
                              child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4)),
                            ),
                          ),
                        ],
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: const Color(0xFFDBEAFE),
                            child: Text(
                              senderName.isNotEmpty ? senderName.substring(0, 1) : '?',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      senderName,
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                                    ),
                                    if (senderRole.isNotEmpty) ...[
                                      const SizedBox(width: 4),
                                      _buildRoleBadge(senderRole),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Flexible(
                                      child: Container(
                                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.68),
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
                                        child: Text(text, style: const TextStyle(color: Color(0xFF1E293B), fontSize: 14, height: 1.4)),
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
                                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFF59E0B)),
                                            ),
                                          ),
                                        Text(timeStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
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

  Widget _buildRoleBadge(String role) {
    String label = '선생님';
    Color bgColor = const Color(0xFFFEF3C7);
    Color textColor = const Color(0xFF92400E);

    if (role == 'HOMEROOM_TEACHER') {
      label = '담임교사';
      bgColor = const Color(0xFFFEF3C7);
      textColor = const Color(0xFF92400E);
    } else if (role == 'ACADEMY_ADMIN') {
      label = '원장선생님';
      bgColor = const Color(0xFFDCFCE7);
      textColor = const Color(0xFF166534);
    } else if (role == 'DRIVER') {
      label = '기사님';
      bgColor = const Color(0xFFE0E7FF);
      textColor = const Color(0xFF3730A3);
    } else if (role == 'SHUTTLE_TEACHER') {
      label = '차량지도교사';
      bgColor = const Color(0xFFF3E8FF);
      textColor = const Color(0xFF6B21A8);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: TextStyle(fontSize: 9, color: textColor, fontWeight: FontWeight.bold)),
    );
  }

  bool get _isAlertOnlyRoom =>
      widget.isSystem ||
      widget.opponentRole == 'SYSTEM' ||
      widget.roomName == 'TakeMe 알림' ||
      widget.roomName == '공지사항' ||
      widget.roomName == '실시간 알림 채널' ||
      widget.room?['type'] == 'SYSTEM' ||
      widget.room?['type'] == 'NOTIFICATION_SYSTEM' ||
      widget.room?['name'] == 'TakeMe 알림';

  @override
  Widget build(BuildContext context) {
    final isNoticeRoom = widget.roomName == '공지사항' || (widget.room?['type'] == 'NOTIFICATION_SYSTEM' && widget.roomName != 'TakeMe 알림');
    final isAlertRoom = _isAlertOnlyRoom;
    final title = isAlertRoom ? widget.roomName : (widget.opponentName ?? widget.roomName);
    final subText = isAlertRoom
        ? (isNoticeRoom ? '유치원 전체 공지가 오는 방이에요' : '나와 우리 아이 관련 알림이 오는 방이에요')
        : (widget.isGroup ? '${widget.memberCount ?? "다수"}명 참여 중' : (widget.opponentRole ?? '1:1 소통 채널'));

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
            ] else ...[
              CircleAvatar(
                radius: 17,
                backgroundColor: widget.isGroup ? const Color(0xFFEDE9FE) : const Color(0xFFEFF6FF),
                child: Icon(
                  widget.isGroup ? Icons.groups_rounded : Icons.school_rounded,
                  color: widget.isGroup ? const Color(0xFF7C3AED) : const Color(0xFF2563EB),
                  size: 19,
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subText.isNotEmpty)
                    Text(
                      subText,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF64748B)),
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: () => _loadMessages(initial: false),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // 메시지 리스트
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                  : (_loadError != null && _messages.isEmpty)
                      ? LoadErrorView(
                          title: '메시지를 불러오지 못했습니다.',
                          message: _loadError!,
                          onRetry: () => _loadMessages(initial: true),
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
                                final idx = _messages.length - 1 - i;
                                final msg = _messages[idx];
                                final prevMsg = idx > 0 ? _messages[idx - 1] : null;
                                final showDate = (idx == 0) || !_isSameDay(prevMsg?['createdAt'], msg['createdAt']);
                                final dateText = _formatDateHeader(msg['createdAt']);
                                return _buildMessageItem(msg, showDate, dateText);
                              },
                            ),
            ),

            // 빠른 메시지 템플릿 칩 가로 스크롤
            Container(
              height: 42,
              color: Colors.white,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                scrollDirection: Axis.horizontal,
                itemCount: _quickTemplates.length,
                separatorBuilder: (context, idx) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final text = _quickTemplates[index];
                  return InkWell(
                    onTap: () {
                      _textController.text = text;
                      _focusNode.requestFocus();
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        text,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                      ),
                    ),
                  );
                },
              ),
            ),

            // 하단 입력 바 (교사 대화방과 100% 동일한 [+] 버튼 및 단일 캡슐형 입력 구조)
            Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
              ),
              padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // [+] 빠른 서식 / 결재 신청 버튼 (결석원, 지각원 등)
                  IconButton(
                    icon: const Icon(Icons.add_circle, color: Color(0xFF2563EB), size: 28),
                    tooltip: '빠른 서식 / 결재 신청',
                    onPressed: _showQuickActionsSheet,
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 4),
                  // 단일 캡슐형 입력창
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: TextField(
                        controller: _textController,
                        focusNode: _focusNode,
                        maxLines: 4,
                        minLines: 1,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _handleSendMessage(),
                        decoration: const InputDecoration(
                          hintText: '메시지를 입력하세요...',
                          hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 9),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // 전송 버튼
                  InkWell(
                    onTap: _isSending ? null : () => _handleSendMessage(),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _isSending ? const Color(0xFF94A3B8) : const Color(0xFF2563EB),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF2563EB).withValues(alpha: 0.3),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: _isSending
                          ? const Center(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              ),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 19),
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
