import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class NewChatDialog extends StatefulWidget {
  const NewChatDialog({super.key});

  @override
  State<NewChatDialog> createState() => _NewChatDialogState();
}

class _NewChatDialogState extends State<NewChatDialog> {
  final TextEditingController _searchController = TextEditingController();
  Map<String, List<Map<String, dynamic>>> _categoryUsers = {
    'admins': [],
    'teachers': [],
    'drivers': [],
    'parents': [],
  };
  bool _isLoading = true;
  bool _isCreating = false;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadUsers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    final users = await ApiService().getChatUsers();
    if (mounted) {
      setState(() {
        _categoryUsers = users;
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSelectUser(Map<String, dynamic> user) async {
    if (_isCreating) return;
    setState(() => _isCreating = true);

    final targetId = user['id'] as int;
    final targetName = user['name']?.toString() ?? '상대방';

    final room = await ApiService().createChatRoom([targetId], name: targetName);
    if (!mounted) return;

    setState(() => _isCreating = false);

    if (room != null) {
      Navigator.pop(context, {'room': room, 'targetUser': user});
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('대화방 생성에 실패했습니다.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  List<Map<String, dynamic>> _filterUsers(List<Map<String, dynamic>> list) {
    if (_searchQuery.isEmpty) return list;
    return list.where((u) {
      final name = u['name']?.toString() ?? '';
      final sub = u['subText']?.toString() ?? '';
      return name.contains(_searchQuery) || sub.contains(_searchQuery);
    }).toList();
  }

  Widget _buildCategorySection(String title, IconData icon, Color color, List<Map<String, dynamic>> users) {
    final filtered = _filterUsers(users);
    if (filtered.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                '$title (${filtered.length})',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
        ),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: filtered.length,
          separatorBuilder: (_, index) => const Divider(height: 1, indent: 64, color: Color(0xFFF1F5F9)),
          itemBuilder: (ctx, idx) {
            final u = filtered[idx];
            final name = u['name']?.toString() ?? '사용자';
            final subText = u['subText']?.toString() ?? '';

            return ListTile(
              leading: CircleAvatar(
                radius: 20,
                backgroundColor: color.withValues(alpha: 0.12),
                child: Text(
                  name.isNotEmpty ? name.substring(0, 1) : '?',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
                ),
              ),
              title: Text(
                name,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
              subtitle: subText.isNotEmpty
                  ? Text(subText, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))
                  : null,
              trailing: const Icon(Icons.chat_bubble_outline, size: 18, color: Color(0xFF94A3B8)),
              onTap: () => _handleSelectUser(u),
            );
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalCount = _categoryUsers.values.fold<int>(0, (sum, list) => sum + list.length);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          '새 대화 상대 선택',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Column(
              children: [
                // Search Field
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                      decoration: const InputDecoration(
                        icon: Icon(Icons.search, color: Color(0xFF94A3B8), size: 20),
                        hintText: '이름, 반, 역할 검색...',
                        hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: totalCount == 0
                      ? const Center(
                          child: Text(
                            '대화 가능한 상대가 없습니다.',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                          ),
                        )
                      : SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildCategorySection('기관 관리자', Icons.admin_panel_settings, const Color(0xFFDC2626), _categoryUsers['admins'] ?? []),
                              _buildCategorySection('선생님', Icons.school, const Color(0xFF2563EB), _categoryUsers['teachers'] ?? []),
                              _buildCategorySection('셔틀 기사님', Icons.directions_bus, const Color(0xFFF59E0B), _categoryUsers['drivers'] ?? []),
                              _buildCategorySection('학부모', Icons.family_restroom, const Color(0xFF10B981), _categoryUsers['parents'] ?? []),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
                ),
              ],
            ),
    );
  }
}
