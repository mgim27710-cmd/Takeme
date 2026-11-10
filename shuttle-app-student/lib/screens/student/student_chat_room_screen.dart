import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/chat_model.dart';
import '../../services/api_service.dart';

class StudentChatRoomScreen extends StatefulWidget {
  final int roomId;
  final String roomName;
  final String? opponentRole;
  final String? opponentName;

  const StudentChatRoomScreen({
    super.key,
    required this.roomId,
    required this.roomName,
    this.opponentRole,
    this.opponentName,
  });

  @override
  State<StudentChatRoomScreen> createState() => _StudentChatRoomScreenState();
}

class _StudentChatRoomScreenState extends State<StudentChatRoomScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  List<ChatMessageModel> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  Timer? _pollingTimer;
  String? _myEmail;

  final List<String> _quickTemplates = [
    '🚌 오늘 보강 수업 후 하교 셔틀 탑승하겠습니다.',
    '⏱️ 기사님, 오늘 정류장에 2분 정도 늦을 것 같습니다.',
    '🏥 오늘 병원 진료로 통학 셔틀 미탑승(개별 귀가)합니다.',
    '📚 오늘 방과후 자율학습 참여 예정입니다.',
    '👍 공지사항 내용 잘 확인했습니다. 감사합니다!',
  ];

  @override
  void initState() {
    super.initState();
    _myEmail = ApiService().currentUser?.email ?? 'student@takeme.com';
    _loadMessages(initial: true);

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
    final rawList = await ApiService().getChatMessages(widget.roomId, email: _myEmail);
    if (!mounted) return;

    final parsed = rawList.map((m) => ChatMessageModel.fromJson(m)).toList();
    parsed.sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final bool hadNewMessages = parsed.length != _messages.length;

    setState(() {
      _messages = parsed;
      _isLoading = false;
    });

    if (hadNewMessages) {
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 80,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage([String? textToSend]) async {
    final text = textToSend ?? _textController.text.trim();
    if (text.isEmpty || _isSending) return;

    if (textToSend == null) {
      _textController.clear();
    }

    setState(() => _isSending = true);

    final res = await ApiService().sendChatMessage(
      roomId: widget.roomId,
      text: text,
      senderEmail: _myEmail ?? 'student@takeme.com',
    );

    if (res['success']) {
      await _loadMessages(initial: false);
      _scrollToBottom();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? '메시지 전송에 실패했습니다.')),
        );
      }
    }

    if (mounted) {
      setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.opponentName ?? widget.roomName;
    final role = widget.opponentRole ?? '대화 상대';

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        titleSpacing: 0,
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFFEEF2FF),
              child: Text(
                title.isNotEmpty ? title.substring(0, 1) : '대',
                style: const TextStyle(color: Color(0xFF4338CA), fontWeight: FontWeight.bold, fontSize: 14),
              ),
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
                  Text(
                    role,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 메시지 리스트
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF4338CA)))
                  : _messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.chat_bubble_outline_rounded, size: 48, color: Color(0xFFCBD5E1)),
                              SizedBox(height: 12),
                              Text(
                                '대화 내용이 없습니다.\n아래 템플릿이나 입력창으로 첫 메시지를 보내보세요!',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.4),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final msg = _messages[index];
                            final isMe = msg.isMe(_myEmail);
                            return _buildMessageBubble(msg, isMe);
                          },
                        ),
            ),

            // 빠른 템플릿 버튼 스크롤바
            Container(
              height: 42,
              color: Colors.white,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                itemCount: _quickTemplates.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final template = _quickTemplates[index];
                  return InkWell(
                    onTap: () => _sendMessage(template),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        template,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                      ),
                    ),
                  );
                },
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),

            // 입력창
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(20),
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
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: _isSending ? null : () => _sendMessage(),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFF4338CA),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4338CA).withValues(alpha: 0.3),
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
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
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

  Widget _buildMessageBubble(ChatMessageModel msg, bool isMe) {
    final timeStr = DateFormat('a h:mm', 'ko').format(msg.createdAt);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (isMe) ...[
            Text(timeStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isMe ? const Color(0xFF4338CA) : Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMe ? 16 : 4),
                  bottomRight: Radius.circular(isMe ? 4 : 16),
                ),
                border: isMe ? null : Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                msg.text,
                style: TextStyle(
                  color: isMe ? Colors.white : const Color(0xFF0F172A),
                  fontSize: 14,
                  height: 1.35,
                ),
              ),
            ),
          ),
          if (!isMe) ...[
            const SizedBox(width: 6),
            Text(timeStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          ],
        ],
      ),
    );
  }
}
