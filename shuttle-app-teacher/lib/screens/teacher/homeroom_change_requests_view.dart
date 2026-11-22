import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';

class HomeroomChangeRequestsView extends StatefulWidget {
  const HomeroomChangeRequestsView({super.key});

  @override
  State<HomeroomChangeRequestsView> createState() => _HomeroomChangeRequestsViewState();
}

class _HomeroomChangeRequestsViewState extends State<HomeroomChangeRequestsView> with AutomaticKeepAliveClientMixin {
  bool _isLoading = true;
  String _selectedFilter = 'ALL'; // 'ALL', 'PENDING', 'ABSENCE', 'DISMISSAL'

  @override
  bool get wantKeepAlive => true;
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

  Future<void> _loadData({bool silent = false}) async {
    if (!silent && _requests.isEmpty) {
      setState(() => _isLoading = true);
    }
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
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ProxyRequestBottomSheet(
        students: _students,
        onSuccess: _loadData,
      ),
    );
  }

  List<Map<String, dynamic>> get _filteredRequests {
    if (_selectedFilter == 'ALL') return _requests;
    if (_selectedFilter == 'PENDING') {
      return _requests.where((r) => r['status'] == 'PENDING').toList();
    }
    if (_selectedFilter == 'ABSENCE') {
      return _requests.where((r) => r['type'] == 'ABSENCE').toList();
    }
    if (_selectedFilter == 'DISMISSAL') {
      return _requests.where((r) {
        final t = r['type'];
        return t == 'INDIVIDUAL_DISMISSAL' || t == 'PICKUP' || t == 'NO_SHUTTLE';
      }).toList();
    }
    return _requests;
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
        return const Color(0xFF16A34A);
      case 'REJECTED':
        return const Color(0xFFDC2626);
      case 'PENDING':
      default:
        return const Color(0xFFD97706);
    }
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'APPROVED':
        return '승인 완료';
      case 'REJECTED':
        return '반려됨';
      case 'PENDING':
      default:
        return '승인 대기';
    }
  }

  IconData _getTypeIcon(String? type) {
    switch (type) {
      case 'ABSENCE':
        return Icons.event_busy_rounded;
      case 'LATENESS':
        return Icons.access_time_filled_rounded;
      case 'INDIVIDUAL_DISMISSAL':
        return Icons.directions_walk_rounded;
      case 'PICKUP':
        return Icons.person_pin_circle_rounded;
      case 'NO_SHUTTLE':
        return Icons.bus_alert_rounded;
      case 'ONE_TIME_BOARDING':
        return Icons.directions_bus_filled_rounded;
      default:
        return Icons.change_circle_rounded;
    }
  }

  Color _getTypeColor(String? type) {
    switch (type) {
      case 'ABSENCE':
        return const Color(0xFFEF4444);
      case 'LATENESS':
        return const Color(0xFFF59E0B);
      case 'INDIVIDUAL_DISMISSAL':
        return const Color(0xFF2563EB);
      case 'PICKUP':
        return const Color(0xFF7C3AED);
      case 'NO_SHUTTLE':
        return const Color(0xFFEA580C);
      case 'ONE_TIME_BOARDING':
        return const Color(0xFF0D9488);
      default:
        return const Color(0xFF475569);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF2563EB)),
      );
    }

    final todayStr = DateFormat('M월 d일 (E)', 'ko').format(DateTime.now());
    final pendingCount = _summary['pending'] as int? ?? 0;
    final filtered = _filteredRequests;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        color: const Color(0xFF2563EB),
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. 오늘의 요약 대시보드 카드
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
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
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(
                                Icons.calendar_today_rounded,
                                size: 16,
                                color: Color(0xFF2563EB),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              todayStr,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            if (_assignedClass.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  _assignedClass,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF475569),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        // 대리 신청 버튼
                        ElevatedButton.icon(
                          onPressed: _showProxyRequestModal,
                          icon: const Icon(Icons.edit_calendar_rounded, size: 15),
                          label: const Text('대리 신청'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(color: Color(0xFFF1F5F9), height: 1),
                    const SizedBox(height: 14),

                    // KPI 요약 2x2 그리드 (텍스트 잘림 방지 및 모바일 가독성 최적화)
                    Row(
                      children: [
                        _buildKpiGridItem(
                          icon: Icons.event_busy_rounded,
                          label: '결석',
                          count: _summary['absence'] ?? 0,
                          color: const Color(0xFFEF4444),
                          bgColor: const Color(0xFFFEF2F2),
                        ),
                        const SizedBox(width: 10),
                        _buildKpiGridItem(
                          icon: Icons.directions_walk_rounded,
                          label: '직접 하원',
                          count: _summary['individualDismissal'] ?? 0,
                          color: const Color(0xFF2563EB),
                          bgColor: const Color(0xFFEFF6FF),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _buildKpiGridItem(
                          icon: Icons.person_pin_circle_rounded,
                          label: '보호자 픽업',
                          count: _summary['pickup'] ?? 0,
                          color: const Color(0xFF7C3AED),
                          bgColor: const Color(0xFFF5F3FF),
                        ),
                        const SizedBox(width: 10),
                        _buildKpiGridItem(
                          icon: Icons.access_time_filled_rounded,
                          label: '지각',
                          count: _summary['lateness'] ?? 0,
                          color: const Color(0xFFF59E0B),
                          bgColor: const Color(0xFFFFFBEB),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // 2. 필터 탭 바 (전체 / 승인 대기 / 결석 / 하원 변동)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('ALL', '전체 (${_requests.length})'),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      'PENDING',
                      '승인 대기 ($pendingCount)',
                      highlight: pendingCount > 0,
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip('ABSENCE', '결석 (${_summary['absence'] ?? 0})'),
                    const SizedBox(width: 8),
                    _buildFilterChip(
                      'DISMISSAL',
                      '하원 변동 (${(_summary['individualDismissal'] ?? 0) + (_summary['pickup'] ?? 0) + (_summary['noShuttle'] ?? 0)})',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 3. 신청 내역 리스트
              if (filtered.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 28),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _selectedFilter == 'ALL' ? '오늘 변동된 통학 일정이 없습니다.' : '해당 필터의 신청 내역이 없습니다.',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '학부모가 신청하거나 교사가 대리 신청하면 실시간 반영됩니다.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filtered.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final r = filtered[idx];
                    return _buildRequestCard(r);
                  },
                ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiGridItem({
    required IconData icon,
    required String label,
    required dynamic count,
    required Color color,
    required Color bgColor,
  }) {
    final int val = int.tryParse(count.toString()) ?? 0;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.15)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              '$val명',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String code, String label, {bool highlight = false}) {
    final isSelected = _selectedFilter == code;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = code),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF0F172A)
              : (highlight ? const Color(0xFFFFFBEB) : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF0F172A)
                : (highlight ? const Color(0xFFFDE68A) : const Color(0xFFE2E8F0)),
            width: highlight && !isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected
                ? Colors.white
                : (highlight ? const Color(0xFFB45309) : const Color(0xFF64748B)),
          ),
        ),
      ),
    );
  }

  Widget _buildRequestCard(Map<String, dynamic> r) {
    final status = r['status']?.toString() ?? 'PENDING';
    final studentName = r['studentName']?.toString() ?? '원아';
    final type = r['type']?.toString();
    final typeKr = r['typeKr']?.toString() ?? r['type']?.toString() ?? '통학 변동';
    final reason = r['reason']?.toString() ?? '';
    final targetTime = r['targetTime']?.toString();
    final newAddress = r['targetAddress']?.toString();
    final rejectionReason = r['rejectionReason']?.toString();
    final typeColor = _getTypeColor(type);
    final typeIcon = _getTypeIcon(type);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == 'PENDING' ? const Color(0xFFFCD34D) : const Color(0xFFE2E8F0),
          width: status == 'PENDING' ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 상단 행: 원아 정보 및 상태 뱃지
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    // 아바타
                    CircleAvatar(
                      radius: 17,
                      backgroundColor: typeColor.withValues(alpha: 0.12),
                      child: Text(
                        studentName.isNotEmpty ? studentName[0] : '원',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: typeColor,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          studentName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(typeIcon, size: 13, color: typeColor),
                            const SizedBox(width: 4),
                            Text(
                              typeKr,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: typeColor,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                // 상태 뱃지
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: _getStatusBg(status),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: _getStatusColor(status),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        _getStatusText(status),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: _getStatusColor(status),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // 세부 정보 (시간, 장소)
            if ((targetTime != null && targetTime.isNotEmpty) || (newAddress != null && newAddress.isNotEmpty)) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (targetTime != null && targetTime.isNotEmpty)
                      Row(
                        children: [
                          const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(
                            '예상 시간: $targetTime',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                          ),
                        ],
                      ),
                    if (newAddress != null && newAddress.isNotEmpty) ...[
                      if (targetTime != null && targetTime.isNotEmpty) const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '변경 장소: $newAddress',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // 사유
            if (reason.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '사유: ',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                  Expanded(
                    child: Text(
                      reason,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.3),
                    ),
                  ),
                ],
              ),
            ],

            // 반려 사유 배너
            if (status == 'REJECTED' && rejectionReason != null && rejectionReason.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded, size: 15, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '반려 사유: $rejectionReason',
                        style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C), fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ProxyRequestBottomSheet extends StatefulWidget {
  final List<Map<String, dynamic>> students;
  final VoidCallback onSuccess;

  const _ProxyRequestBottomSheet({
    required this.students,
    required this.onSuccess,
  });

  @override
  State<_ProxyRequestBottomSheet> createState() => _ProxyRequestBottomSheetState();
}

class _ProxyRequestBottomSheetState extends State<_ProxyRequestBottomSheet> {
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
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 바텀시트 핸들러 바
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.edit_calendar_rounded, color: Color(0xFF2563EB), size: 20),
                ),
                const SizedBox(width: 10),
                const Text(
                  '담임 대리 변경 신청',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 18),

            const Text('원아 선택', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            DropdownButtonFormField<int>(
              initialValue: _selectedStudentId,
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
              ),
              items: widget.students.map((s) {
                final id = s['studentId'] as int;
                final name = s['name']?.toString() ?? '원아';
                return DropdownMenuItem<int>(
                  value: id,
                  child: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
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
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
              ),
              items: _types.map((t) {
                return DropdownMenuItem<String>(
                  value: t['code'],
                  child: Text(t['title']!, style: const TextStyle(fontWeight: FontWeight.bold)),
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
                hintText: '학부모 유선 요청 등 상세 사유 입력',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
              ),
            ),
            const SizedBox(height: 20),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('취소', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('신청 등록하기', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
