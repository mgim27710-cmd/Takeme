import '../../widgets/load_error_view.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/pending_photo.dart';
import '../../services/socket_service.dart';

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

  @override
  void initState() {
    super.initState();
    _currentUserId = ApiService().currentUser?.id;
    _initChat();
  }

  @override
  void dispose() {
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
          final exists = _messages.any((m) => m['id'] == data['id']);
          if (!exists) {
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
  }

  int _toNumber(dynamic v) {
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }

  /// userInitiated: 사용자가 직접 새로고침/다시 시도한 경우
  Future<void> _loadMessages({bool userInitiated = false}) async {
    if (_messages.isEmpty && mounted) {
      setState(() {
        _isLoading = true;
        _loadError = null;
      });
    }
    try {
      final list = await ApiService().getChatMessages(widget.roomId, throwOnError: true);
      if (mounted) {
        setState(() {
          _messages = list;
          _isLoading = false;
          _loadError = null;
        });
        _scrollToBottom();
        // 메시지를 실제로 불러왔을 때만 읽음 처리 (못 본 메시지를 읽은 것으로 처리하지 않는다)
        ApiService().markChatRoomAsRead(widget.roomId);
      }
    } catch (e) {
      if (!mounted) return;
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

  // ───────────── 대화창 '+' 메뉴: 휴가 신청 / 사진 보내기 ─────────────

  bool _isUploadingPhoto = false;

  void _showPlusMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _plusMenuItem(Icons.beach_access_rounded, '휴가 신청', const Color(0xFF2563EB), () {
                Navigator.pop(ctx);
                _showLeaveRequestSheet();
              }),
              _plusMenuItem(Icons.photo_library_rounded, '사진', const Color(0xFF10B981), () {
                Navigator.pop(ctx);
                _pickAndSendPhoto(ImageSource.gallery);
              }),
              _plusMenuItem(Icons.photo_camera_rounded, '카메라', const Color(0xFFF59E0B), () {
                Navigator.pop(ctx);
                _pickAndSendPhoto(ImageSource.camera);
              }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _plusMenuItem(IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
          ],
        ),
      ),
    );
  }

  /// 메시지를 서버에 보내고 화면 목록에 바로 넣는다. 성공하면 true
  Future<bool> _sendRaw(String text, {String? type, Map<String, dynamic>? payload}) async {
    final result = await ApiService().sendChatMessage(widget.roomId, text, type: type, payload: payload);
    if (!mounted) return false;
    if (result == null) return false;
    setState(() {
      final exists = _messages.any((m) => m['id'] == result['id']);
      if (!exists) _messages.add(result);
    });
    _scrollToBottom();
    return true;
  }

  Future<void> _pickAndSendPhoto(ImageSource source) async {
    if (_isUploadingPhoto) return;
    // 카메라·갤러리가 켜져 있는 동안 안드로이드가 이 앱을 종료할 수 있다.
    // 어느 대화방인지 적어 두면, 앱이 다시 켜졌을 때 홈 화면이 사진을 찾아 이 대화방으로 보내고 대화방을 다시 열어 준다.
    await PendingPhoto.save(widget.roomId, widget.title);
    try {
      final picked = await ImagePicker().pickImage(source: source, maxWidth: 1600, imageQuality: 80);
      await PendingPhoto.clear(); // 앱이 그대로 살아 있었으니 복구는 필요 없다
      if (picked == null) return;
      if (!mounted) return;
      setState(() => _isUploadingPhoto = true);

      final result = await ApiService().sendChatPhoto(widget.roomId, picked);
      if (!mounted) return;
      if (result == null) {
        _showSnack('사진을 보내지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      setState(() {
        final exists = _messages.any((m) => m['id'] == result['id']);
        if (!exists) _messages.add(result);
      });
      _scrollToBottom();
    } catch (e) {
      await PendingPhoto.clear();
      if (mounted) _showSnack('사진을 보내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _showSnack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: const Color(0xFFEF4444)),
    );
  }

  /// 휴가·연차 신청서: 웹 메신저와 같은 문구로 이 대화방에 메시지로 보낸다 (받는 사람이 확인)
  void _showLeaveRequestSheet() {
    final me = ApiService().currentUser;
    final nameCtrl = TextEditingController(text: me?.name ?? '');
    final reasonCtrl = TextEditingController(text: '개인 사유로 인한 정기 연차 사용');
    final fmt = DateFormat('yyyy-MM-dd');
    var leaveType = '연차 휴가';
    var start = DateTime.now();
    var end = DateTime.now();
    var needSubstitute = true;
    var sending = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          // 키보드가 없을 때는 하단 시스템 버튼 바(뒤로가기·홈) 높이만큼, 있을 때는 키보드 높이만큼 비워 둔다
          padding: EdgeInsets.fromLTRB(
            20,
            16,
            20,
            (MediaQuery.of(ctx).viewInsets.bottom > 0
                    ? MediaQuery.of(ctx).viewInsets.bottom
                    : MediaQuery.of(ctx).viewPadding.bottom) +
                20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('휴가·연차 신청', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                const SizedBox(height: 4),
                const Text('이 대화방으로 신청서가 전달됩니다.', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                const SizedBox(height: 14),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: '신청자', border: OutlineInputBorder(), isDense: true),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: leaveType,
                  decoration: const InputDecoration(labelText: '구분', border: OutlineInputBorder(), isDense: true),
                  items: const ['연차 휴가', '병가', '경조사 휴가', '기타']
                      .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                      .toList(),
                  onChanged: (v) => setSheet(() => leaveType = v ?? leaveType),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    final range = await showDateRangePicker(
                      context: ctx,
                      firstDate: DateTime.now().subtract(const Duration(days: 30)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDateRange: DateTimeRange(start: start, end: end),
                    );
                    if (range != null) setSheet(() { start = range.start; end = range.end; });
                  },
                  icon: const Icon(Icons.date_range_rounded),
                  label: Text('기간: ${fmt.format(start)} ~ ${fmt.format(end)}'),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('대체 인력 배정 필요', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  value: needSubstitute,
                  onChanged: (v) => setSheet(() => needSubstitute = v),
                ),
                TextField(
                  controller: reasonCtrl,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: '신청 사유', border: OutlineInputBorder(), isDense: true),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: sending
                        ? null
                        : () async {
                            if (nameCtrl.text.trim().isEmpty) {
                              _showSnack('신청자 성함을 입력해 주세요.');
                              return;
                            }
                            setSheet(() => sending = true);
                            final text = '[임직원 휴가·연차 신청서]\n'
                                '신청자: ${nameCtrl.text.trim()} (차량기사)\n'
                                '구분: $leaveType\n'
                                '기간: ${fmt.format(start)} ~ ${fmt.format(end)}\n'
                                '대체 인력 배정: ${needSubstitute ? '필요 (대체 기사/교사 배정 요청)' : '불필요'}\n'
                                '신청 사유: ${reasonCtrl.text.trim().isEmpty ? '개인 사유' : reasonCtrl.text.trim()}\n\n'
                                '원장님의 승인 결재를 부탁드립니다.';
                            final ok = await _sendRaw(text);
                            if (!ctx.mounted) return;
                            if (ok) {
                              Navigator.pop(ctx);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('휴가 신청서를 보냈습니다.')));
                              }
                            } else {
                              setSheet(() => sending = false);
                              _showSnack('신청서를 보내지 못했습니다. 다시 시도해 주세요.');
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(sending ? '보내는 중...' : '신청서 보내기', style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ───────────── 말풍선 안 내용: 사진이면 사진, 아니면 글자 ─────────────

  String? _imageUrlOf(Map<String, dynamic> msg) {
    if (msg['type'] != 'IMAGE') return null;
    final p = msg['payload'];
    if (p is Map && p['imageUrl'] is String && (p['imageUrl'] as String).isNotEmpty) return p['imageUrl'] as String;
    return null;
  }

  Widget _bubbleContent(Map<String, dynamic> msg, String text, Color textColor) {
    final url = _imageUrlOf(msg);
    if (url == null) {
      return Text(text, style: TextStyle(color: textColor, fontSize: 14, height: 1.4));
    }
    return GestureDetector(
      onTap: () => showDialog(
        context: context,
        builder: (ctx) => Dialog(
          backgroundColor: Colors.black,
          insetPadding: EdgeInsets.zero,
          child: Stack(
            children: [
              InteractiveViewer(child: Center(child: Image.network(url, fit: BoxFit.contain))),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(ctx)),
              ),
            ],
          ),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          url,
          width: 200,
          fit: BoxFit.cover,
          loadingBuilder: (c, child, progress) => progress == null
              ? child
              : const SizedBox(width: 200, height: 140, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
          errorBuilder: (c, e, s) => SizedBox(
            width: 200,
            height: 80,
            child: Center(child: Text('사진을 불러오지 못했습니다', style: TextStyle(fontSize: 12, color: textColor))),
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
                            const Text(
                              'TakeMe 시스템 알림',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF2563EB),
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
                      ],
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: isMe
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
                        child: _bubbleContent(msg, text, Colors.white),
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
                                  child: _bubbleContent(msg, text, const Color(0xFF1E293B)),
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
                ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final subText = widget.targetUser?['subText'] ?? '';

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
        title: Column(
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
            if (widget.isSystem || widget.title == 'TakeMe 알림' || widget.room?['type'] == 'SYSTEM' || widget.room?['name'] == 'TakeMe 알림' || widget.room?['isSystem'] == true)
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
                      '시스템 알림 전용 대화방입니다. 답장을 보낼 수 없습니다.',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              )
            else
              Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                padding: EdgeInsets.fromLTRB(
                  12,
                  8,
                  12,
                  8,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // '+' 버튼: 휴가 신청, 사진 보내기
                    Container(
                      width: 42,
                      height: 42,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: const BoxDecoration(color: Color(0xFFF1F5F9), shape: BoxShape.circle),
                      child: IconButton(
                        tooltip: '휴가 신청·사진',
                        icon: _isUploadingPhoto
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.add_rounded, color: Color(0xFF475569), size: 24),
                        onPressed: _isUploadingPhoto ? null : _showPlusMenu,
                      ),
                    ),
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
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
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 42,
                      height: 42,
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
