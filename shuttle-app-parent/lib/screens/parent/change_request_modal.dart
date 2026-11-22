import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/student_model.dart';
import '../../services/api_service.dart';

class ChangeRequestModal extends StatefulWidget {
  final String email;
  final VoidCallback onSuccess;
  final String? initialType;

  const ChangeRequestModal({
    super.key,
    required this.email,
    required this.onSuccess,
    this.initialType,
  });

  @override
  State<ChangeRequestModal> createState() => _ChangeRequestModalState();
}

class _ChangeRequestModalState extends State<ChangeRequestModal> {
  int _step = 1; // 1: 자녀 선택, 2: 유형 선택, 3: 세부정보 및 확인
  bool _isLoadingChildren = true;
  bool _isSubmitting = false;

  List<StudentModel> _children = [];
  StudentModel? _selectedChild;

  // Step 2 Selection
  String? _selectedType;
  String _direction = 'ALL'; // 'BOARDING', 'ALIGHTING', 'ALL'

  // Step 3 Inputs
  late DateTime _selectedDate;
  final TextEditingController _timeController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();

  List<Map<String, dynamic>> _availableStops = [];
  bool _isLoadingStops = false;
  int? _selectedStopIndex;

  final List<Map<String, dynamic>> _allTypes = [
    {
      'code': 'ABSENCE',
      'title': '결석',
      'desc': '하루 종일 등원하지 않아요',
      'icon': Icons.event_busy,
      'color': const Color(0xFFEF4444),
      'bg': const Color(0xFFFEF2F2),
    },
    {
      'code': 'PICKUP',
      'title': '오늘 직접 하원(픽업)',
      'desc': '하원 셔틀을 타지 않고 보호자가 직접 데리러 가요',
      'icon': Icons.family_restroom,
      'color': const Color(0xFF8B5CF6),
      'bg': const Color(0xFFF5F3FF),
    },
    {
      'code': 'CHANGE_LOCATION',
      'title': '탑승지 변경',
      'desc': '등/하원 정류장 위치를 변경해요',
      'icon': Icons.edit_location_alt,
      'color': const Color(0xFF0284C7),
      'bg': const Color(0xFFF0F9FF),
    },
    {
      'code': 'ONE_TIME_BOARDING',
      'title': '하루 탑승',
      'desc': '오늘 하루만 유치원 셔틀 차량에 탑승해요',
      'icon': Icons.directions_bus,
      'color': const Color(0xFF10B981),
      'bg': const Color(0xFFECFDF5),
    },
  ];

  @override
  void initState() {
    super.initState();
    _selectedType = widget.initialType;
    final now = DateTime.now();
    _selectedDate = now.hour < 14 ? now : now.add(const Duration(days: 1));
    _loadChildren();
  }

  @override
  void dispose() {
    _timeController.dispose();
    _addressController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadRouteStops() async {
    if (_selectedChild == null) return;
    setState(() => _isLoadingStops = true);
    try {
      final route = await ApiService().getParentRoute(widget.email, studentId: _selectedChild!.id);
      if (mounted && route != null) {
        setState(() {
          _availableStops = route.stops.map((s) => {
            'name': s.name,
            'address': s.address ?? s.name,
            'lat': s.latitude,
            'lng': s.longitude,
          }).toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _isLoadingStops = false);
  }

  Future<void> _loadChildren() async {
    setState(() => _isLoadingChildren = true);
    final list = await ApiService().getMyChildren(widget.email);
    if (!mounted) return;
    setState(() {
      _children = list;
      _isLoadingChildren = false;
      if (list.length == 1) {
        _selectedChild = list.first;
        _step = 2; // 1명이면 자동 선택하고 2단계(무엇을)로 바로 이동
        _loadRouteStops();
      } else if (list.isNotEmpty) {
        _selectedChild = list.first;
        _loadRouteStops();
      }
    });
  }

  void _showMessage(String msg, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF10B981),
      ),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
      helpText: '적용 날짜 선택',
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      helpText: '예상 시간 선택',
    );
    if (picked != null) {
      final hour = picked.hour.toString().padLeft(2, '0');
      final minute = picked.minute.toString().padLeft(2, '0');
      setState(() => _timeController.text = '$hour:$minute');
    }
  }

  Future<void> _submit() async {
    if (_selectedChild == null) {
      _showMessage('자녀를 선택해주세요.');
      return;
    }
    if (_selectedType == null) {
      _showMessage('신청 유형을 선택해주세요.');
      return;
    }

    setState(() => _isSubmitting = true);

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final res = await ApiService().createChangeRequest(
      studentId: _selectedChild!.id,
      type: _selectedType!,
      targetDate: dateStr,
      direction: _direction,
      targetTime: _timeController.text.trim().isNotEmpty ? _timeController.text.trim() : null,
      targetAddress: _addressController.text.trim().isNotEmpty ? _addressController.text.trim() : null,
      reason: _reasonController.text.trim().isNotEmpty ? _reasonController.text.trim() : null,
    );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (res['success'] == true) {
      _showMessage('변경 신청이 정상적으로 접수되었습니다.', isError: false);
      widget.onSuccess();
      Navigator.of(context).pop(true);
    } else {
      _showMessage(res['message'] ?? '신청에 실패했습니다.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 680),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Modal Top Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.edit_calendar, color: Color(0xFF2563EB), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '통학 일정 간편 변경',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          _step == 1
                              ? '1단계: 자녀를 선택하세요'
                              : _step == 2
                                  ? '2단계: 변경 유형을 선택하세요'
                                  : '3단계: 일정을 확인하고 신청을 완료하세요',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF94A3B8)),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            // Step Progress Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  _buildStepIndicator(1, '자녀 선택'),
                  const SizedBox(width: 6),
                  Expanded(child: Container(height: 3, color: _step >= 2 ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0))),
                  const SizedBox(width: 6),
                  _buildStepIndicator(2, '유형 선택'),
                  const SizedBox(width: 6),
                  Expanded(child: Container(height: 3, color: _step >= 3 ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0))),
                  const SizedBox(width: 6),
                  _buildStepIndicator(3, '확인·신청'),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),

            // Body Content
            Expanded(
              child: _isLoadingChildren
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: _buildCurrentStepContent(),
                    ),
            ),

            // Bottom Buttons
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
              ),
              child: Row(
                children: [
                  if (_step > 1)
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        onPressed: _isSubmitting
                            ? null
                            : () {
                                setState(() {
                                  if (_step == 2 && _children.length > 1) {
                                    _step = 1;
                                  } else if (_step == 3) {
                                    _step = 2;
                                  }
                                });
                              },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text('이전', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                      ),
                    ),
                  if (_step > 1) const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _handleNextOrSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                            )
                          : Text(
                              _step == 3 ? '신청 완료하기' : '다음 단계로',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                            ),
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

  Widget _buildStepIndicator(int stepNum, String label) {
    final isActive = _step >= stepNum;
    final isCurrent = _step == stepNum;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            '$stepNum',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : const Color(0xFF64748B),
            ),
          ),
        ),
        if (isCurrent) ...[
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
          ),
        ],
      ],
    );
  }

  void _handleNextOrSubmit() {
    if (_step == 1) {
      if (_selectedChild == null) {
        _showMessage('자녀를 선택해주세요.');
        return;
      }
      setState(() => _step = 2);
    } else if (_step == 2) {
      if (_selectedType == null) {
        _showMessage('변경 유형을 선택해주세요.');
        return;
      }
      setState(() => _step = 3);
    } else {
      _submit();
    }
  }

  Widget _buildCurrentStepContent() {
    switch (_step) {
      case 1:
        return _buildStep1ChildSelection();
      case 2:
        return _buildStep2TypeSelection();
      case 3:
      default:
        return _buildStep3DetailsAndConfirm();
    }
  }

  // 1단계: 자녀 선택
  Widget _buildStep1ChildSelection() {
    if (_children.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: Text('등록된 자녀 정보가 없습니다.', style: TextStyle(color: Color(0xFF64748B))),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '어떤 자녀의 일정을 변경할까요?',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 12),
        ..._children.map((c) {
          final isSelected = _selectedChild?.id == c.id;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedChild = c;
                });
                _loadRouteStops();
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                    width: isSelected ? 2 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
                      foregroundColor: isSelected ? Colors.white : const Color(0xFF64748B),
                      child: const Icon(Icons.person),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.name,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? const Color(0xFF1E40AF) : const Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${c.className != null && c.className!.isNotEmpty ? "${c.className} · " : ""}${c.vehicleName ?? "차량 미배정"}',
                            style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    if (isSelected)
                      const Icon(Icons.check_circle, color: Color(0xFF2563EB), size: 24),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  List<Map<String, dynamic>> _getFilteredTypes() {
    final isNotRiding = _selectedChild?.isNotRiding == true;
    if (isNotRiding) {
      return _allTypes.where((t) => t['code'] == 'ONE_TIME_BOARDING' || t['code'] == 'ABSENCE').toList();
    } else {
      return _allTypes.where((t) => t['code'] != 'ONE_TIME_BOARDING').toList();
    }
  }

  // 2단계: 무엇을?
  Widget _buildStep2TypeSelection() {
    final types = _getFilteredTypes();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_selectedChild != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person, size: 16, color: Color(0xFF2563EB)),
                const SizedBox(width: 6),
                Text(
                  '선택된 자녀: ${_selectedChild!.name}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ],
            ),
          ),
        const Text(
          '어떤 변동 사항인가요?',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 12),
        for (int i = 0; i < types.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(child: _buildTypeCard(types[i])),
                  const SizedBox(width: 10),
                  if (i + 1 < types.length)
                    Expanded(child: _buildTypeCard(types[i + 1]))
                  else
                    const Spacer(),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildTypeCard(Map<String, dynamic> t) {
    final isSelected = _selectedType == t['code'];
    return InkWell(
      onTap: () {
        setState(() {
          _selectedType = t['code'];
        });
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? (t['bg'] as Color) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? (t['color'] as Color) : const Color(0xFFE2E8F0),
            width: isSelected ? 2.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: (t['color'] as Color).withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  )
                ]
              : [],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: (t['color'] as Color).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(t['icon'] as IconData, color: t['color'] as Color, size: 22),
                ),
                if (isSelected)
                  Icon(Icons.check_circle, color: t['color'] as Color, size: 22),
              ],
            ),
            const SizedBox(height: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t['title'] as String,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: isSelected ? (t['color'] as Color) : const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  t['desc'] as String,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.25),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // 3단계: 언제/어디서? + 사유(선택) + 확인
  Widget _buildStep3DetailsAndConfirm() {
    final typeObj = _allTypes.firstWhere((t) => t['code'] == _selectedType, orElse: () => _allTypes[0]);
    final dateStr = DateFormat('yyyy년 M월 d일 (E)', 'ko').format(_selectedDate);

    final needsAddress = _selectedType == 'CHANGE_LOCATION' || _selectedType == 'ONE_TIME_BOARDING';
    final needsTime = _selectedType == 'PICKUP';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Selection Summary Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: typeObj['bg'] as Color,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: (typeObj['color'] as Color).withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(typeObj['icon'] as IconData, color: typeObj['color'] as Color, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_selectedChild?.name} 원아',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                    ),
                    Text(
                      typeObj['title'] as String,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: typeObj['color'] as Color,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // 날짜 선택 (기본 오늘/내일)
        const Text(
          '적용 날짜',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: _pickDate,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 18, color: Color(0xFF2563EB)),
                    const SizedBox(width: 10),
                    Text(dateStr, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  ],
                ),
                const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF94A3B8)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // 등원/하원 구분 (필요한 경우)
        if (_selectedType != 'ABSENCE') ...[
          const Text(
            '적용 구분',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _buildDirectionChip('ALL', '등·하원 전체'),
              const SizedBox(width: 8),
              _buildDirectionChip('BOARDING', '등원만'),
              const SizedBox(width: 8),
              _buildDirectionChip('ALIGHTING', '하원만'),
            ],
          ),
          const SizedBox(height: 14),
        ],

        // 시간 입력 (픽업 등)
        if (needsTime) ...[
          const Text(
            '예상 시간 (선택)',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
          ),
          const SizedBox(height: 6),
          InkWell(
            onTap: _pickTime,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.schedule, size: 18, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 10),
                      Text(
                        _timeController.text.isNotEmpty ? _timeController.text : '예상 시간을 선택해주세요',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: _timeController.text.isNotEmpty ? FontWeight.bold : FontWeight.normal,
                          color: _timeController.text.isNotEmpty ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF94A3B8)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
        ],

        // 주소 / 정류장 입력 (탑승지 변경 / 하루 탑승)
        if (needsAddress) ...[
          const Text(
            '운행 노선 정류장 선택 (1개 선택 시 자동 할당)',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
          ),
          const SizedBox(height: 6),
          if (_isLoadingStops)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            )
          else if (_availableStops.isNotEmpty) ...[
            Container(
              constraints: const BoxConstraints(maxHeight: 160),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.all(8),
                itemCount: _availableStops.length,
                separatorBuilder: (ctx, idx) => const Divider(height: 8, color: Color(0xFFE2E8F0)),
                itemBuilder: (ctx, idx) {
                  final stop = _availableStops[idx];
                  final isChosen = _selectedStopIndex == idx;
                  final sName = stop['name']?.toString() ?? '정류장 ${idx + 1}';
                  final sAddr = stop['address']?.toString() ?? sName;

                  return InkWell(
                    onTap: () {
                      setState(() {
                        _selectedStopIndex = idx;
                        _addressController.text = sAddr;
                      });
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: isChosen ? const Color(0xFFEFF6FF) : Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isChosen ? const Color(0xFF2563EB) : Colors.transparent,
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isChosen ? Icons.check_circle : Icons.location_on,
                            size: 18,
                            color: isChosen ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  sName,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isChosen ? FontWeight.bold : FontWeight.w600,
                                    color: isChosen ? const Color(0xFF1E40AF) : const Color(0xFF1E293B),
                                  ),
                                ),
                                if (sAddr != sName)
                                  Text(
                                    sAddr,
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                  ),
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
            const SizedBox(height: 10),
          ],
          const Text(
            '신청 장소 / 도로명 주소 (직접 수정 가능)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _addressController,
            decoration: InputDecoration(
              hintText: '정류장을 선택하거나 주소를 입력하세요',
              hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
            ),
          ),
          const SizedBox(height: 14),
        ],

        // 사유 (선택 사항)
        const Text(
          '남기실 사유 (선택, 빈칸 가능)',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _reasonController,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: '특이사항이나 선생님께 전달할 메모가 있다면 적어주세요.',
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            contentPadding: const EdgeInsets.all(14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
          ),
        ),
      ],
    );
  }

  Widget _buildDirectionChip(String dir, String label) {
    final isSelected = _direction == dir;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _direction = dir),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }
}

