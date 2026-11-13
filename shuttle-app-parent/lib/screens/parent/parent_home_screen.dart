import 'dart:async';
import 'dart:math' as math;
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
import 'class_board_screen.dart';
import '../settings_screen.dart';
import '../chat/chat_room_list_screen.dart';

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  int _selectedTabIndex = 0; // 0: 홈, 1: 알림장·게시물, 2: 메신저, 3: 설정
  late final PageController _pageController;
  String _activeTab = 'goto'; // 'goto' (등원) | 'gohome' (하원)

  // 다자녀(Multi-Child) 지원 상태
  List<StudentModel> _children = [];
  int _selectedChildIndex = 0;
  StudentModel? get _childInfo => _children.isNotEmpty && _selectedChildIndex < _children.length
      ? _children[_selectedChildIndex]
      : null;

  RouteDataModel? _routeData;
  int _unreadNotificationCount = 0;
  int _unreadChatCount = 0;

  // 기사 앱 실제 도로 경로 (서버 route-path)
  List<dynamic>? _actualRoadPath;
  int _progressIndex = 0;
  Timer? _notificationPollTimer;
  Map<String, dynamic>? _todaySchedule;

  double? _busLat;
  double? _busLng;
  DateTime? _lastBusUpdate;
  bool _isLoading = true;
  bool _isScanning = false;
  bool _isModalOpen = false;

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
    _allergyController.dispose();
    _pageController.dispose();
    _notificationPollTimer?.cancel();
    final vehicleId = _routeData?.vehicleId;
    if (vehicleId != null) {
      SocketService().leaveVehicleRoom(vehicleId);
    }
    super.dispose();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final user = ApiService().currentUser;
      if (user == null) return;
      final count = await ApiService().getUnreadNotificationCount(user.email);
      final chatCount = await ApiService().getChatTotalUnreadCount();
      if (mounted) {
        setState(() {
          _unreadNotificationCount = count;
          _unreadChatCount = chatCount;
        });
      }
    } catch (e) {
      debugPrint('[ParentHomeScreen] _loadUnreadCount error: $e');
    }
  }

  Future<void> _loadAllData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);

    try {
      final user = ApiService().currentUser;
      if (user == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      // Connect socket safely without blocking
      try {
        SocketService().connect(ApiService().token);
      } catch (e) {
        debugPrint('[ParentHomeScreen] Socket connect error: $e');
      }

      // 1. 다자녀 목록 조회
      List<StudentModel> childrenList = [];
      try {
        childrenList = await ApiService().getMyChildren(user.email);
      } catch (_) {}
      if (childrenList.isEmpty) {
        final single = await ApiService().getMyChild(user.email);
        if (single != null) childrenList = [single];
      }

      _children = childrenList;
      if (_selectedChildIndex >= _children.length) {
        _selectedChildIndex = 0;
      }

      // 2. 현재 선택된 자녀의 노선 및 오늘 일정 병렬 로드 (다자녀 studentId 및 등/하원 모드 연동)
      final currentChildId = _childInfo?.id;
      final results = await Future.wait([
        ApiService().getParentRoute(user.email, studentId: currentChildId, direction: _activeTab),
        ApiService().getTodaySchedule(user.email),
      ]).timeout(const Duration(seconds: 8), onTimeout: () {
        debugPrint('[ParentHomeScreen] _loadAllData timed out after 8s');
        return [null, null];
      });

      final route = results[0] as RouteDataModel?;
      final schedule = results[1] as Map<String, dynamic>?;
      Map<String, dynamic>? routePathData;
      try {
        routePathData = await ApiService().getRoutePath();
      } catch (_) {}

      if (mounted) {
        setState(() {
          _routeData = route;
          _todaySchedule = schedule;
          if (routePathData != null) {
            _actualRoadPath = routePathData['path'];
            _progressIndex = routePathData['progressIndex'] ?? 0;
          }
          if (_childInfo != null) {
            _allergyController.text = _childInfo!.allergies;
          }
        });

        if (route?.vehicleId != null) {
          try {
            if (_routeData?.vehicleId != null && _routeData!.vehicleId != route!.vehicleId) {
              SocketService().leaveVehicleRoom(_routeData!.vehicleId!);
            }
            SocketService().joinVehicleRoom(route!.vehicleId!);
            SocketService().onRoutePathUpdated((data) {
              if (mounted) {
                setState(() {
                  _actualRoadPath = data['path'];
                  _progressIndex = data['progressIndex'] ?? 0;
                });
              }
            });
            SocketService().onRoomUpdated((_) {
              if (mounted) _loadUnreadCount();
            });
            SocketService().onLocationUpdated((data) {
              if (mounted && data['lat'] != null && data['lng'] != null) {
                setState(() {
                  _busLat = double.tryParse(data['lat'].toString());
                  _busLng = double.tryParse(data['lng'].toString());
                  _lastBusUpdate = DateTime.now();
                });
              }
            });
          } catch (e) {
            debugPrint('[ParentHomeScreen] Socket room error: $e');
          }
        }

        try {
          SocketService().onChildBoardStatusChanged((data) {
            if (!mounted) return;
            final targetStudentId = data['studentId'];
            final studentName = data['studentName'] ?? '원아';
            final newBoardStatus = data['boardStatus'] ?? 'BOARDED';

            if (_childInfo != null && _childInfo!.id == targetStudentId) {
              setState(() {
                _childInfo!.boardStatus = newBoardStatus;
              });
              final statusKr = newBoardStatus == 'BOARDED' ? '탑승 완료' : (newBoardStatus == 'ABSENT' ? '결석' : '탑승 대기');
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🔔 $studentName 원아가 $statusKr되었습니다.'),
                  backgroundColor: const Color(0xFF2563EB),
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              );
            }
          });
        } catch (e) {
          debugPrint('[ParentHomeScreen] onChildBoardStatusChanged error: $e');
        }

        try {
          SocketService().onChangeRequestDecided((data) {
            if (!mounted) return;
            _loadUnreadCount();
            final studentName = data['studentName'] ?? '원아';
            final isApproved = data['status'] == 'APPROVED';
            final statusText = isApproved ? '승인' : '반려';
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('[$statusText] $studentName 원아의 통학 신청이 $statusText되었습니다.'),
                backgroundColor: isApproved ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            );
          });

          SocketService().onNotificationReceived((_) {
            if (mounted) {
              _loadUnreadCount();
              _loadAllData();
            }
          });
        } catch (e) {
          debugPrint('[ParentHomeScreen] Socket listeners error: $e');
        }
      }
    } catch (e) {
      debugPrint('[ParentHomeScreen] _loadAllData error: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  // 자녀 전환 처리
  void _switchChild(int index) {
    if (index == _selectedChildIndex || index >= _children.length) return;
    if (_routeData?.vehicleId != null) {
      SocketService().leaveVehicleRoom(_routeData!.vehicleId!);
    }
    setState(() {
      _selectedChildIndex = index;
      _busLat = null;
      _busLng = null;
      if (_childInfo != null) {
        _allergyController.text = _childInfo!.allergies;
      }
    });
    // 자녀가 바뀌면 경로와 스케줄을 재로드
    _loadAllData();
  }

  // 원클릭 빠른 일정 변경 (결석 / 오늘 직접 하원)
  Future<void> _handleQuickChangeRequest({
    required String type,
    required String title,
    required String description,
  }) async {
    if (_childInfo == null) return;
    final childName = _childInfo!.name;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    if (mounted) setState(() => _isModalOpen = true);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: type == 'ABSENCE' ? const Color(0xFFFEE2E2) : const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                type == 'ABSENCE' ? Icons.event_busy_rounded : Icons.directions_walk_rounded,
                color: type == 'ABSENCE' ? const Color(0xFFEF4444) : const Color(0xFF2563EB),
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Text('$title 신청', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '오늘($todayStr) [$childName] 원아의 통학 일정을 "$title"으로 즉시 변경 신청하시겠습니까?',
              style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.5),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Text(
                '📌 $description\n원장님 및 버스 지도교사님께 실시간으로 전달됩니다.',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.4),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: type == 'ABSENCE' ? const Color(0xFFEF4444) : const Color(0xFF2563EB),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: const Text('신청하기', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (mounted) setState(() => _isModalOpen = false);
    if (confirm != true) return;

    try {
      final res = await ApiService().createChangeRequest(
        studentId: _childInfo!.id,
        type: type,
        targetDate: todayStr,
        direction: type == 'ABSENCE' ? 'ALL' : 'ALIGHTING',
        reason: type == 'ABSENCE' ? '학부모 앱 원클릭 결석 접수' : '학부모 오늘 직접 하원 신청',
      );

      if (!mounted) return;
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('[$title] 신청이 원에 정상 접수되었습니다.'),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
        _loadAllData();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? '신청에 실패했습니다.'),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('오류 발생: $e'), backgroundColor: const Color(0xFFEF4444)),
      );
    }
  }

  // 실시간 버스 도착 예측 (ETA & 잔여 정류장 계산)
  Map<String, dynamic> _calculateLiveETA() {
    final stops = _routeData?.stops ?? [];
    if (stops.isEmpty) {
      return {
        'status': 'WAITING',
        'title': '운행 대기 중',
        'subtitle': '배정된 셔틀이 운행을 준비하고 있습니다.',
        'badgeColor': const Color(0xFF64748B),
        'remainingStops': 0,
        'etaMinutes': 0,
      };
    }

    // 버스 좌표가 없거나 운행 전일 때
    final isBusActive = _busLat != null && _busLng != null;
    if (!isBusActive) {
      return {
        'status': 'SCHEDULED',
        'title': '탑승 예정',
        'subtitle': _activeTab == 'gohome' ? '오후 하원 셔틀 운행 대기' : '오전 등원 셔틀 운행 대기',
        'badgeColor': const Color(0xFF3B82F6),
        'remainingStops': 0,
        'etaMinutes': 0,
      };
    }

    // 자녀의 탑승 정류장 인덱스 찾기
    final childName = _childInfo?.name ?? '';
    final childAddr = _childInfo?.boardingLocation ?? _childInfo?.address ?? '';
    int childStopIndex = -1;

    for (int i = 0; i < stops.length; i++) {
      final s = stops[i];
      if (s.isMyChild ||
          (childName.isNotEmpty && s.name.contains(childName)) ||
          (childAddr.isNotEmpty && (s.address?.contains(childAddr) ?? false))) {
        childStopIndex = i;
        break;
      }
    }

    if (childStopIndex == -1) {
      childStopIndex = (stops.length * 0.6).round().clamp(0, stops.length - 1);
    }

    // 버스 현재 위치와 가장 가까운 정류장(현재 지난 정류장) 찾기
    int nearestStopIndex = 0;
    double minDistance = double.infinity;

    for (int i = 0; i < stops.length; i++) {
      final s = stops[i];
      final dLat = s.latitude - _busLat!;
      final dLng = s.longitude - _busLng!;
      final dist = math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestStopIndex = i;
      }
    }

    final remainingStops = childStopIndex - nearestStopIndex;
    final etaMinutes = (remainingStops * 2.5).round().clamp(1, 40);

    if (remainingStops <= 0) {
      return {
        'status': 'ARRIVING',
        'title': '곧 정류장 도착!',
        'subtitle': '셔틀버스가 탑승 정류장에 진입 중입니다. 미리 나와주세요.',
        'badgeColor': const Color(0xFFEF4444),
        'remainingStops': 0,
        'etaMinutes': 1,
      };
    } else if (remainingStops <= 2) {
      return {
        'status': 'NEAR',
        'title': '$remainingStops정거장 전 (약 $etaMinutes분 후)',
        'subtitle': '셔틀버스가 우리 동네로 다가오고 있습니다.',
        'badgeColor': const Color(0xFFF59E0B),
        'remainingStops': remainingStops,
        'etaMinutes': etaMinutes,
      };
    } else {
      return {
        'status': 'RUNNING',
        'title': '$remainingStops정거장 전 (약 $etaMinutes분 후)',
        'subtitle': '정규 코스대로 안전하게 운행 중입니다.',
        'badgeColor': const Color(0xFF10B981),
        'remainingStops': remainingStops,
        'etaMinutes': etaMinutes,
      };
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
                      hintText: '직접 입력 (예: 복숭아 두드러기, 견과류 절대 금지)',
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
                                _children[_selectedChildIndex] = StudentModel(
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
      Navigator.pop(context);
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

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      title: Row(
        children: [
          const Text(
            'TAKEME',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF2563EB), letterSpacing: -0.5),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: const Text(
              '학부모 안심케어',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
            ),
          ),
        ],
      ),
      backgroundColor: Colors.white,
      elevation: 0,
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
          tooltip: '새로고침',
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
    );
  }

  // 다자녀 스위처 칩 바
  Widget _buildMultiChildSelector() {
    if (_children.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_children.length > 1) ...[
            Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 6),
              child: Text(
                '자녀 선택 (${_children.length}명)',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
              ),
            ),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _children.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, idx) {
                  final child = _children[idx];
                  final isSelected = idx == _selectedChildIndex;
                  return GestureDetector(
                    onTap: () => _switchChild(idx),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF0F172A) : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                        ),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF0F172A).withValues(alpha: 0.15),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                )
                              ]
                            : null,
                      ),
                      child: Row(
                        children: [
                          Text(
                            idx % 2 == 0 ? '👦' : '👧',
                            style: const TextStyle(fontSize: 13),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            child.name,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                              color: isSelected ? Colors.white : const Color(0xFF475569),
                            ),
                          ),
                          if (child.className != null) ...[
                            const SizedBox(width: 4),
                            Text(
                              '(${child.className})',
                              style: TextStyle(
                                fontSize: 11,
                                color: isSelected ? const Color(0xFF94A3B8) : const Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  // 실시간 도착 카운트다운(ETA) 카드
  Widget _buildLiveETACard() {
    final eta = _calculateLiveETA();
    final badgeColor = eta['badgeColor'] as Color;

    return Container(
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
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: badgeColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    '실시간 버스 도착 현황',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                  ),
                ],
              ),
              if (_busLat != null && _busLng != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFA7F3D0)),
                  ),
                  child: const Row(
                    children: [
                      Text('●', style: TextStyle(color: Color(0xFF10B981), fontSize: 8)),
                      SizedBox(width: 4),
                      Text('위치 수신 중', style: TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.directions_bus_filled_rounded, color: Color(0xFF2563EB), size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eta['title'],
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      eta['subtitle'],
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 라이브 탑승 3단계 스테퍼 (Live Stepper)
  Widget _buildRideStepper() {
    // 0: 탑승 대기, 1: 버스 탑승 중, 2: 도착 완료
    int currentStep = 0;
    if (_busLat != null && _busLng != null) {
      currentStep = 1;
    }

    final isGohome = _activeTab == 'gohome';
    final stepTitles = isGohome
        ? ['원 하원 대기', '셔틀 탑승 중', '정류장 하차 완료']
        : ['정류장 탑승 대기', '셔틀 이동 중', '원 도착 완료'];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '통학 진행 단계',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (int i = 0; i < 3; i++) ...[
                _buildStepNode(
                  stepNumber: i + 1,
                  title: stepTitles[i],
                  isActive: i == currentStep,
                  isDone: i < currentStep,
                ),
                if (i < 2)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: i < currentStep ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                    ),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepNode({
    required int stepNumber,
    required String title,
    required bool isActive,
    required bool isDone,
  }) {
    Color bg = const Color(0xFFF1F5F9);
    Color textColor = const Color(0xFF94A3B8);
    Widget icon = Text('$stepNumber', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)));

    if (isDone) {
      bg = const Color(0xFF10B981);
      textColor = const Color(0xFF0F172A);
      icon = const Icon(Icons.check, size: 14, color: Colors.white);
    } else if (isActive) {
      bg = const Color(0xFF2563EB);
      textColor = const Color(0xFF2563EB);
      icon = const Text('●', style: TextStyle(fontSize: 10, color: Colors.white));
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: icon,
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isActive || isDone ? FontWeight.bold : FontWeight.w500,
            color: textColor,
          ),
        ),
      ],
    );
  }

  // 원클릭 빠른 일정 변경 바
  Widget _buildQuickActionRow() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '⚡ 오늘 통학 간편 변경',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
              ),
              MouseRegion(
                cursor: SystemMouseCursors.click,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () async {
                    final user = ApiService().currentUser;
                    if (user == null) return;
                    if (mounted) setState(() => _isModalOpen = true);
                    await showDialog(
                      context: context,
                      builder: (_) => ChangeRequestModal(
                        email: user.email,
                        onSuccess: _loadAllData,
                      ),
                    );
                    if (mounted) setState(() => _isModalOpen = false);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: const Text(
                      '상세 신청 >',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: InkWell(
                    onTap: () => _handleQuickChangeRequest(
                      type: 'ABSENCE',
                      title: '오늘 결석',
                      description: '오늘 하루 종일 등원하지 않으며 차량에 탑승하지 않습니다.',
                    ),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('🚨', style: TextStyle(fontSize: 13)),
                          SizedBox(width: 6),
                          Text(
                            '오늘 하루 결석',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: InkWell(
                    onTap: () => _handleQuickChangeRequest(
                      type: 'PICKUP',
                      title: '직접 픽업',
                      description: '하원 셔틀을 타지 않고 보호자가 원으로 직접 아이를 데리러 갑니다.',
                    ),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('🚶', style: TextStyle(fontSize: 13)),
                          SizedBox(width: 6),
                          Text(
                            '오늘 직접 픽업',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHomeBody(bool isStudent, dynamic user) {
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
                // 1. 다자녀 스위처 (형제/자매가 있을 때)
                if (!isStudent) _buildMultiChildSelector(),

                // 2. 등원 / 하원 탭 전환
                Row(
                  children: [
                    _buildTabItem('goto', '☀️ 오전 등원'),
                    const SizedBox(width: 8),
                    _buildTabItem('gohome', '🌙 오후 하원'),
                  ],
                ),
                const SizedBox(height: 14),

                // 3. 실시간 버스 카운트다운(ETA) 위젯
                _buildLiveETACard(),
                const SizedBox(height: 12),

                // 4. 통학 라이브 3단계 스테퍼
                _buildRideStepper(),
                const SizedBox(height: 14),

                // 5. 실시간 카카오 지도 (지도 뷰 - 모달 열림 시 pointer 차단 및 2점 마커 완벽 전달)
                IgnorePointer(
                  ignoring: _isModalOpen,
                  child: Container(
                    height: 270,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: KakaoMapView(
                      isGohome: _activeTab == 'gohome',
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
                      myChildLat: _childInfo?.latitude,
                      myChildLng: _childInfo?.longitude,
                      isInteractive: !_isModalOpen,
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // 6. 탑승지 및 담당 교사 인포 카드
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
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _activeTab == 'gohome' ? const Color(0xFFECFDF5) : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          _activeTab == 'gohome' ? Icons.flag_rounded : Icons.location_on,
                          color: _activeTab == 'gohome' ? const Color(0xFF10B981) : const Color(0xFF2563EB),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _activeTab == 'gohome'
                                  ? '${_todaySchedule?['dateStr'] ?? DateFormat('yyyy년 M월 d일').format(DateTime.now())} · 하원 도착'
                                  : '${_todaySchedule?['dateStr'] ?? DateFormat('yyyy년 M월 d일').format(DateTime.now())} · 등원 탑승',
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _activeTab == 'gohome'
                                  ? '${_childInfo?.boardingLocation ?? _childInfo?.address ?? "마곡나루역 1번 출구 앞"} (하원 정류장)'
                                  : (_todaySchedule?['address'] ?? '${_childInfo?.boardingLocation ?? _childInfo?.address ?? "마곡나루역 1번 출구 앞"}'),
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // 7. 원클릭 빠른 일정 변경 바
                if (!isStudent) ...[
                  _buildQuickActionRow(),
                  const SizedBox(height: 14),
                ],

                // 8. Child Info & Allergy Card
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
                        ),
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

                // 9. 학생 QR 스캐너 또는 신청 내역 버튼
                if (isStudent)
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
                  )
                else
                  OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const MyRequestsScreen()),
                      );
                    },
                    icon: const Icon(Icons.history_rounded, size: 18, color: Color(0xFF475569)),
                    label: const Text(
                      '신청 및 변경 내역 보러가기',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF475569)),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      backgroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
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
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.2),
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


  @override
  Widget build(BuildContext context) {
    final user = ApiService().currentUser;
    final isStudent = user?.role == 'STUDENT';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _selectedTabIndex == 0 ? _buildAppBar() : null,
      body: PageView(
        controller: _pageController,
        onPageChanged: (idx) => setState(() => _selectedTabIndex = idx),
        children: [
          _isLoading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
              : _buildHomeBody(isStudent, user),
          ClassBoardScreen(childClassName: _childInfo?.className, isEmbeddedTab: true),
          const ChatRoomListScreen(isEmbeddedTab: true),
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
          left: true,
          right: true,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                _buildBottomNavItem(index: 0, icon: Icons.home_outlined, label: '홈'),
                _buildBottomNavItem(index: 1, icon: Icons.article_outlined, label: '알림장·게시물'),
                _buildBottomNavItem(
                  index: 2,
                  icon: Icons.forum_outlined,
                  label: '메신저',
                  badgeCount: _unreadChatCount + _unreadNotificationCount,
                ),
                _buildBottomNavItem(index: 3, icon: Icons.settings_outlined, label: '설정'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabItem(String tab, String label) {
    final isSelected = _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = tab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0F172A) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.12),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: isSelected ? Colors.white : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }
}
