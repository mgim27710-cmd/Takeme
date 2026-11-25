import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../services/local_push.dart';
import '../../models/student_model.dart';
import '../../models/route_model.dart';
import '../../widgets/kakao_map_view.dart';
import 'change_request_modal.dart';
import 'my_requests_screen.dart';
import 'daily_notice_screen.dart';
import 'board_community_screen.dart';
import 'parent_chat_room_list_screen.dart';
import '../settings_screen.dart';
import 'child_info_screen.dart';

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  int _currentNavIndex = 0; // 0: 홈/셔틀, 1: 알림장, 2: 원 게시판, 3: 대화방
  String _activeTab = 'goto'; // 'goto' (등원) | 'gohome' (하원)

  // 다자녀(Multi-Child) 지원 상태
  List<StudentModel> _children = [];
  int _selectedChildIndex = 0;
  StudentModel? get _childInfo => _children.isNotEmpty && _selectedChildIndex < _children.length
      ? _children[_selectedChildIndex]
      : null;

  RouteDataModel? _routeData;
  int _unreadNotificationCount = 0;
  Timer? _notificationPollTimer;
  Map<String, dynamic>? _todaySchedule;

  double? _busLat;
  double? _busLng;
  DateTime? _lastBusUpdate;
  // 기사 앱이 올린 실제 도로 경로(전체)와 지나온 위치. 없으면 정류장끼리 이은 선으로 대신 그린다.
  List<dynamic>? _roadPath;
  int _roadProgress = 0;
  // 기사 앱이 위치와 함께 보내는 값: 현재 속도, 다음 정류장 이름과 그곳까지 남은 시간(초)
  double? _busSpeedKmh;
  String? _nextStopName;
  int? _nextStopEtaSec;
  // 운행 상태: null = 아직 모름, true = 운행 중, false = 운행 안 함. 이번 화면에서 운행 중을 본 적이 있는지
  bool? _isOperating;
  bool _sawOperating = false;
  // 내 아이 정류장 앞에 남은 정류장 수 (몇 정거장 전). null = 아직 모름
  int? _stopsBefore;
  bool _isLoading = true;
  String? _loadError; // 홈 데이터 일부 불러오기 실패 이유 (null 이면 정상)
  bool _isScanning = false;
  bool _isModalOpen = false;

  final _allergyController = TextEditingController();
  final List<String> _commonAllergies = [
    '땅콩', '견과류', '우유', '복숭아', '계란', '갑각류', '대두', '밀가루', '생선'
  ];

  @override
  void initState() {
    super.initState();
    // 운행 시작·도착 임박·하차 휴대폰 알림을 받으려면 알림 권한이 필요하다 (안드로이드 13+)
    LocalPush.instance.requestPermission();
    _loadAllData();
    _loadUnreadCount();
    WidgetsBinding.instance.addPostFrameCallback((_) => _ensureChildInfo());
    _notificationPollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      _loadUnreadCount();
      // 위치가 끊겼는지(5분)·남은 시간 표시를 새로 계산하도록 다시 그린다
      setState(() {});
    });
  }

  /// 같은 날 같은 오전/오후 운행의 알림은 한 번만 (예: 20261120AM)
  String _pushDay() {
    final n = DateTime.now();
    return '${n.year}${n.month.toString().padLeft(2, '0')}${n.day.toString().padLeft(2, '0')}${n.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  void dispose() {
    _allergyController.dispose();
    _notificationPollTimer?.cancel();
    final vehicleId = _routeData?.vehicleId;
    if (vehicleId != null) {
      SocketService().leaveVehicleRoom(vehicleId);
    }
    super.dispose();
  }

  /// 가입 후 원아·보호자 필수 정보(성별·연령·주소·주보호자·비상연락망·알레르기)가 비어 있으면
  /// 홈을 쓰기 전에 입력 화면을 먼저 보여준다 (저장해야만 닫힌다).
  bool _childInfoChecked = false;
  Future<void> _ensureChildInfo() async {
    if (_childInfoChecked) return;
    _childInfoChecked = true;
    List<Map<String, dynamic>> list;
    try {
      list = await ApiService().getChildInfoList();
    } catch (e) {
      // 확인하지 못하면 다음에 홈을 열 때 다시 확인한다
      _childInfoChecked = false;
      debugPrint('[ParentHomeScreen] child-info check failed: $e');
      return;
    }
    var changed = false;
    for (final info in list) {
      if (info['isComplete'] == true) continue;
      if (!mounted) return;
      final saved = await Navigator.push<bool>(
        context,
        MaterialPageRoute(builder: (_) => ChildInfoScreen(info: info, required: true)),
      );
      changed = changed || saved == true;
    }
    if (changed && mounted) _loadAllData();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final user = ApiService().currentUser;
      if (user == null) return;
      // 알림은 모두 메신저의 TakeMe 알림으로 오므로, 메신저 안 읽은 수(TakeMe 알림 포함)를 대화방 탭에 표시한다
      final count = await ApiService().getChatTotalUnreadCount();
      if (mounted) {
        setState(() => _unreadNotificationCount = count);
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

      // 불러오기에 실패한 이유 (하나라도 실패하면 화면 위에 안내를 보여준다)
      String? loadProblem;

      // 1. 다자녀 목록 조회 (실패하면 "아이가 없음"으로 보이지 않게 이유를 기록)
      List<StudentModel> childrenList = [];
      try {
        childrenList = await ApiService().getMyChildren(user.email, throwOnError: true);
      } catch (e) {
        loadProblem = friendlyError(e);
      }

      _children = childrenList;
      if (_selectedChildIndex >= _children.length) {
        _selectedChildIndex = 0;
      }

      // 2. 현재 선택된 자녀의 노선 및 오늘 일정 병렬 로드 (다자녀 studentId 및 등/하원 모드 연동)
      final currentChildId = _childInfo?.id;
      final results = await Future.wait<Object?>([
        ApiService()
            .getParentRoute(user.email, studentId: currentChildId, direction: _activeTab, throwOnError: true)
            .catchError((Object e) {
          loadProblem ??= friendlyError(e);
          return null;
        }),
        ApiService().getTodaySchedule(user.email, throwOnError: true).catchError((Object e) {
          loadProblem ??= friendlyError(e);
          return null;
        }),
      ]).timeout(const Duration(seconds: 8), onTimeout: () {
        debugPrint('[ParentHomeScreen] _loadAllData timed out after 8s');
        loadProblem ??= '응답이 늦어 일부 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        return [null, null];
      });

      final route = results[0] as RouteDataModel?;
      final schedule = results[1] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          if (_routeData?.vehicleId != route?.vehicleId) {
            // 차량이 바뀌면(등원↔하원 차량 등) 이전 차량의 도로 경로를 지운다
            _roadPath = null;
            _roadProgress = 0;
          }
          _routeData = route;
          _todaySchedule = schedule;
          _loadError = loadProblem;
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
            final routeVehicleId = route.vehicleId!;
            // 실제 도로 경로: 처음 한 번 불러오고, 기사 앱이 경로를 바꾸면 실시간으로 받는다
            ApiService().getParentRoutePath().then((data) {
              if (!mounted || data == null) return;
              final path = data['path'];
              if (path is List && path.isNotEmpty) {
                setState(() {
                  _roadPath = path;
                  _roadProgress = (data['progressIndex'] as num?)?.toInt() ?? 0;
                });
              }
            });
            SocketService().onRoutePathUpdated((data) {
              if (!mounted) return;
              final vid = (data['vehicleId'] as num?)?.toInt();
              if (vid != null && vid != routeVehicleId) return;
              final path = data['path'];
              if (path is List && path.isNotEmpty) {
                setState(() {
                  _roadPath = path;
                  _roadProgress = (data['progressIndex'] as num?)?.toInt() ?? 0;
                });
              }
            });
            SocketService().onLocationUpdated((data) {
              if (!mounted || data['lat'] == null || data['lng'] == null) return;
              final vid = (data['vehicleId'] as num?)?.toInt();
              if (vid != null && vid != routeVehicleId) return; // 내 아이 차량 것만
              setState(() {
                _busLat = double.tryParse(data['lat'].toString());
                _busLng = double.tryParse(data['lng'].toString());
                _lastBusUpdate = DateTime.now();
                _busSpeedKmh = (data['speedKmh'] as num?)?.toDouble();
                _nextStopName = data['nextStopName']?.toString();
                _nextStopEtaSec = (data['nextStopEtaSeconds'] as num?)?.toInt();
                // 위치가 오면 운행 중이다
                _isOperating = true;
                _sawOperating = true;
              });
            });
            SocketService().onBusProgress((data) {
              if (!mounted) return;
              final sid = (data['studentId'] as num?)?.toInt();
              if (sid == null || sid != _childInfo?.id) return;
              setState(() => _stopsBefore = (data['stopsBefore'] as num?)?.toInt());
            });
            // 도착 N분 전: 휴대폰 알림
            SocketService().onBusArriving((data) {
              final sid = (data['studentId'] as num?)?.toInt();
              if (sid == null || sid != _childInfo?.id) return;
              if (data['kind'] != 'SOON') return;
              final name = (data['studentName'] ?? _childInfo?.name ?? '아이').toString();
              LocalPush.instance.show(
                dedupeKey: 'soon_${sid}_${_pushDay()}',
                title: '🚌 곧 버스가 도착해요',
                body: (data['message']?.toString().isNotEmpty ?? false)
                    ? data['message'].toString()
                    : '$name 정류장에 버스가 곧 도착합니다. 나와서 기다려 주세요.',
                within: const Duration(hours: 2),
              );
            });
            SocketService().onVehicleOperatingStatus((data) {
              if (!mounted) return;
              final vid = (data['vehicleId'] as num?)?.toInt();
              if (vid != null && vid != routeVehicleId) return;
              final op = data['isOperating'] == true;
              // 운행 시작: 휴대폰 알림 (차량 방에 들어갈 때 오는 '현재 상태'는 initial=true 라 알리지 않는다)
              if (op && data['initial'] != true) {
                final bus = (data['busNumber'] ?? '').toString();
                LocalPush.instance.show(
                  dedupeKey: 'opstart_${vid ?? routeVehicleId}_${_pushDay()}',
                  title: '🚌 통학버스 운행 시작',
                  body: '${bus.isEmpty ? '버스' : bus}가 운행을 시작했어요. 앱에서 버스 위치를 볼 수 있어요.',
                  within: const Duration(hours: 2),
                );
              }
              setState(() {
                _isOperating = op;
                if (op) _sawOperating = true;
                if (!op) {
                  _stopsBefore = null;
                  // 운행이 끝나면 버스 위치를 지운다 (지도에서 버스 표시가 사라지고 [버스 위치]는 '운행 중 아님' 안내)
                  _busLat = null;
                  _busLng = null;
                  _nextStopEtaSec = null;
                  _nextStopName = null;
                }
              });
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
              // 하차: 휴대폰 알림
              if (newBoardStatus == 'DROPPED') {
                LocalPush.instance.show(
                  dedupeKey: 'drop_${targetStudentId}_${_pushDay()}',
                  title: '✅ $studentName 하차 완료',
                  body: '$studentName 원아가 버스에서 안전하게 내렸어요.',
                  within: const Duration(hours: 2),
                );
              }
              final statusKr = newBoardStatus == 'BOARDED' ? '탑승 완료' : (newBoardStatus == 'DROPPED' ? '하차 완료' : (newBoardStatus == 'ABSENT' ? '결석' : '탑승 대기'));
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
      if (mounted) setState(() => _loadError = friendlyError(e));
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
                '📌 $description\n원장님 및 차량선생님께 실시간으로 전달됩니다.',
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

  // ───────────── 실시간 도착 예정 시간 · 지연 · 운행 상태 ─────────────

  /// 위치가 이 시간 넘게 안 들어오면 "위치가 갱신되지 않았어요"로 알린다
  static const Duration _staleAfter = Duration(minutes: 5);

  /// 계획보다 이 시간 이상 늦을 때만 "약 N분 늦어요"를 보여준다 (몇 분 차이는 신호·승하차로 흔히 생긴다)
  static const int _delayNoticeMinutes = 5;

  static double _distM(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLng = (lng2 - lng1) * math.pi / 180;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  /// 기사 앱 도로 경로를 [lat, lng] 목록으로
  List<List<double>> _roadPoints() {
    final out = <List<double>>[];
    for (final p in _roadPath ?? const []) {
      if (p is Map) {
        final lat = double.tryParse((p['lat'] ?? p['latitude'])?.toString() ?? '');
        final lng = double.tryParse((p['lng'] ?? p['longitude'])?.toString() ?? '');
        if (lat != null && lng != null) out.add([lat, lng]);
      }
    }
    return out;
  }

  /// 버스 위치에서 목적지까지 남은 도로 거리(m). 도로 경로가 없으면 직선거리 x 1.3.
  /// 목적지를 이미 지났으면 0.
  double _remainingMeters(double toLat, double toLng) {
    final pts = _roadPoints();
    if (pts.length > 1) {
      int nearest(double lat, double lng, int from) {
        var best = from;
        var bestD = double.infinity;
        for (var i = from; i < pts.length; i++) {
          final d = _distM(lat, lng, pts[i][0], pts[i][1]);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        return best;
      }

      final start = _roadProgress.clamp(0, pts.length - 1);
      final busIdx = nearest(_busLat!, _busLng!, start);
      final destIdx = nearest(toLat, toLng, busIdx);
      if (destIdx <= busIdx) return _distM(_busLat!, _busLng!, toLat, toLng) < 80 ? 0 : _distM(_busLat!, _busLng!, toLat, toLng) * 1.3;
      var sum = _distM(_busLat!, _busLng!, pts[busIdx][0], pts[busIdx][1]);
      for (var i = busIdx; i < destIdx; i++) {
        sum += _distM(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      }
      return sum;
    }
    return _distM(_busLat!, _busLng!, toLat, toLng) * 1.3;
  }

  /// 남은 시간(초). 시내 통학차량 평균(신호·정차 포함) 시속 25km, 지금 더 빨리 달리면 그 속도로.
  int _etaSeconds(double meters) {
    final kmh = (_busSpeedKmh != null && _busSpeedKmh! > 25) ? _busSpeedKmh! : 25.0;
    return (meters / (kmh / 3.6)).round();
  }

  /// "HH:mm" 예정 시각을 오늘 날짜로
  DateTime? _plannedTime(String? hhmm) {
    if (hhmm == null) return null;
    final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm.trim());
    if (m == null) return null;
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, int.parse(m.group(1)!), int.parse(m.group(2)!));
  }

  String _hhmm(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Map<String, dynamic> _etaState(String status, String title, String subtitle, Color color, {String? notice}) => {
        'status': status,
        'title': title,
        'subtitle': subtitle,
        'badgeColor': color,
        'notice': notice,
      };

  /// 실시간 버스 도착 현황: 운행 전 / 운행 중(남은 시간·다음 정류장·지연) / 위치 끊김 / 운행 종료
  /// 다른 원아 정류장의 이름·위치는 보여주지 않는다 (학부모에게는 내 아이 정류장만 온다)
  Map<String, dynamic> _calculateLiveETA() {
    const grey = Color(0xFF64748B);
    const blue = Color(0xFF3B82F6);
    const green = Color(0xFF10B981);
    const amber = Color(0xFFF59E0B);
    const red = Color(0xFFEF4444);
    final isGohome = _activeTab == 'gohome';
    final board = _childInfo?.boardStatus ?? 'WAITING';

    if (_routeData == null || _routeData?.vehicleId == null) {
      return _etaState('NONE', '배정된 차량이 없어요', '차량이 배정되면 여기서 위치와 도착 시간을 볼 수 있어요.', grey);
    }
    if (board == 'ABSENT') {
      return _etaState('ABSENT', '오늘은 결석이에요', '결석(미탑승)으로 처리되어 셔틀을 타지 않습니다.', grey);
    }
    if (board == 'DROPPED') {
      return _etaState('DONE', isGohome ? '하차 완료' : '유치원 도착 완료', isGohome ? '아이가 안전하게 내렸어요.' : '아이가 유치원에 도착했어요.', green);
    }

    final hasBus = _busLat != null && _busLng != null;
    if (_isOperating == false) {
      if (_sawOperating || board == 'BOARDED') {
        return _etaState('ENDED', '운행이 끝났어요', '오늘 이 차량의 운행이 종료되었습니다.', grey);
      }
      return _etaState('BEFORE', '아직 출발 전이에요', isGohome ? '하원 차량이 출발하면 위치와 도착 시간을 알려드려요.' : '등원 차량이 출발하면 위치와 도착 시간을 알려드려요.', blue);
    }
    if (!hasBus) {
      if (_isOperating == true) {
        return _etaState('STARTING', '차량이 출발했어요', '차량 위치를 받는 중입니다.', blue);
      }
      return _etaState('BEFORE', '아직 출발 전이에요', isGohome ? '하원 차량이 출발하면 위치와 도착 시간을 알려드려요.' : '등원 차량이 출발하면 위치와 도착 시간을 알려드려요.', blue);
    }

    // 위치가 5분 넘게 안 들어옴: 마지막 위치를 그대로 보여주고 알린다
    final last = _lastBusUpdate;
    final stale = last != null && DateTime.now().difference(last) >= _staleAfter;

    // 목적지: 아이가 타기 전이면 아이 정류장(등원 탑승지/하원 하차지), 등원 중 이미 탔으면 유치원
    final myStop = (_routeData?.stops ?? []).cast<RouteStop?>().firstWhere((s) => s?.isMyChild == true, orElse: () => null);
    double? destLat;
    double? destLng;
    String destLabel;
    String? planned;
    if (!isGohome && board == 'BOARDED') {
      destLat = _routeData?.academyLat;
      destLng = _routeData?.academyLng;
      destLabel = '유치원';
    } else {
      destLat = myStop?.latitude ?? _childInfo?.latitude;
      destLng = myStop?.longitude ?? _childInfo?.longitude;
      destLabel = isGohome ? '하차 정류장' : '탑승 정류장';
      planned = myStop?.expectedTime;
    }
    if (destLat == null || destLng == null || destLat == 0) {
      return _etaState('RUNNING', '운행 중이에요', '정류장 위치가 등록되지 않아 도착 시간을 계산할 수 없어요.', green,
          notice: stale ? '위치가 5분 넘게 갱신되지 않았어요 (마지막 ${_hhmm(last)})' : null);
    }

    // 다음 정류장이 우리 아이 정류장이면 기사 앱의 도로 기준 남은 시간을 그대로 쓴다
    final myNames = [myStop?.rawName, _childInfo?.name].whereType<String>().where((e) => e.isNotEmpty);
    final nextIsMine = _nextStopName != null && myNames.any((n) => _nextStopName!.contains(n));
    final meters = _remainingMeters(destLat, destLng);
    var etaSec = (nextIsMine && destLabel != '유치원' && _nextStopEtaSec != null) ? _nextStopEtaSec! : _etaSeconds(meters);
    if (stale) etaSec = _etaSeconds(meters); // 끊긴 동안은 마지막 위치 기준
    final etaMin = (etaSec / 60).ceil();
    final arriveAt = DateTime.now().add(Duration(seconds: etaSec));

    // 다음 정류장 안내: 다른 원아의 정류장 이름은 보여주지 않는다
    String nextInfo;
    if (destLabel == '유치원') {
      nextInfo = '유치원으로 가는 중';
    } else if (nextIsMine) {
      nextInfo = '다음 정류장이 우리 아이 $destLabel이에요';
    } else if (_nextStopName != null) {
      nextInfo = '다른 정류장을 들른 뒤 도착해요';
    } else {
      nextInfo = '$destLabel으로 가는 중';
    }

    // 지연: 원장님이 정해 둔 예정 시각보다 5분 이상 늦을 때만
    String? notice;
    final plan = _plannedTime(planned);
    if (plan != null) {
      final late = arriveAt.difference(plan).inMinutes;
      if (late >= _delayNoticeMinutes) notice = '약 $late분 늦어요 (예정 ${_hhmm(plan)})';
    }
    if (stale) notice = '위치가 5분 넘게 갱신되지 않았어요 · 마지막 위치 ${_hhmm(last)} 기준';

    if (meters < 80 || etaMin <= 1) {
      return _etaState('ARRIVING', '곧 $destLabel 도착', destLabel == '유치원' ? '유치원에 거의 다 왔어요.' : '미리 나와 주세요.', red, notice: notice);
    }
    return _etaState(
      etaMin <= 5 ? 'NEAR' : 'RUNNING',
      '$destLabel까지 약 $etaMin분 (${_hhmm(arriveAt)} 도착 예정)',
      nextInfo,
      stale ? grey : (etaMin <= 5 ? amber : green),
      notice: notice,
    );
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
                    '식품이나 약품 등 주의해야 할 알레르기를 등록해주세요. 차량선생님 및 기사님께 실시간 공유됩니다.',
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
                '차량선생님의 폰에 띄워진 QR 코드를 사각형 안에 맞춰주세요.',
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
        // 종(알림 목록) 버튼은 없앴다: 알림은 모두 대화방의 TakeMe 알림으로 오고, 안 읽은 수는 아래 대화방 탭에 보인다
        IconButton(
          icon: const Icon(Icons.settings_outlined, color: Color(0xFF475569)),
          tooltip: '설정',
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ).then((_) => _loadAllData());
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
              if (_busLat != null &&
                  _busLng != null &&
                  _isOperating != false &&
                  _lastBusUpdate != null &&
                  DateTime.now().difference(_lastBusUpdate!) < _staleAfter)
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
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                    ),
                    // 몇 정거장 전: 버스 → 남은 정류장 → 우리 아이 정류장
                    if (_stopsBefore != null && _isOperating != false && (eta['status'] == 'RUNNING' || eta['status'] == 'NEAR' || eta['status'] == 'ARRIVING') && (_childInfo?.boardStatus ?? 'WAITING') != 'DROPPED') ...[
                      const SizedBox(height: 10),
                      _buildStopsBeforeBar(_stopsBefore!),
                    ],
                    // 지연("약 N분 늦어요") 또는 위치 끊김(5분) 안내
                    if (eta['notice'] != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.schedule, size: 16, color: Color(0xFFB45309)),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              eta['notice'],
                              style: const TextStyle(fontSize: 14, color: Color(0xFFB45309), fontWeight: FontWeight.w800),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// 몇 정거장 전 막대: 🚌 ● ● ● ★  (●는 우리 아이 정류장 앞에 남은 정류장, 최대 6개까지 그리고 나머지는 +N)
  Widget _buildStopsBeforeBar(int stopsBefore) {
    const shown = 6;
    final dots = stopsBefore > shown ? shown : stopsBefore;
    final label = stopsBefore == 0 ? '다음 정류장이 우리 아이 정류장이에요' : '우리 아이 정류장까지 $stopsBefore정거장 전';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
        const SizedBox(height: 6),
        Row(
          children: [
            const Icon(Icons.directions_bus_filled, size: 20, color: Color(0xFFF59E0B)),
            for (var i = 0; i < dots; i++) ...[
              Expanded(child: Container(height: 3, color: const Color(0xFFCBD5E1))),
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(color: Color(0xFF94A3B8), shape: BoxShape.circle),
              ),
            ],
            if (stopsBefore > shown)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text('+${stopsBefore - shown}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
              ),
            Expanded(child: Container(height: 3, color: const Color(0xFF7C3AED))),
            const Icon(Icons.star_rounded, size: 22, color: Color(0xFF7C3AED), semanticLabel: '우리 아이 정류장'),
          ],
        ),
      ],
    );
  }

  // 라이브 탑승 3단계 스테퍼 (Live Stepper)
  Widget _buildRideStepper() {
    // 0: 탑승 대기, 1: 버스 탑승 중, 2: 도착 완료
    // 아이 상태 기준: 탑승 전 → 탑승(이동 중) → 하차(도착)
    final board = _childInfo?.boardStatus ?? 'WAITING';
    int currentStep = 0;
    if (board == 'BOARDED') currentStep = 1;
    if (board == 'DROPPED') currentStep = 2;

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
              const Flexible(
                child: Text(
                  '⚡ 오늘 통학 간편 변경',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                ),
              ),
              const SizedBox(width: 8),
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
                  // 주요 기능이라 크고 눈에 띄는 파란 버튼 (누르는 영역 높이 44)
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2563EB).withValues(alpha: 0.25),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.edit_calendar_rounded, size: 18, color: Colors.white),
                        SizedBox(width: 6),
                        Text(
                          '상세 신청',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ],
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

  /// 홈 데이터 중 일부를 불러오지 못했을 때 화면 위에 보여주는 안내 (이유 + 다시 시도)
  Widget _buildLoadErrorBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, color: Color(0xFFEA580C), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '일부 정보를 불러오지 못했습니다',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF9A3412)),
                ),
                const SizedBox(height: 2),
                Text(
                  _loadError ?? '',
                  style: const TextStyle(fontSize: 12, color: Color(0xFFC2410C)),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: _loadAllData,
            child: const Text('다시 시도', style: TextStyle(fontWeight: FontWeight.w800)),
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
                if (_loadError != null) _buildLoadErrorBanner(),

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
                      actualRoadPath: _roadPath,
                      progressIndex: _roadProgress,
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

  @override
  Widget build(BuildContext context) {
    final user = ApiService().currentUser;
    final isStudent = user?.role == 'STUDENT';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _currentNavIndex == 0 ? _buildAppBar() : null,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : IndexedStack(
              index: _currentNavIndex,
              children: [
                _buildHomeBody(isStudent, user),
                DailyNoticeScreen(
                  childClassName: _childInfo?.className,
                  isEmbedded: true,
                ),
                const BoardCommunityScreen(isEmbedded: true),
                const ParentChatRoomListScreen(isEmbedded: true),
              ],
            ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentNavIndex,
        onTap: (index) {
          setState(() => _currentNavIndex = index);
          _loadUnreadCount();
        },
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.white,
        selectedItemColor: const Color(0xFF2563EB),
        unselectedItemColor: const Color(0xFF94A3B8),
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 11),
        elevation: 8,
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.directions_bus_rounded),
            activeIcon: Icon(Icons.directions_bus_rounded, color: Color(0xFF2563EB)),
            label: '홈 / 셔틀',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.menu_book_outlined),
            activeIcon: Icon(Icons.menu_book_rounded, color: Color(0xFF2563EB)),
            label: '알림장',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded, color: Color(0xFF2563EB)),
            label: '게시판',
          ),
          // 메시지·TakeMe 알림이 오면 안 읽은 수를 빨간 배지로
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: _unreadNotificationCount > 0,
              label: Text(_unreadNotificationCount > 99 ? '99+' : '$_unreadNotificationCount'),
              child: const Icon(Icons.chat_bubble_outline_rounded),
            ),
            activeIcon: Badge(
              isLabelVisible: _unreadNotificationCount > 0,
              label: Text(_unreadNotificationCount > 99 ? '99+' : '$_unreadNotificationCount'),
              child: const Icon(Icons.chat_bubble_rounded, color: Color(0xFF2563EB)),
            ),
            label: '대화방',
          ),
        ],
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
