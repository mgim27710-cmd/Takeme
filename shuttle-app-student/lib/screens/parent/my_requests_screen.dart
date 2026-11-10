import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _requests = [];

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    final list = await ApiService().getMyChangeRequests();
    if (!mounted) return;
    setState(() {
      _requests = list;
      _isLoading = false;
    });
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
        return '승인 완료';
      case 'REJECTED':
        return '반려됨';
      case 'PENDING':
      default:
        return '승인 대기중';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          '내 변경 신청 내역',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF475569)),
            onPressed: _loadRequests,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _requests.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(Icons.assignment_outlined, size: 32, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        '신청한 변경 내역이 없습니다.',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        '결석, 지각, 직접 하원 등을 신청하면\n이곳에서 진행 상태를 확인할 수 있습니다.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8), height: 1.4),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadRequests,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _requests.length,
                    itemBuilder: (ctx, i) {
                      final item = _requests[i];
                      final status = item['status'] as String? ?? 'PENDING';
                      final typeKr = item['typeKr'] as String? ?? item['type'] ?? '일정변경';
                      final studentName = item['studentName'] as String? ?? item['student']?['name'] ?? '원아';
                      final targetDate = item['targetDate'] as String? ?? '';
                      final reason = item['reason'] as String? ?? '';
                      final rejectionReason = item['rejectionReason'] as String? ?? '';
                      final isCapacityExceeded = item['isCapacityExceeded'] == true;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
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
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header: Name, Type and Status Badge
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
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _getStatusBg(status),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    _getStatusText(status),
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: _getStatusColor(status),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Target Date & Direction
                            Row(
                              children: [
                                const Icon(Icons.calendar_today, size: 14, color: Color(0xFF64748B)),
                                const SizedBox(width: 6),
                                Text(
                                  '적용일: $targetDate',
                                  style: const TextStyle(fontSize: 13, color: Color(0xFF475569), fontWeight: FontWeight.w600),
                                ),
                                if (item['direction'] != null && item['direction'] != 'ALL') ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    item['direction'] == 'BOARDING' ? '(등원만)' : '(하원만)',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF2563EB), fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ],
                            ),

                            if (item['targetTime'] != null && (item['targetTime'] as String).isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.schedule, size: 14, color: Color(0xFFF59E0B)),
                                  const SizedBox(width: 6),
                                  Text(
                                    '예상 시각: ${item['targetTime']}',
                                    style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
                                  ),
                                ],
                              ),
                            ],

                            if (item['targetAddress'] != null && (item['targetAddress'] as String).isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF10B981)),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      '변경 장소: ${item['targetAddress']}',
                                      style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
                                    ),
                                  ),
                                ],
                              ),
                            ],

                            if (reason.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '사유: $reason',
                                  style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                                ),
                              ),
                            ],

                            // 반려 사유 표시 (반려 시 필수 표시)
                            if (status == 'REJECTED' && rejectionReason.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF2F2),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFFECACA)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Row(
                                      children: [
                                        Icon(Icons.info_outline, size: 14, color: Color(0xFFDC2626)),
                                        SizedBox(width: 4),
                                        Text(
                                          '관리자 반려 사유',
                                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      rejectionReason,
                                      style: const TextStyle(fontSize: 13, color: Color(0xFF991B1B), height: 1.3),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            if (isCapacityExceeded && status == 'PENDING') ...[
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFFBEB),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFFDE68A)),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.warning_amber_rounded, size: 14, color: Color(0xFFD97706)),
                                    SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        '선택하신 차량의 정원 초과로 대체 차량 배정을 검토 중입니다.',
                                        style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

