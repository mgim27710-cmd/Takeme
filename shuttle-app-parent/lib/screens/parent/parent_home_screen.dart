import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../models/student_model.dart';
import '../../models/route_model.dart';
import '../../widgets/kakao_map_view.dart';
import 'change_request_modal.dart';
import 'my_requests_screen.dart';
import 'notification_list_screen.dart';
import 'class_board_screen.dart';
import '../settings_screen.dart';
import '../chat/chat_room_list_screen.dart';

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  String _activeTab = 'goto'; // 'goto' (등원) | 'gohome' (하원)
  StudentModel? _childInfo;
  RouteDataModel? _routeData;
  int _unreadNotificationCount = 0;
  int _unreadChatCount = 0;
  Timer? _notificationPollTimer;
  Map<String, dynamic>? _todaySchedule;

  int _selectedTabIndex = 0;
  late final PageController _pageController;

  double? _busLat;
  double? _busLng;
  List<dynamic>? _actualRoadPath;
  int _progressIndex = 0;
  bool _isLoading = true;
  bool _isScanning = false;

  final _allergyController = TextEditingController();
  final List<String> _commonAllergies = [
    '땅콩', '견과류', '우유', '복숭아', '계란', '갑각류', '대두', '밀가루', '생선'
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _selectedTabIndex);
    _loadAllData();
    _loadUnreadCount();
    _notificationPollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _loadUnreadCount();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _allergyController.dispose();
    _notificationPollTimer?.cancel();
    final vehicleId = _routeData?.vehicleId;
    if (vehicleId != null) {
      SocketService().leaveVehicleRoom(vehicleId);
    }
    super.dispose();
  }

  Widget _buildBottomNavItem({
    required int index,
    required IconData icon,
    required String label,
    int badgeCount = 0,
  }) {
    final isSelected = _selectedTabIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () {
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFF1F5F9) : Colors.transparent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    Icon(
                      icon,
                      size: 24,
                      color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                    if (badgeCount > 0)
                      Positioned(
                        right: -7,
                        bottom: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                          alignment: Alignment.center,
                          child: Text(
                            badgeCount > 9 ? '9+' : '$badgeCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              height: 1,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                  color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadUnreadCount() async {
    final user = ApiService().currentUser;
    if (user == null) return;
    try {
      final notiCount = await ApiService().getUnreadNotificationCount(user.email);
      final chatCount = await ApiService().getChatTotalUnreadCount();
      if (mounted) {
        setState(() {
          _unreadNotificationCount = notiCount;
          _unreadChatCount = chatCount;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    final user = ApiService().currentUser;
    if (user == null) return;

    // Connect socket
    SocketService().connect(ApiService().token);

    final child = await ApiService().getMyChild(user.email);
    final route = await ApiService().getParentRoute(user.email);
    final schedule = await ApiService().getTodaySchedule(user.email);
    final routePathData = await ApiService().getRoutePath();

    if (mounted) {
      setState(() {
        _childInfo = child;
        _routeData = route;
        _todaySchedule = schedule;
        if (routePathData != null) {
          _actualRoadPath = routePathData['path'];
          _progressIndex = routePathData['progressIndex'] ?? 0;
        }
        _isLoading = false;
        if (child != null) {
          _allergyController.text = child.allergies;
        }
      });

      if (route?.vehicleId != null) {
        SocketService().joinVehicleRoom(route!.vehicleId!);
        SocketService().onLocationUpdated((data) {
          if (mounted && data['lat'] != null && data['lng'] != null) {
            setState(() {
              _busLat = double.tryParse(data['lat'].toString());
              _busLng = double.tryParse(data['lng'].toString());
            });
          }
        });
        SocketService().onRoutePathUpdated((data) {
          if (mounted) {
            setState(() {
              _actualRoadPath = data['path'];
              _progressIndex = data['progressIndex'] ?? 0;
            });
          }
        });
      }

      SocketService().onChangeRequestDecided((data) {
        if (!mounted) return;
        _loadUnreadCount();
        final studentName = data['studentName'] ?? '원아';
        final isApproved = data['status'] == 'APPROVED';
        final statusText = isApproved ? '승인' : '반려';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('[$statusText] $studentName 원아의 신청이 $statusText되었습니다.'),
            backgroundColor: isApproved ? const Color(0xFF10B981) : const Color(0xFFEF4444),
          ),
        );
      });

      SocketService().onNotificationReceived((_) {
        if (mounted) _loadUnreadCount();
      });

      SocketService().onRoomUpdated((_) {
        if (mounted) _loadUnreadCount();
      });

      _loadUnreadCount();
    }
  }

  void _showAllergyEditDialog() {
    _allergyController.text = _childInfo?.allergies ?? '';
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          void toggleChip(String chip) {
            List<String> list = _allergyController.text
                .split(',')
                .map((s) => s.trim())
                .where((s) => s.isNotEmpty)
                .toList();
            if (list.contains(chip)) {
              list.remove(chip);
            } else {
              list.add(chip);
            }
            setDialogState(() {
              _allergyController.text = list.join(', ');
            });
          }

          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text('원아 알레르기 관리', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '식품이나 약품 등 주의해야 할 알레르기를 등록해주세요. 버스 지도교사 및 기사님께 실시간 공유됩니다.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  const Text('빠른 선택 태그', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _commonAllergies.map((chip) {
                      final isSelected = _allergyController.text.split(',').map((s) => s.trim()).contains(chip);
                      return GestureDetector(
                        onTap: () => toggleChip(chip),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFE2E8F0)),
                          ),
                          child: Text(
                            chip,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF475569),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  const Text('상세 알레르기 및 유의사항', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _allergyController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: '직접 입력 (예: 복숭아 먹으면 두드러기 발생, 견과류 절대 금지)',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
              ),
              ElevatedButton(
                onPressed: isSaving
                    ? null
                    : () async {
                        setDialogState(() => isSaving = true);
                        final user = ApiService().currentUser;
                        if (user != null) {
                          final allergiesText = _allergyController.text.trim();
                          final res = await ApiService().updateChildAllergies(user.email, allergiesText);
                          if (res['success'] == true) {
                            if (!mounted) return;
                            setState(() {
                              if (_childInfo != null) {
                                _childInfo = StudentModel(
                                  id: _childInfo!.id,
                                  name: _childInfo!.name,
                                  realName: _childInfo!.realName,
                                  address: _childInfo!.address,
                                  boardingLocation: _childInfo!.boardingLocation,
                                  latitude: _childInfo!.latitude,
                                  longitude: _childInfo!.longitude,
                                  allergies: allergiesText,
                                  className: _childInfo!.className,
                                  academyName: _childInfo!.academyName,
                                  vehicleName: _childInfo!.vehicleName,
                                  approvalStatus: _childInfo!.approvalStatus,
                                );
                              }
                            });
                            if (!ctx.mounted) return;
                            Navigator.pop(ctx);
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('알레르기 정보가 저장되었습니다.'), backgroundColor: Color(0xFF10B981)),
                            );
                          }
                        }
                      },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
                child: const Text('저장', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _handleQRScanResult(BarcodeCapture capture) async {
    if (_isScanning) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawVal = barcodes.first.rawValue;
    if (rawVal == null || rawVal.isEmpty) return;

    setState(() => _isScanning = true);
    final user = ApiService().currentUser;
    if (user == null) return;

    String? teacherEmail;
    try {
      final data = Uri.splitQueryString(rawVal);
      teacherEmail = data['teacherEmail'];
    } catch (_) {}

    if (teacherEmail != null && teacherEmail.isNotEmpty) {
      final res = await ApiService().studentBoardByQR(user.email, teacherEmail);
      if (!mounted) return;
      Navigator.pop(context); // close camera sheet
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('탑승 처리가 완료되었습니다.'), backgroundColor: Color(0xFF10B981)),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? '탑승 처리에 실패했습니다.'), backgroundColor: Colors.red),
        );
      }
    } else {
      setState(() => _isScanning = false);
    }
  }

  void _openQRScanner() {
    _isScanning = false;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      builder: (ctx) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          title: const Text('탑승 QR 스캔', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.white),
            onPressed: () => Navigator.pop(ctx),
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: MobileScanner(
                onDetect: _handleQRScanResult,
              ),
            ),
            Container(
              padding: const EdgeInsets.all(24),
              child: const Text(
                '지도교사님의 폰에 띄워진 QR 코드를 사각형 안에 맞춰주세요.',
                style: TextStyle(color: Colors.white, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeContent() {
    final user = ApiService().currentUser;
    final isStudent = user?.role == 'STUDENT';

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)));
    }

    return RefreshIndicator(
      onRefresh: _loadAllData,
      child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 우리 반 알림장 바로가기 카드
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: () {
                              _pageController.animateToPage(
                                1,
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeInOut,
                              );
                            },
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF2563EB).withValues(alpha: 0.22),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38,
                                    height: 38,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.article_rounded, color: Colors.white, size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _childInfo?.className != null && _childInfo!.className!.isNotEmpty
                                              ? '${_childInfo!.className} 알림장'
                                              : '우리 반 알림장',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        const Text(
                                          '선생님이 올린 사진과 공지 확인하기',
                                          style: TextStyle(
                                            color: Color(0xFFDBEAFE),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right, color: Colors.white, size: 22),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Tabs: 등원 / 하원
                        Row(
                          children: [
                            _buildDirectionTab('goto', '등원'),
                            const SizedBox(width: 8),
                            _buildDirectionTab('gohome', '하원'),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Child Info & Allergy Card
                        if (!isStudent && _childInfo != null) ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                )
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${_childInfo!.name} 원아${_childInfo!.className != null ? ' (${_childInfo!.className})' : ''}',
                                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${_childInfo!.academyName ?? '소속 원'} · ${_childInfo!.vehicleName ?? '차량 미배정'}',
                                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                          ),
                                        ],
                                      ),
                                    ),
                                    OutlinedButton(
                                      onPressed: _showAllergyEditDialog,
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                        backgroundColor: const Color(0xFFEFF6FF),
                                        side: const BorderSide(color: Color(0xFFBFDBFE)),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                      child: Text(
                                        _childInfo!.allergies.isNotEmpty ? '알레르기 수정' : '알레르기 등록',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: _childInfo!.allergies.isNotEmpty ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: _childInfo!.allergies.isNotEmpty ? const Color(0xFFFECACA) : const Color(0xFFF1F5F9),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        '알레르기 정보',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _childInfo!.allergies.isNotEmpty ? _childInfo!.allergies : '등록된 알레르기가 없습니다.',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: _childInfo!.allergies.isNotEmpty ? const Color(0xFFDC2626) : const Color(0xFF10B981),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Guide Card: Pickup info
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              )
                            ],
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.location_on, color: Color(0xFF2563EB), size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _todaySchedule?['dateStr'] ?? DateFormat('yyyy년 M월 d일').format(DateTime.now()),
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      _todaySchedule?['address'] ?? _childInfo?.boardingLocation ?? _childInfo?.address ?? '탑승지 설정됨',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Real-time Map
                        Container(
                          height: 280,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              )
                            ],
                          ),
                          child: KakaoMapView(
                            stops: _routeData?.stops ?? [],
                            routePoints: _routeData?.routePoints ?? [],
                            actualRoadPath: _actualRoadPath,
                            progressIndex: _progressIndex,
                            busLat: _busLat,
                            busLng: _busLng,
                            academyLat: _routeData?.academyLat,
                            academyLng: _routeData?.academyLng,
                            academyName: _routeData?.academyName ?? _childInfo?.academyName,
                            myChildName: _childInfo?.name,
                            myChildAddress: _todaySchedule?['address'] ?? _childInfo?.boardingLocation ?? _childInfo?.address,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Action Buttons
                        if (!isStudent)
                          Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    showDialog(
                                      context: context,
                                      builder: (_) => ChangeRequestModal(
                                        email: user!.email,
                                        onSuccess: _loadAllData,
                                      ),
                                    );
                                  },
                                  icon: const Icon(Icons.edit_calendar, size: 20, color: Colors.white),
                                  label: const Text(
                                    '통학 일정 간편 변경',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2563EB),
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                flex: 2,
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(builder: (_) => const MyRequestsScreen()),
                                    );
                                  },
                                  icon: const Icon(Icons.history, size: 18, color: Color(0xFF2563EB)),
                                  label: const Text(
                                    '신청 내역',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF2563EB)),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: Color(0xFFBFDBFE), width: 1.5),
                                    backgroundColor: const Color(0xFFEFF6FF),
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  ),
                                ),
                              ),
                            ],
                          )
                        else
                          ElevatedButton.icon(
                            onPressed: _openQRScanner,
                            icon: const Icon(Icons.qr_code_scanner, size: 20, color: Colors.white),
                            label: const Text(
                              '탑승 QR 스캔하기',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.white),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              elevation: 2,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                          ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ),
            );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _selectedTabIndex == 0
          ? AppBar(
              title: const Text(
                'TAKEME',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF2563EB), letterSpacing: -0.5),
              ),
              backgroundColor: Colors.white,
              elevation: 0,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
                  onPressed: () {
                    _loadAllData();
                    _loadUnreadCount();
                  },
                ),
              ],
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(1),
                child: Container(color: const Color(0xFFF1F5F9), height: 1),
              ),
            )
          : null,
      body: PageView(
        controller: _pageController,
        onPageChanged: (idx) => setState(() => _selectedTabIndex = idx),
        children: [
          _buildHomeContent(),
          ClassBoardScreen(childClassName: _childInfo?.className, isEmbeddedTab: true),
          const ChatRoomListScreen(isEmbeddedTab: true),
          const NotificationListScreen(isEmbeddedTab: true),
          const SettingsScreen(isEmbeddedTab: true),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
          ),
        ),
        child: SafeArea(
          top: false,
          bottom: true,
          child: SizedBox(
            height: 56,
            child: Row(
              children: [
                _buildBottomNavItem(index: 0, icon: Icons.home_outlined, label: '홈'),
                _buildBottomNavItem(index: 1, icon: Icons.article_outlined, label: '알림장'),
                _buildBottomNavItem(index: 2, icon: Icons.forum_outlined, label: '메신저', badgeCount: _unreadChatCount),
                _buildBottomNavItem(index: 3, icon: Icons.notifications_outlined, label: '알림', badgeCount: _unreadNotificationCount),
                _buildBottomNavItem(index: 4, icon: Icons.settings_outlined, label: '설정'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDirectionTab(String tab, String label) {
    final isSelected = _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = tab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF2563EB) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isSelected ? Colors.white : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }
}
