import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../config.dart';
import '../../models/chat_model.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import 'new_chat_dialog.dart';
import 'parent_chat_room_screen.dart';

class ParentChatRoomListScreen extends StatefulWidget {
  final bool isEmbedded;

  const ParentChatRoomListScreen({super.key, this.isEmbedded = false});

  @override
  State<ParentChatRoomListScreen> createState() => _ParentChatRoomListScreenState();
}

class _ParentChatRoomListScreenState extends State<ParentChatRoomListScreen> {
  List<ChatRoomModel> _rooms = [];
  bool _isLoading = true;
  String? _loadError;
  String? _myEmail;

  @override
  void initState() {
    super.initState();
    _myEmail = ApiService().currentUser?.email ?? 'parent@takeme.com';
    _loadRooms();

    // 실시간 대화방 갱신 소켓 리스너
    SocketService().onRoomUpdated((_) {
      if (mounted) _loadRooms();
    });
  }

  Future<void> _loadRooms() async {
    setState(() => _isLoading = true);
    try {
      final rawList = await ApiService().getChatRooms(_myEmail ?? 'parent@takeme.com', throwOnError: true);
      if (!mounted) return;

      final parsed = rawList
          .map((r) => ChatRoomModel.fromJson(r))
          .where((r) => r.type != 'PAYMENT_SYSTEM')
          .toList();

      setState(() {
        _rooms = parsed;
        _isLoading = false;
        _loadError = null;
      });
    } catch (e) {
      if (!mounted) return;
      final message = friendlyError(e);
      setState(() {
        _isLoading = false;
        if (_rooms.isEmpty) _loadError = message;
      });
      if (_rooms.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('대화 목록을 새로 불러오지 못했습니다. $message')),
        );
      }
    }
  }

  void _openNewChat() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const NewChatDialog()),
    );
    if (result != null && mounted) {
      final room = result['room'] as Map<String, dynamic>;
      final targetUser = result['targetUser'] as Map<String, dynamic>?;
      final roomId = room['id'] as int;
      final title = room['displayName'] ?? targetUser?['name'] ?? room['name'] ?? '대화방';
      final role = targetUser?['role']?.toString() ?? (room['type'] == 'GROUP' ? '그룹 대화' : '상대방');
      final opponentName = targetUser?['name']?.toString() ?? title;

      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ParentChatRoomScreen(
            roomId: roomId,
            roomName: title,
            opponentRole: role,
            opponentName: opponentName,
            isGroup: room['type'] == 'GROUP',
            memberCount: (room['members'] as List?)?.length,
            targetUser: targetUser,
            room: room,
          ),
        ),
      );
      _loadRooms();
    }
  }

  void _enterRoom(
    int roomId,
    String title,
    String role,
    String opponentName, {
    bool isGroup = false,
    int? memberCount,
    bool isSystem = false,
    Map<String, dynamic>? targetUser,
  }) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ParentChatRoomScreen(
          roomId: roomId,
          roomName: title,
          opponentRole: role,
          opponentName: opponentName,
          isGroup: isGroup,
          memberCount: memberCount,
          isSystem: isSystem,
          targetUser: targetUser,
        ),
      ),
    ).then((_) => _loadRooms());
  }

  void _showRoomActions(ChatRoomModel room, String title) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
            ),
            ListTile(
              minTileHeight: 56,
              leading: Icon(room.isPinned ? Icons.push_pin_outlined : Icons.push_pin),
              title: Text(room.isPinned ? '고정 해제' : '맨 위에 고정', style: const TextStyle(fontSize: 16)),
              onTap: () {
                Navigator.pop(ctx);
                _roomAction('/chat/rooms/${room.id}/pin', {'pinned': !room.isPinned},
                    failText: room.isPinned ? '고정을 해제하지 못했습니다.' : '고정하지 못했습니다.');
              },
            ),
            ListTile(
              minTileHeight: 56,
              leading: const Icon(Icons.delete_outline, color: Color(0xFFDC2626)),
              title: const Text('채팅방 삭제', style: TextStyle(fontSize: 16, color: Color(0xFFDC2626))),
              onTap: () {
                Navigator.pop(ctx);
                showDialog(
                  context: context,
                  builder: (dctx) => AlertDialog(
                    title: const Text('채팅방 삭제'),
                    content: Text('"$title" 채팅방을 내 목록에서 삭제할까요?\n상대방에게는 그대로 남고, 새 메시지가 오면 다시 보입니다.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(dctx), child: const Text('취소')),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(dctx);
                          _roomAction('/chat/rooms/${room.id}/hide', {}, failText: '채팅방을 삭제하지 못했습니다.');
                        },
                        child: const Text('삭제', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _roomAction(String path, Map<String, dynamic> body, {required String failText}) async {
    try {
      final res = await ApiService().postWithAuth(Uri.parse('${AppConfig.apiHost}$path'), jsonEncode(body));
      if (res.statusCode == 200 || res.statusCode == 201) {
        _loadRooms();
        return;
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$failText (${res.statusCode})')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$failText ${friendlyError(e)}')));
    }
  }

  String _formatRoomTime(dynamic createdAt) {
    if (createdAt == null) return '';
    try {
      final DateTime dt = createdAt is DateTime
          ? createdAt.toLocal()
          : DateTime.parse(createdAt.toString()).toLocal();
      final now = DateTime.now();
      if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
        return DateFormat('a h:mm', 'ko_KR').format(dt);
      } else if (dt.year == now.year && dt.month == now.month && dt.day == now.day - 1) {
        return '어제';
      } else {
        return DateFormat('M월 d일', 'ko_KR').format(dt);
      }
    } catch (_) {
      return '';
    }
  }

  Widget _buildRoomCard(ChatRoomModel room, {required bool isGroup}) {
    final title = isGroup ? room.name : room.getDisplayName(_myEmail);
    final opponent = isGroup ? null : room.getOtherMember(_myEmail);
    final opponentRole = isGroup ? '그룹 대화' : (opponent?.role ?? '교직원');
    final memberCount = room.members.length;
    final isSystem = room.type == 'SYSTEM' || room.name == 'TakeMe 알림';

    final lastMsg = room.lastMessage;
    final lastText = lastMsg?.text ??
        (room.type == 'NOTIFICATION_SYSTEM'
            ? (room.name == 'TakeMe 알림' ? '나와 우리 아이 관련 알림이 오는 방이에요' : '유치원 전체 공지가 오는 방이에요')
            : '대화 내용이 없습니다.');
    final timeStr = _formatRoomTime(lastMsg?.createdAt ?? room.updatedAt);
    final unreadCount = room.unreadCount;

    String badgeLabel = '';
    Color badgeColor = const Color(0xFF64748B);
    if (isSystem || room.type == 'NOTIFICATION_SYSTEM') {
      badgeLabel = '시스템';
      badgeColor = const Color(0xFF2563EB);
    } else if (opponentRole == 'ACADEMY_ADMIN' || opponentRole == 'SUPER_ADMIN') {
      badgeLabel = '기관 관리자';
      badgeColor = const Color(0xFFDC2626);
    } else if (opponentRole == 'HOMEROOM_TEACHER') {
      badgeLabel = opponent?.assignedClass != null ? '${opponent!.assignedClass} 담임교사' : '담임교사';
      badgeColor = const Color(0xFF2563EB);
    } else if (opponentRole == 'SHUTTLE_TEACHER') {
      badgeLabel = '지도교사';
      badgeColor = const Color(0xFF0284C7);
    } else if (opponentRole == 'TEACHER') {
      badgeLabel = '교사';
      badgeColor = const Color(0xFF0284C7);
    } else if (opponentRole == 'DRIVER') {
      badgeLabel = '기사';
      badgeColor = const Color(0xFFD97706);
    } else if (opponentRole == 'PARENT') {
      badgeLabel = '학부모';
      badgeColor = const Color(0xFF10B981);
    } else if (opponentRole == 'STUDENT') {
      badgeLabel = '학생';
      badgeColor = const Color(0xFF8B5CF6);
    }

    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: () => _enterRoom(
          room.id,
          title,
          room.type == 'NOTIFICATION_SYSTEM' ? 'SYSTEM' : opponentRole,
          room.type == 'NOTIFICATION_SYSTEM' ? title : (opponent?.name ?? title),
          isGroup: isGroup,
          memberCount: memberCount,
          isSystem: room.type == 'NOTIFICATION_SYSTEM',
        ),
        onLongPress: room.type == 'NOTIFICATION_SYSTEM' ? null : () => _showRoomActions(room, title),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              if (room.type == 'NOTIFICATION_SYSTEM' && room.name == 'TakeMe 알림')
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.notifications_active, color: Colors.white, size: 22),
                )
              else if (room.type == 'NOTIFICATION_SYSTEM')
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.campaign_rounded, color: Color(0xFF059669), size: 24),
                )
              else
                CircleAvatar(
                  radius: 24,
                  backgroundColor: const Color(0xFFEFF6FF),
                  child: Text(
                    title.isNotEmpty ? title.substring(0, 1) : '?',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
                  ),
                ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (room.isPinned) ...[
                          const Icon(Icons.push_pin, size: 14, color: Color(0xFF64748B), semanticLabel: '고정됨'),
                          const SizedBox(width: 4),
                        ],
                        Flexible(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (badgeLabel.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: badgeColor.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              badgeLabel,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: badgeColor,
                              ),
                            ),
                          ),
                        ],
                        if (isGroup) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(color: const Color(0xFFEDE9FE), borderRadius: BorderRadius.circular(10)),
                            child: Text('$memberCount명', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      lastText,
                      style: TextStyle(
                        fontSize: 13,
                        color: unreadCount > 0 ? const Color(0xFF1E293B) : const Color(0xFF64748B),
                        fontWeight: unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(timeStr, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  const SizedBox(height: 6),
                  if (unreadCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFFEF4444), borderRadius: BorderRadius.circular(10)),
                      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                      alignment: Alignment.center,
                      child: Text(
                        unreadCount > 9 ? '9+' : '$unreadCount',
                        style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
                      ),
                    )
                  else
                    const SizedBox(height: 18),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRoomsList() {
    final notiRooms = _rooms.where((r) => r.type == 'NOTIFICATION_SYSTEM').toList()
      ..sort((a, b) => (a.name == 'TakeMe 알림' ? 0 : 1).compareTo(b.name == 'TakeMe 알림' ? 0 : 1));
    final chatRooms = _rooms.where((r) => r.type == 'DIRECT' || r.type == 'GROUP').toList();
    final allRooms = [...notiRooms, ...chatRooms];

    return RefreshIndicator(
      onRefresh: _loadRooms,
      color: const Color(0xFF2563EB),
      child: (_loadError != null && allRooms.isEmpty)
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.cloud_off_rounded, size: 48, color: Color(0xFFCBD5E1)),
                  const SizedBox(height: 12),
                  const Text('대화 목록을 불러오지 못했습니다.', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  Text(_loadError!, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)), textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _loadRooms,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('다시 시도'),
                  ),
                ],
              ),
            )
          : allRooms.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF1F5F9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.forum_outlined, size: 32, color: Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    '진행 중인 대화가 없습니다.',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '우측 하단의 "새 대화" 버튼을 눌러\n담임교사, 교직원과 실시간 대화를 시작해보세요.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _openNewChat,
                    icon: const Icon(Icons.chat, size: 16),
                    label: const Text('새 대화 시작하기'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: allRooms.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 76, color: Color(0xFFF1F5F9)),
              itemBuilder: (ctx, idx) => _buildRoomCard(allRooms[idx], isGroup: allRooms[idx].type == 'GROUP'),
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        automaticallyImplyLeading: !widget.isEmbedded,
        elevation: 0,
        backgroundColor: Colors.white,
        centerTitle: false,
        title: const Text('대화방 & 메시지', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: Color(0xFF0F172A))),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            tooltip: '새로고침',
            onPressed: _loadRooms,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewChat,
        backgroundColor: const Color(0xFF2563EB),
        icon: const Icon(Icons.add_comment_rounded, color: Colors.white, size: 18),
        label: const Text('새 대화', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _buildRoomsList(),
    );
  }
}
