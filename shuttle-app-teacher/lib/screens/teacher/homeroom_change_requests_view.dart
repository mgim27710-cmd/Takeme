import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';

class HomeroomChangeRequestsView extends StatefulWidget {
  const HomeroomChangeRequestsView({super.key});

  @override
  State<HomeroomChangeRequestsView> createState() => _HomeroomChangeRequestsViewState();
}

class _HomeroomChangeRequestsViewState extends State<HomeroomChangeRequestsView> {
  bool _isLoading = true;
  Map<String, dynamic> _summary = {
    'total': 0,
    'approved': 0,
    'pending': 0,
    'rejected': 0,
    'absence': 0,
    'individualDismissal': 0,
    'lateness': 0,
    'pickup': 0,
    'noShuttle': 0,
    'oneTimeBoarding': 0,
  };
  List<Map<String, dynamic>> _requests = [];
  String _assignedClass = '';
  List<Map<String, dynamic>> _students = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final todayRes = await ApiService().getClassTodayChangeRequests();
    final attRes = await ApiService().getHomeroomAttendance();

    if (!mounted) return;

    if (todayRes != null) {
      _assignedClass = todayRes['assignedClass']?.toString() ?? '';
      if (todayRes['summary'] is Map) {
        _summary = Map<String, dynamic>.from(todayRes['summary'] as Map);
      }
      final rawReqs = todayRes['requests'] as List<dynamic>? ?? [];
      _requests = rawReqs.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }

    if (attRes != null && attRes['students'] is List) {
      final rawStuds = attRes['students'] as List<dynamic>;
      _students = rawStuds.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }

    setState(() => _isLoading = false);
  }

  void _showProxyRequestModal() {
    showDialog(
      context: context,
      builder: (ctx) => _ProxyRequestDialog(
        students: _students,
        onSuccess: _loadData,
      ),
    );
  }

  Color _getStatusBg(String status) {
    switch (status) {
      case 'APPROVED':
        return const Color(0xFFDCFCE7);
      case 'REJECTED':
        return const Color(0xFFFEE2E2);
      case 'PENDING':
      default:
        return const Color(0xFFFEF3C7);
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'APPROVED':
        return const Color(0xFF15803D);
      case 'REJECTED':
        return const Color(0xFFB91C1C);
      case 'PENDING':
      default:
        return const Color(0xFFB45309);
    }
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'APPROVED':
        return '승인됨';
      case 'REJECTED':
        return '반려됨';
      case 'PENDING':
      default:
        return '결재 대기';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final todayStr = DateFormat('yyyy년 M월 d일 (E)', 'ko').format(DateTime.now());

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Banner & Proxy Request Button
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E40AF), Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '$_assignedClass 담임',
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              todayStr,
                              style: const TextStyle(color: Color(0xFFDBEAFE), fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        ElevatedButton.icon(
                          onPressed: _showProxyRequestModal,
                          icon: const Icon(Icons.add, size: 16, color: Color(0xFF1E40AF)),
                          label: const Text(
                            '대리 신청',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF1E40AF)),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      '우리 반 오늘 통학 변경 현황',
                      style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '학부모 신청 및 승인된 통학 변경 사항이 실시간으로 집계됩니다.',
                      style: TextStyle(color: Color(0xFFBFDBFE), fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // KPI Counters (한눈에 보기)
              Row(
                children: [
                  _buildKpiCard('결석', '${_summary['absence'] ?? 0}명', const Color(0xFFEF4444), const Color(0xFFFEF2F2)),
                  const SizedBox(width: 8),
                  _buildKpiCard('직접하원', '${_summary['individualDismissal'] ?? 0}명', const Color(0xFF3B82F6), const Color(0xFFEFF6FF)),
                  const SizedBox(width: 8),
                  _buildKpiCard('보호자픽업', '${_summary['pickup'] ?? 0}명', const Color(0xFF8B5CF6), const Color(0xFFF5F3FF)),
                  const SizedBox(width: 8),
                  _buildKpiCard('지각', '${_summary['lateness'] ?? 0}명', const Color(0xFFF59E0B), const Color(0xFFFFFBEB)),
                ],
              ),
              const SizedBox(height: 20),

              // Request List Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '오늘의 신청 내역 (${_requests.length}건)',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  TextButton.icon(
                    onPressed: _loadData,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('새로고침', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (_requests.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 28),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        '오늘 변경된 통학 일정이 없습니다.',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '학부모 신청이 들어오거나 대리 신청을 등록하면 여기에 표시됩니다.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
                ..._requests.map((r) {
                  final status = r['status']?.toString() ?? 'PENDING';
                  final studentName = r['studentName']?.toString() ?? '원아';
                  final typeKr = r['typeKr']?.toString() ?? r['type']?.toString() ?? '일정변경';
                  final reason = r['reason']?.toString() ?? '';
                  final targetTime = r['targetTime']?.toString();
                  final newAddress = r['targetAddress']?.toString();
                  final rejectionReason = r['rejectionReason']?.toString();

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Text(
                                  '$studentName 원아',
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    typeKr,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _getStatusBg(status),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                _getStatusText(status),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: _getStatusColor(status),
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (targetTime != null && targetTime.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text('예상 시간: $targetTime', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
                        ],
                        if (newAddress != null && newAddress.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text('장소: $newAddress', style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
                        ],
                        if (reason.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text('사유: $reason', style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                        ],
                        if (status == 'REJECTED' && rejectionReason != null && rejectionReason.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '반려 사유: $rejectionReason',
                              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626), fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProxyRequestDialog extends StatefulWidget {
  final List<Map<String, dynamic>> students;
  final VoidCallback onSuccess;

  const _ProxyRequestDialog({
    required this.students,
    required this.onSuccess,
  });

  @override
  State<_ProxyRequestDialog> createState() => _ProxyRequestDialogState();
}

class _ProxyRequestDialogState extends State<_ProxyRequestDialog> {
  int? _selectedStudentId;
  String _selectedType = 'ABSENCE';
  final DateTime _selectedDate = DateTime.now();
  final _reasonController = TextEditingController();
  bool _isSubmitting = false;

  final List<Map<String, String>> _types = [
    {'code': 'ABSENCE', 'title': '결석'},
    {'code': 'LATENESS', 'title': '지각'},
    {'code': 'INDIVIDUAL_DISMISSAL', 'title': '오늘 직접 하원'},
    {'code': 'PICKUP', 'title': '오늘 보호자 픽업'},
    {'code': 'NO_SHUTTLE', 'title': '셔틀 안 탐'},
    {'code': 'ONE_TIME_BOARDING', 'title': '하루 탑승'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.students.isNotEmpty) {
      _selectedStudentId = widget.students.first['studentId'] as int?;
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedStudentId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('원아를 선택해주세요.')));
      return;
    }

    setState(() => _isSubmitting = true);
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final res = await ApiService().createChangeRequest(
      studentId: _selectedStudentId!,
      type: _selectedType,
      targetDate: dateStr,
      reason: _reasonController.text.trim().isNotEmpty ? _reasonController.text.trim() : '담임 대리 접수',
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      widget.onSuccess();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('대리 신청이 정상 등록되었습니다.'), backgroundColor: Color(0xFF10B981)),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message'] ?? '신청에 실패했습니다.'), backgroundColor: const Color(0xFFDC2626)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Row(
        children: [
          Icon(Icons.edit_calendar, color: Color(0xFF2563EB)),
          SizedBox(width: 8),
          Text('담임 대리 변경 신청', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('원아 선택', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            DropdownButtonFormField<int>(
              initialValue: _selectedStudentId,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
              items: widget.students.map((s) {
                final id = s['studentId'] as int;
                final name = s['name']?.toString() ?? '원아';
                return DropdownMenuItem<int>(
                  value: id,
                  child: Text(name),
                );
              }).toList(),
              onChanged: (val) => setState(() => _selectedStudentId = val),
            ),
            const SizedBox(height: 14),

            const Text('변경 유형', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _selectedType,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
              items: _types.map((t) {
                return DropdownMenuItem<String>(
                  value: t['code'],
                  child: Text(t['title']!),
                );
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedType = val);
              },
            ),
            const SizedBox(height: 14),

            const Text('사유 및 메모 (선택)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            TextField(
              controller: _reasonController,
              decoration: InputDecoration(
                hintText: '학부모 유선 요청 등 사유 입력',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submit,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: _isSubmitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('신청 등록', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}

