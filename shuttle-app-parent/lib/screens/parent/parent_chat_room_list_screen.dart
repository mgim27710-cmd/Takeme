import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/chat_model.dart';
import '../../services/api_service.dart';
import 'parent_chat_room_screen.dart';

/// 대화 가능한 유치원 교직원 및 통학차량 담당자 모델
class ChatContact {
  final int userId;
  final String name;
  final String roleTitle;
  final String category; // '교사', '원장/행정', '통학차량'
  final String description;
  final IconData icon;
  final Color themeColor;
  final Color bgColor;

  const ChatContact({
    required this.userId,
    required this.name,
    required this.roleTitle,
    required this.category,
    required this.description,
    required this.icon,
    required this.themeColor,
    required this.bgColor,
  });
}

class ParentChatRoomListScreen extends StatefulWidget {
  final bool isEmbedded;

  const ParentChatRoomListScreen({super.key, this.isEmbedded = false});

  @override
  State<ParentChatRoomListScreen> createState() => _ParentChatRoomListScreenState();
}

class _ParentChatRoomListScreenState extends State<ParentChatRoomListScreen> {
  List<ChatRoomModel> _rooms = [];
  bool _isLoading = true;
  String? _myEmail;

  List<ChatContact> _contacts = [];
  bool _isLoadingContacts = false;

  /// DB 연결 실패 시 사용할 기본 예시 명단
  static const List<ChatContact> _fallbackContacts = [
    ChatContact(
      userId: 80,
      name: '김하늘 선생님',
      roleTitle: '햇살반 담임교사',
      category: '담임·교사',
      description: '원아 생활, 알림장, 출결 및 원내 지도 상담',
      icon: Icons.face_rounded,
      themeColor: Color(0xFF2563EB),
      bgColor: Color(0xFFEFF6FF),
    ),
    ChatContact(
      userId: 68,
      name: '김고윤 원장님',
      roleTitle: '유치원 원장',
      category: '원장·행정',
      description: '유치원 전반 운영, 원비, 행정 및 학사 일정 문의',
      icon: Icons.account_balance_rounded,
      themeColor: Color(0xFF059669),
      bgColor: Color(0xFFECFDF5),
    ),
    ChatContact(
      userId: 88,
      name: '윤찬영 기사님',
      roleTitle: '1호차 셔틀 운전기사',
      category: '통학차량',
      description: '통학버스 승하차 장소 및 실시간 운행/탑승 상담',
      icon: Icons.directions_bus_rounded,
      themeColor: Color(0xFFD97706),
      bgColor: Color(0xFFFFFBEB),
    ),
    ChatContact(
      userId: 330,
      name: '김민규 학부모님',
      roleTitle: '김도윤 학부모',
      category: '학부모',
      description: '원아 친구 학부모님과 1:1 소통 및 육아/원 생활 정보 공유',
      icon: Icons.family_restroom_rounded,
      themeColor: Color(0xFF8B5CF6),
      bgColor: Color(0xFFF5F3FF),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _myEmail = ApiService().currentUser?.email ?? 'parent@takeme.com';
    _loadRooms();
    _loadContacts();
  }

  
  Future<void> _loadContacts() async {
    setState(() => _isLoadingContacts = true);
    try {
      final res = await ApiService().getChatUsers(_myEmail ?? 'parent@takeme.com');
      final List<ChatContact> fetched = [];

      // 1. 원장님 및 행정실 (DB admins)
      final admins = res['admins'] ?? [];
      for (final a in admins) {
        final aName = (a['name'] ?? '').toString();
        fetched.add(ChatContact(
          userId: a['id'] as int,
          name: aName.contains('원장') ? aName : (aName.isNotEmpty ? '$aName 원장님' : '원장님'),
          roleTitle: a['subText'] ?? '유치원 원장',
          category: '원장·행정',
          description: '유치원 전반 운영, 원비 및 학사 일정 문의',
          icon: Icons.account_balance_rounded,
          themeColor: const Color(0xFF059669),
          bgColor: const Color(0xFFECFDF5),
        ));
      }

      // 2. 담임 및 동승 교사 (DB teachers)
      final teachers = res['teachers'] ?? [];
      for (final t in teachers) {
        final isShuttle = t['role'] == 'SHUTTLE_TEACHER';
        fetched.add(ChatContact(
          userId: t['id'] as int,
          name: t['name'] ?? '선생님',
          roleTitle: t['subText'] ?? (isShuttle ? '동승 안전교사' : '담임교사'),
          category: isShuttle ? '통학차량' : '담임·교사',
          description: isShuttle ? '차량 내 원아 안전 지도 및 승하차 대기' : '원아 생활, 알림장, 출결 및 원내 지도 상담',
          icon: isShuttle ? Icons.health_and_safety_rounded : Icons.face_rounded,
          themeColor: isShuttle ? const Color(0xFF7C3AED) : const Color(0xFF2563EB),
          bgColor: isShuttle ? const Color(0xFFF5F3FF) : const Color(0xFFEFF6FF),
        ));
      }

      // 3. 통학 셔틀 기사님 (DB drivers)
      final drivers = res['drivers'] ?? [];
      for (final d in drivers) {
        final dName = (d['name'] ?? '').toString();
        fetched.add(ChatContact(
          userId: d['id'] as int,
          name: dName.contains('기사') ? dName : (dName.isNotEmpty ? '$dName 기사님' : '기사님'),
          roleTitle: d['subText'] ?? '통학버스 기사',
          category: '통학차량',
          description: '통학버스 승하차 장소 및 실시간 운행/도착 문의',
          icon: Icons.directions_bus_rounded,
          themeColor: const Color(0xFFD97706),
          bgColor: const Color(0xFFFFFBEB),
        ));
      }

      // 4. 원아 학부모님 (DB parents)
      final parents = res['parents'] ?? [];
      for (final p in parents) {
        final pEmail = p['email'] ?? '';
        if (_myEmail != null && pEmail == _myEmail) continue; // 본인 제외

        final pName = (p['name'] ?? '').toString();
        final childSub = p['subText'] ?? '원아 학부모';
        fetched.add(ChatContact(
          userId: p['id'] as int,
          name: pName.contains('학부모') ? pName : (pName.isNotEmpty ? '$pName 학부모님' : '학부모님'),
          roleTitle: childSub,
          category: '학부모',
          description: '원아 친구 학부모님과 1:1 소통 및 정보 공유',
          icon: Icons.family_restroom_rounded,
          themeColor: const Color(0xFF8B5CF6),
          bgColor: const Color(0xFFF5F3FF),
        ));
      }

      if (mounted) {
        setState(() {
          _contacts = fetched.isNotEmpty ? fetched : _fallbackContacts;
          _isLoadingContacts = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _contacts = _fallbackContacts;
          _isLoadingContacts = false;
        });
      }
    }
  }

  Future<void> _loadRooms() async {
    setState(() => _isLoading = true);
    final rawList = await ApiService().getChatRooms(_myEmail ?? 'parent@takeme.com');
    if (!mounted) return;

    final parsed = rawList
        .map((r) => ChatRoomModel.fromJson(r))
        .where((r) => r.type != 'PAYMENT_SYSTEM')
        .toList();

    setState(() {
      _rooms = parsed;
      _isLoading = false;
    });
  }

  Future<void> _openDirectRoom({
    required String name,
    required int targetUserId,
    required String roleName,
  }) async {
    // 1. 이미 열린 대화방이 있는지 탐색
    for (final room in _rooms) {
      final other = room.getOtherMember(_myEmail);
      if (other != null && other.userId == targetUserId) {
        _enterRoom(room.id, room.getDisplayName(_myEmail), roleName, other.name);
        return;
      }
    }

    // 2. 없으면 백엔드에 1:1 대화방 생성 요청
    final res = await ApiService().createChatRoom(
      name: name,
      type: 'DIRECT',
      userIds: [targetUserId],
      creatorEmail: _myEmail ?? 'parent@takeme.com',
    );

    if (res['success'] && res['data'] != null) {
      final newRoomId = res['data']['id'] as int;
      if (mounted) {
        _loadRooms();
        _enterRoom(newRoomId, name, roleName, name);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? '채팅방 생성에 실패했습니다.')),
        );
      }
    }
  }

  void _enterRoom(int roomId, String title, String role, String opponentName) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ParentChatRoomScreen(
          roomId: roomId,
          roomName: title,
          opponentRole: role,
          opponentName: opponentName,
        ),
      ),
    ).then((_) => _loadRooms());
  }

  /// 채팅할 사람 선택 바텀시트 열기
  void _showContactPicker() {
    if (_contacts.isEmpty) {
      _loadContacts();
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String searchQuery = '';
        String selectedCategory = '전체';

        return StatefulBuilder(
          builder: (context, setModalState) {
            final filteredContacts = _contacts.where((c) {
              final matchCat = selectedCategory == '전체' || c.category == selectedCategory;
              final matchQuery = searchQuery.isEmpty ||
                  c.name.contains(searchQuery) ||
                  c.roleTitle.contains(searchQuery) ||
                  c.description.contains(searchQuery);
              return matchCat && matchQuery;
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  // 드래그 핸들
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // 헤더
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              '채팅할 사람 선택',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              '대화할 선생님 또는 교직원을 선택해주세요.',
                              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Color(0xFF94A3B8)),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // 검색창
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TextField(
                        onChanged: (val) {
                          setModalState(() {
                            searchQuery = val.trim();
                          });
                        },
                        decoration: const InputDecoration(
                          hintText: '이름, 직책으로 검색 (예: 담임, 기사님)',
                          hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                          prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF64748B), size: 20),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // 카테고리 칩
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: ['전체', '담임·교사', '학부모', '통학차량', '원장·행정'].map((cat) {
                        final isSelected = selectedCategory == cat;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(
                              cat,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? Colors.white : const Color(0xFF475569),
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: const Color(0xFF2563EB),
                            backgroundColor: const Color(0xFFF8FAFC),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0),
                              ),
                            ),
                            onSelected: (_) {
                              setModalState(() {
                                selectedCategory = cat;
                              });
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const Divider(height: 20, thickness: 1, color: Color(0xFFF1F5F9)),

                  // 교직원 리스트 (DB 실시간 연동)
                  Expanded(
                    child: _isLoadingContacts && _contacts.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                CircularProgressIndicator(),
                                SizedBox(height: 12),
                                Text(
                                  '교직원, 학부모 및 기사님 명단을 불러오는 중입니다...',
                                  style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                ),
                              ],
                            ),
                          )
                        : filteredContacts.isEmpty
                            ? const Center(
                                child: Text(
                                  '검색된 담당자가 없습니다.',
                                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                                ),
                              )
                            : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: filteredContacts.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 10),
                            itemBuilder: (_, index) {
                              final contact = filteredContacts[index];
                              return InkWell(
                                onTap: () {
                                  Navigator.pop(ctx);
                                  _openDirectRoom(
                                    name: contact.name,
                                    targetUserId: contact.userId,
                                    roleName: contact.roleTitle,
                                  );
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
                                        color: Colors.black.withValues(alpha: 0.02),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    children: [
                                      // 아바타
                                      Container(
                                        width: 48,
                                        height: 48,
                                        decoration: BoxDecoration(
                                          color: contact.bgColor,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          contact.icon,
                                          color: contact.themeColor,
                                          size: 26,
                                        ),
                                      ),
                                      const SizedBox(width: 14),

                                      // 정보
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Text(
                                                  contact.name,
                                                  style: const TextStyle(
                                                    fontSize: 15,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF0F172A),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: contact.bgColor,
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(color: contact.themeColor.withValues(alpha: 0.3)),
                                                  ),
                                                  child: Text(
                                                    contact.roleTitle,
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w600,
                                                      color: contact.themeColor,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              contact.description,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF64748B),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ],
                                        ),
                                      ),

                                      // 대화하기 버튼 아이콘
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFEFF6FF),
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: const Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              '대화',
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF2563EB),
                                              ),
                                            ),
                                            SizedBox(width: 2),
                                            Icon(Icons.arrow_forward_ios_rounded, size: 11, color: Color(0xFF2563EB)),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        automaticallyImplyLeading: !widget.isEmbedded,
        title: const Text(
          '1:1 메시지',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: widget.isEmbedded
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 20),
                onPressed: () => Navigator.pop(context),
              ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFF2563EB), size: 24),
            tooltip: '채팅할 사람 선택',
            onPressed: _showContactPicker,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadRooms,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                children: [
                  // 상단 배너 카드
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2563EB).withValues(alpha: 0.2),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.forum_rounded, color: Colors.white, size: 26),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '선생님 · 학부모 1:1 안심 대화',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                '원아의 출결, 투약, 하원 변경 등 신속한 상담이 가능합니다.',
                                style: TextStyle(
                                  color: Color(0xFFDBEAFE),
                                  fontSize: 12,
                                  height: 1.3,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // 채팅할 사람 선택 카드 (빠른 상담 연결 대신 배치된 메인 액션 카드)
                  InkWell(
                    onTap: _showContactPicker,
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFBFDBFE), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF2563EB).withValues(alpha: 0.06),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: const BoxDecoration(
                              color: Color(0xFFEFF6FF),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person_search_rounded, color: Color(0xFF2563EB), size: 24),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  '채팅할 사람 선택하기',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  '선생님, 원장님, 학부모님, 기사님과 1:1 대화 시작',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Row(
                              children: [
                                Text(
                                  '선택',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 10),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // 참여 중인 대화방 섹션 헤더
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        '참여 중인 대화방',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF334155),
                        ),
                      ),
                      Text(
                        '총 ${_rooms.length}개',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if (_rooms.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      alignment: Alignment.center,
                      child: Column(
                        children: [
                          const Icon(Icons.chat_bubble_outline_rounded, size: 44, color: Color(0xFFCBD5E1)),
                          const SizedBox(height: 10),
                          const Text(
                            '현재 진행 중인 대화방이 없습니다.\n위의 [채팅할 사람 선택하기]를 눌러 1:1 대화를 시작해보세요!',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13, height: 1.4),
                          ),
                          const SizedBox(height: 14),
                          OutlinedButton.icon(
                            onPressed: _showContactPicker,
                            icon: const Icon(Icons.person_add_rounded, size: 16),
                            label: const Text('채팅 상대 선택'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF2563EB),
                              side: const BorderSide(color: Color(0xFF93C5FD)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._rooms.map((room) => _buildRoomCard(room)),
                ],
              ),
      ),
    );
  }

  Widget _buildRoomCard(ChatRoomModel room) {
    final other = room.getOtherMember(_myEmail);
    final displayName = room.getDisplayName(_myEmail);
    final opponentName = other?.name ?? displayName;
    final opponentRole = other?.role == 'HOMEROOM_TEACHER'
        ? '햇살반 담임교사'
        : other?.role == 'ACADEMY_ADMIN'
            ? '유치원 원장'
            : (other?.role == 'DRIVER' ? '통학버스 기사' : (other?.role == 'PARENT' ? '원아 학부모' : '교직원'));

    final latestText = room.latestMessage?.text ?? '대화를 시작해보세요.';
    String timeStr = '';
    if (room.latestMessage != null) {
      timeStr = DateFormat('a h:mm', 'ko').format(room.latestMessage!.createdAt);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        onTap: () => _enterRoom(room.id, displayName, opponentRole, opponentName),
        leading: CircleAvatar(
          radius: 24,
          backgroundColor: const Color(0xFFEFF6FF),
          child: Text(
            opponentName.isNotEmpty ? opponentName.substring(0, 1) : '대',
            style: const TextStyle(
              color: Color(0xFF2563EB),
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                displayName,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: Color(0xFF0F172A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (timeStr.isNotEmpty)
              Text(
                timeStr,
                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  latestText,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (room.unreadCount > 0)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${room.unreadCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
