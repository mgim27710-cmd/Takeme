import 'package:flutter/material.dart';
import '../../models/student_model.dart';
import '../../services/api_service.dart';

class HomeroomStudentsView extends StatefulWidget {
  const HomeroomStudentsView({super.key});

  @override
  State<HomeroomStudentsView> createState() => _HomeroomStudentsViewState();
}

class _HomeroomStudentsViewState extends State<HomeroomStudentsView> {
  bool _isLoading = true;
  List<StudentModel> _students = [];
  String _searchQuery = '';
  String _filterStatus = 'ALL'; // 'ALL' | 'WAITING' | 'BOARDED' | 'ABSENT'
  final TextEditingController _memoController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadStudents();
  }

  @override
  void dispose() {
    _memoController.dispose();
    super.dispose();
  }

  Future<void> _loadStudents() async {
    setState(() => _isLoading = true);
    final user = ApiService().currentUser;
    if (user != null) {
      final list = await ApiService().getTeacherStudents(user.email);
      if (mounted) {
        setState(() {
          _students = list;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showMemoDialog(StudentModel student) {
    _memoController.text = student.teacherMemo ?? '';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          '${student.name} 원아 메모 및 특이사항',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (student.allergies.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFD97706)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '알레르기: ${student.allergies}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _memoController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: '원아의 특이사항이나 알림 메모를 입력하세요.',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () async {
              final newMemo = _memoController.text.trim();
              Navigator.pop(ctx);
              await ApiService().saveTeacherMemo(student.id, newMemo);
              _loadStudents();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('원아 메모가 저장되었습니다.'), backgroundColor: Color(0xFF10B981)),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('저장', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)));
    }

    final totalCount = _students.length;
    final boardedCount = _students.where((s) => s.boarded).length;
    final absentCount = _students.where((s) => s.absent).length;
    final waitingCount = totalCount - boardedCount - absentCount;

    final filteredList = _students.filterByQueryAndStatus(_searchQuery, _filterStatus);

    return RefreshIndicator(
      onRefresh: _loadStudents,
      color: const Color(0xFF2563EB),
      child: Column(
        children: [
          // 1. Class Statistics Summary Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  children: [
                    _buildStatCard('우리 반 원아', '$totalCount명', const Color(0xFF2563EB), const Color(0xFFEFF6FF)),
                    const SizedBox(width: 8),
                    _buildStatCard('탑승 완료', '$boardedCount명', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
                    const SizedBox(width: 8),
                    _buildStatCard('대기 중', '$waitingCount명', const Color(0xFFD97706), const Color(0xFFFEF3C7)),
                    const SizedBox(width: 8),
                    _buildStatCard('결석/미탑승', '$absentCount명', const Color(0xFFDC2626), const Color(0xFFFEE2E2)),
                  ],
                ),
                const SizedBox(height: 12),
                // Search Input
                Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    decoration: const InputDecoration(
                      hintText: '원아 이름 검색...',
                      hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      prefixIcon: Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Status Filter Tabs
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            color: Colors.white,
            child: Row(
              children: [
                _buildFilterChip('전체 ($totalCount)', 'ALL'),
                const SizedBox(width: 6),
                _buildFilterChip('대기 ($waitingCount)', 'WAITING'),
                const SizedBox(width: 6),
                _buildFilterChip('탑승완료 ($boardedCount)', 'BOARDED'),
                const SizedBox(width: 6),
                _buildFilterChip('결석 ($absentCount)', 'ABSENT'),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // 3. Student Card List
          Expanded(
            child: filteredList.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.sentiment_dissatisfied, size: 48, color: Color(0xFFCBD5E1)),
                        const SizedBox(height: 12),
                        Text(
                          _students.isEmpty
                              ? '배정된 학급에 등록된 원아가 없습니다.'
                              : '검색 조건과 일치하는 원아가 없습니다.',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                        ),
                        if (_students.isEmpty) ...[
                          const SizedBox(height: 6),
                          const Text(
                            '관리자 웹 [학급 관리] 메뉴에서 반 배정을 완료해주세요.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredList.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 12),
                    itemBuilder: (ctx, idx) {
                      final student = filteredList[idx];
                      return _buildStudentCard(student);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String count, Color textColor, Color bgColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            Text(title, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: textColor.withValues(alpha: 0.8))),
            const SizedBox(height: 2),
            Text(count, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: textColor)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String status) {
    final isSelected = _filterStatus == status;
    return GestureDetector(
      onTap: () => setState(() => _filterStatus = status),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildStudentCard(StudentModel student) {
    Color statusColor;
    String statusText;
    Color statusBg;

    if (student.boarded) {
      statusColor = const Color(0xFF16A34A);
      statusText = '탑승 완료';
      statusBg = const Color(0xFFDCFCE7);
    } else if (student.absent) {
      statusColor = const Color(0xFFDC2626);
      statusText = '결석/미탑승';
      statusBg = const Color(0xFFFEE2E2);
    } else {
      statusColor = const Color(0xFFD97706);
      statusText = '탑승 대기';
      statusBg = const Color(0xFFFEF3C7);
    }

    return Container(
      padding: const EdgeInsets.all(14),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Name, Status Badge, Memo Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    student.name,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  if (student.className != null && student.className!.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        student.className!,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                      ),
                    ),
                  ],
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Vehicle & Expected Time
          Row(
            children: [
              const Icon(Icons.directions_bus, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Text(
                student.vehicleName ?? '통학차량',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.access_time, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Text(
                '예상: ${student.expectedTime}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Address
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  student.address,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          // Allergies Warning
          if (student.allergies.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFD97706)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      '알레르기: ${student.allergies}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Teacher Memo & Actions
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (student.teacherMemo != null && student.teacherMemo!.isNotEmpty)
                Expanded(
                  child: Text(
                    '메모: ${student.teacherMemo}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF6D28D9), fontStyle: FontStyle.italic),
                    overflow: TextOverflow.ellipsis,
                  ),
                )
              else
                const Text('메모 없음', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              OutlinedButton.icon(
                onPressed: () => _showMemoDialog(student),
                icon: const Icon(Icons.edit_note, size: 14, color: Color(0xFF2563EB)),
                label: const Text('메모', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                  minimumSize: const Size(0, 28),
                  side: const BorderSide(color: Color(0xFFBFDBFE)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

extension StudentListFilter on List<StudentModel> {
  List<StudentModel> filterByQueryAndStatus(String query, String status) {
    return where((s) {
      if (query.isNotEmpty && !s.name.contains(query)) return false;
      if (status == 'BOARDED' && !s.boarded) return false;
      if (status == 'ABSENT' && !s.absent) return false;
      if (status == 'WAITING' && (s.boarded || s.absent)) return false;
      return true;
    }).toList();
  }
}

