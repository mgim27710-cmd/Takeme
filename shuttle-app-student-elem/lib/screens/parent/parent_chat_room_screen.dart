import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/chat_model.dart';
import '../../services/api_service.dart';

class ParentChatRoomScreen extends StatefulWidget {
  final int roomId;
  final String roomName;
  final String? opponentRole;
  final String? opponentName;

  const ParentChatRoomScreen({
    super.key,
    required this.roomId,
    required this.roomName,
    this.opponentRole,
    this.opponentName,
  });

  @override
  State<ParentChatRoomScreen> createState() => _ParentChatRoomScreenState();
}

class _ParentChatRoomScreenState extends State<ParentChatRoomScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  List<ChatMessageModel> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  Timer? _pollingTimer;
  String? _myEmail;

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
    _loadMessages(initial: true);

    // 2.5초 간격 실시간 폴링
    _pollingTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) {
      if (mounted) {
        _loadMessages(initial: false);
      }
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool initial = false}) async {
    if (initial) {
      setState(() => _isLoading = true);
    }
    final rawList = await ApiService().getChatMessages(
      widget.roomId,
      email: _myEmail,
      userId: ApiService().currentUser?.id,
    );

    if (!mounted) return;

    final parsed = rawList.map((m) => ChatMessageModel.fromJson(m)).toList();
    
    // 메시지 개수가 바뀌었거나 초기 로드일 때만 갱신 및 스크롤
    final hasNewMessages = parsed.length != _messages.length;
    setState(() {
      _messages = parsed;
      _isLoading = false;
    });

    if (hasNewMessages || initial) {
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage([String? presetText]) async {
    final text = presetText ?? _textController.text.trim();
    if (text.isEmpty || _isSending) return;

    _textController.clear();
    setState(() => _isSending = true);

    // 낙관적 UI 업데이트 (즉시 화면에 말풍선 표시)
    final optimisticMsg = ChatMessageModel(
      id: DateTime.now().millisecondsSinceEpoch,
      roomId: widget.roomId,
      text: text,
      type: 'TEXT',
      createdAt: DateTime.now(),
      senderId: ApiService().currentUser?.id ?? 0,
      senderName: ApiService().currentUser?.name ?? '나',
      senderEmail: _myEmail ?? '',
      senderRole: 'PARENT',
      readBy: [],
    );

    setState(() {
      _messages.add(optimisticMsg);
    });
    _scrollToBottom();

    final res = await ApiService().sendChatMessage(
      roomId: widget.roomId,
      text: text,
      senderEmail: _myEmail ?? 'parent@takeme.com',
    );

    if (mounted) {
      setState(() => _isSending = false);
      if (!res['success']) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? '메시지 전송에 실패했습니다.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      } else {
        // 성공 시 메시지 목록 재동기화
        _loadMessages();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.opponentName ?? widget.roomName;
    final subtitle = widget.opponentRole ?? '1:1 소통 채널';

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9), // 부드러운 메신저 배경색
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFFEFF6FF),
              child: const Icon(Icons.school_rounded, color: Color(0xFF2563EB), size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Row(
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981), // 온라인 초록색
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            tooltip: '새로고침',
            onPressed: () => _loadMessages(),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 안심 공지 배너
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFFE0E7FF),
              child: Row(
                children: [
                  const Icon(Icons.shield_outlined, size: 16, color: Color(0xFF3730A3)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      '원아 보호 및 교원 소통을 위한 공식 1:1 안심 메신저입니다.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF3730A3),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // 메시지 리스트
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty
                      ? _buildEmptyState()
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg.isMe(_myEmail);
                            final showDateHeader = index == 0 ||
                                _shouldShowDateHeader(_messages[index - 1], msg);

                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (showDateHeader) _buildDateHeader(msg.createdAt),
                                _buildMessageBubble(msg, isMe),
                              ],
                            );
                          },
                        ),
            ),

            // 빠른 메시지 템플릿 칩 가로 스크롤
            Container(
              height: 44,
              color: Colors.white,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF334155),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // 하단 입력 바
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: _textController,
                        focusNode: _focusNode,
                        maxLines: 4,
                        minLines: 1,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _sendMessage(),
                        decoration: const InputDecoration(
                          hintText: '메시지를 입력하세요...',
                          hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: _isSending ? null : () => _sendMessage(),
                    borderRadius: BorderRadius.circular(24),
                    child: Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
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
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              ),
                            )
                          : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
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

  bool _shouldShowDateHeader(ChatMessageModel prev, ChatMessageModel curr) {
    return prev.createdAt.year != curr.createdAt.year ||
        prev.createdAt.month != curr.createdAt.month ||
        prev.createdAt.day != curr.createdAt.day;
  }

  Widget _buildDateHeader(DateTime date) {
    final dateStr = DateFormat('yyyy년 M월 d일 EEEE', 'ko').format(date);
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          dateStr,
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessageModel msg, bool isMe) {
    final timeStr = DateFormat('a h:mm', 'ko').format(msg.createdAt);

    if (isMe) {
      // 내 메시지 (우측 블루 버블)
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              timeStr,
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Container(
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
                  msg.text,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    } else {
      // 상대방 메시지 (좌측 흰색 버블)
      final senderRoleBadge = _getRoleBadge(msg.senderRole);

      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFFE0E7FF),
              child: Text(
                msg.senderName.isNotEmpty ? msg.senderName.substring(0, 1) : '교',
                style: const TextStyle(
                  color: Color(0xFF3730A3),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
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
                        msg.senderName,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                      if (senderRoleBadge != null) ...[
                        const SizedBox(width: 4),
                        senderRoleBadge,
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Flexible(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(4),
                              topRight: Radius.circular(16),
                              bottomLeft: Radius.circular(16),
                              bottomRight: Radius.circular(16),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Text(
                            msg.text,
                            style: const TextStyle(
                              color: Color(0xFF1E293B),
                              fontSize: 14,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        timeStr,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }
  }

  Widget? _getRoleBadge(String role) {
    if (role == 'HOMEROOM_TEACHER') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text(
          '담임교사',
          style: TextStyle(fontSize: 9, color: Color(0xFF92400E), fontWeight: FontWeight.bold),
        ),
      );
    } else if (role == 'ACADEMY_ADMIN') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text(
          '원장선생님',
          style: TextStyle(fontSize: 9, color: Color(0xFF166534), fontWeight: FontWeight.bold),
        ),
      );
    }
    return null;
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.chat_bubble_outline_rounded, size: 36, color: Color(0xFF2563EB)),
          ),
          const SizedBox(height: 12),
          const Text(
            '대화를 시작해보세요!',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: Color(0xFF334155),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            '선생님 또는 원장님께 문의하실 내용을 남겨주시면\n확인 후 답변을 드립니다.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
          ),
        ],
      ),
    );
  }
}
