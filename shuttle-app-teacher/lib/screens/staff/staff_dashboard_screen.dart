import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../models/student_model.dart';
import '../../models/route_model.dart';
import '../../widgets/kakao_map_view.dart';
import '../settings_screen.dart';
import '../chat/chat_room_list_screen.dart';

class StaffDashboardScreen extends StatefulWidget {
  const StaffDashboardScreen({super.key});

  @override
  State<StaffDashboardScreen> createState() => _StaffDashboardScreenState();
}

class _StaffDashboardScreenState extends State<StaffDashboardScreen> {
  List<StudentModel> _students = [];
  final Map<int, String> _parentPhones = {};
  RouteDataModel? _routeData;

  bool _isLoading = true;
  int _unreadChatCount = 0;
  Timer? _notificationPollTimer;

  int _currentRunNumber = 1;
  int? _vehicleId;

  // 운행 모드: 'MORNING'(등원 운행) | 'AFTERNOON'(하원 운행)
  // 현재 시각 기준 (낮 12시 이전: 등원, 12시 이후: 하원) 기본 설정
  String _activeDirection = DateTime.now().hour < 12 ? 'MORNING' : 'AFTERNOON';

  double? _busLat;
  double? _busLng;
  List<dynamic>? _actualRoadPath;
  int _progressIndex = 0;

  final ScrollController _scrollController = ScrollController();
  final FlutterTts _flutterTts = FlutterTts();
  final Set<int> _selectedStudentIds = {};
  final _broadcastMessageController = TextEditingController();
  final _memoController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initTts();
    _loadAllData();
    _loadUnreadCount();
    _notificationPollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadUnreadCount());
    SocketService().connect(ApiService().token);
    SocketService().onNotificationReceived((_) {
      if (mounted) _loadUnreadCount();
    });
    SocketService().onRoomUpdated((_) {
      if (mounted) _loadUnreadCount();
    }, key: 'home');
    _initChangeListeners();
  }

  void _initChangeListeners() {
    void handleRefresh(dynamic data) {
      if (!mounted) return;
      _loadAllData(silent: true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('원아 통학 변동사항이 실시간 반영되었습니다.'),
          duration: Duration(seconds: 2),
          backgroundColor: Color(0xFF2563EB),
        ),
      );
    }

    SocketService().on('studentStatusChanged', handleRefresh);
    SocketService().on('changeRequestCreated', handleRefresh);
    SocketService().on('changeRequestDecided', handleRefresh);
    SocketService().on('routeUpdated', handleRefresh);
    SocketService().on('routeNeedsRefresh', handleRefresh);
  }

  @override
  void dispose() {
    SocketService().off('studentStatusChanged');
    SocketService().off('changeRequestCreated');
    SocketService().off('changeRequestDecided');
    SocketService().off('routeUpdated');
    SocketService().off('routeNeedsRefresh');
    _notificationPollTimer?.cancel();
    _scrollController.dispose();
    _broadcastMessageController.dispose();
    _memoController.dispose();
    _flutterTts.stop();
    super.dispose();
  }

  Future<void> _loadUnreadCount() async {
    try {
      // 알림은 모두 TakeMe 알림 방으로 오므로 대화방 안 읽은 수(TakeMe 알림 포함)만 센다
      final chatCount = await ApiService().getChatTotalUnreadCount();
      if (mounted) {
        setState(() {
          _unreadChatCount = chatCount;
        });
      }
    } catch (_) {}
  }

  void _initTts() async {
    await _flutterTts.setLanguage('ko-KR');
    await _flutterTts.setSpeechRate(0.5);
  }

  Future<void> _loadAllData({bool silent = false}) async {
    // 최초 진입 시에만 전체 화면 로딩을 노출하고, 이후 갱신은 부드럽게 백그라운드로 처리
    final isInitial = _students.isEmpty;
    if (!silent && isInitial) {
      setState(() => _isLoading = true);
    }
    final user = ApiService().currentUser;
    if (user == null) return;

    SocketService().connect(ApiService().token);

    final dynamic vehicle;
    final List<Map<String, dynamic>> studentsJson;
    final RouteDataModel? route;
    final Map<String, dynamic>? routePathData;
    try {
      // 4개의 API를 직렬 대신 Future.wait로 병렬 호출하여 로딩 속도 3~4배 단축
      final results = await Future.wait([
        ApiService().getTeacherVehicle(user.email),
        ApiService().getTeacherStudentsJson(user.email, mode: _activeDirection),
        ApiService().getTeacherRoute(user.email, mode: _activeDirection),
        ApiService().getRoutePath(),
      ]);
      vehicle = results[0];
      studentsJson = (results[1] as List).cast<Map<String, dynamic>>();
      route = results[2] as RouteDataModel?;
      routePathData = results[3] as Map<String, dynamic>?;
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('정보를 불러오지 못했습니다. ${friendlyError(e)}'),
            action: SnackBarAction(label: '다시 시도', onPressed: _loadAllData),
          ),
        );
      }
      return;
    }

    // 원아 모델과 보호자 연락처를 같은 응답에서 만든다 (같은 목록을 두 번 요청하지 않는다)
    // 노선 정류장 도착 순서 매핑 (1순위: 버스 노선 stops 순서, 2순위: 탑승 예정 시간, 3순위: 이름 가나다순)
    final stopOrderMap = <dynamic, int>{};
    if (route != null && route.stops.isNotEmpty) {
      for (int i = 0; i < route.stops.length; i++) {
        final stop = route.stops[i];
        if (stop.id != null) stopOrderMap[stop.id] = i;
        if (stop.name.isNotEmpty) stopOrderMap[stop.name] = i;
        if (stop.rawName != null && stop.rawName!.isNotEmpty) stopOrderMap[stop.rawName!] = i;
      }
    }

    final students = studentsJson.map((item) => StudentModel.fromJson(item)).toList()
      ..sort((a, b) {
        // 0. 탑승 상태 우선순위:
        //    탑승 대기(WAITING) -> 0 (상단 유지)
        //    탑승 완료(BOARDED) -> 1 (탑승 처리 시 아래로 내려감)
        //    하차/결석(DROPPED/ABSENT) -> 2 (맨 아래로 이동)
        int statusPriority(StudentModel s) {
          if (s.boarded) return 1;
          if (s.dropped || s.absent) return 2;
          return 0;
        }

        final pA = statusPriority(a);
        final pB = statusPriority(b);
        if (pA != pB) {
          return pA.compareTo(pB);
        }

        // 1. 노선 정류장 도착 순서
        final orderA = stopOrderMap[a.id] ?? stopOrderMap[a.name] ?? stopOrderMap[a.realName] ?? 9999;
        final orderB = stopOrderMap[b.id] ?? stopOrderMap[b.name] ?? stopOrderMap[b.realName] ?? 9999;
        if (orderA != orderB) {
          return orderA.compareTo(orderB);
        }
        // 2. 탑승 예정 시간
        final timeComp = a.expectedTime.compareTo(b.expectedTime);
        if (timeComp != 0) {
          return timeComp;
        }
        // 3. 이름 가나다순
        return a.name.compareTo(b.name);
      });
    for (final item in studentsJson) {
      final sid = item['id'] is int ? item['id'] as int : int.tryParse(item['id']?.toString() ?? '');
      final phone = item['parentPhone']?.toString() ?? '';
      if (sid != null && phone.isNotEmpty) {
        _parentPhones[sid] = phone;
      }
    }

    if (mounted) {
      setState(() {
        _students = students;
        _routeData = route;
        if (routePathData != null) {
          _actualRoadPath = routePathData['path'];
          _progressIndex = routePathData['progressIndex'] ?? 0;
        }
        _isLoading = false;

        final runs = _students.map((s) => s.runNumber).toSet().toList()..sort();
        if (runs.isNotEmpty && !runs.contains(_currentRunNumber)) {
          _currentRunNumber = runs.first;
        }
      });

      final vid = vehicle?['id'];
      if (vid != null) {
        final vehicleId = int.tryParse(vid.toString()) ?? 0;
        _vehicleId = vehicleId;
        SocketService().joinVehicleRoom(vehicleId);

        SocketService().onLocationUpdated((data) {
          if (!mounted) return;
          final lat = (data['lat'] as num?)?.toDouble() ?? (data['latitude'] as num?)?.toDouble();
          final lng = (data['lng'] as num?)?.toDouble() ?? (data['longitude'] as num?)?.toDouble();
          if (lat != null && lng != null) {
            setState(() {
              _busLat = lat;
              _busLng = lng;
            });
          }
        });

        SocketService().onRoutePathUpdated((data) {
          if (!mounted) return;
          setState(() {
            _actualRoadPath = data['path'];
            _progressIndex = data['progressIndex'] ?? 0;
          });
        });
      }
    }
  }

  /// 학부모 연락처로 전화 앱을 연다. 전화 앱을 열 수 없는 기기면 번호를 복사해 둔다.
  Future<void> _callParentPhone(String studentName, String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    var opened = false;
    try {
      opened = await launchUrl(Uri(scheme: 'tel', path: digits));
    } catch (_) {
      opened = false;
    }
    if (opened || !mounted) return;
    Clipboard.setData(ClipboardData(text: phone));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('전화 앱을 열 수 없어 $studentName 학부모 연락처($phone)를 복사했습니다.'),
        backgroundColor: const Color(0xFF2563EB),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// 탑승 처리: 이유를 묻지 않고 바로 처리한다.
  Future<void> _handleManualBoard(StudentModel student) async {
    final user = ApiService().currentUser;
    if (user == null) return;

    // 즉시 반응형 낙관적 UI 업데이트 (터치 즉시 탑승 상태로 변경)
    setState(() {
      final idx = _students.indexWhere((s) => s.id == student.id);
      if (idx >= 0) {
        _students[idx] = StudentModel(
          id: student.id,
          name: student.name,
          realName: student.realName,
          address: student.address,
          boardingLocation: student.boardingLocation,
          dropoffLocation: student.dropoffLocation,
          latitude: student.latitude,
          longitude: student.longitude,
          allergies: student.allergies,
          gender: student.gender,
          parentName: student.parentName,
          parentRelation: student.parentRelation,
          emergencyContactName: student.emergencyContactName,
          emergencyContactRelation: student.emergencyContactRelation,
          emergencyContactPhone: student.emergencyContactPhone,
          boarded: true,
          absent: false,
          dropped: false,
          expectedTime: student.expectedTime,
          actualBoardTime: DateTime.now().toIso8601String(),
          teacherMemo: student.teacherMemo,
          parentMessage: student.parentMessage,
          runNumber: student.runNumber,
          isOverride: student.isOverride,
          className: student.className,
          academyName: student.academyName,
          vehicleName: student.vehicleName,
          approvalStatus: student.approvalStatus,
        );
      }
    });

    Map<String, dynamic> res;
    try {
      res = await ApiService().manualBoardStudent(user.email, student.id, '', mode: _activeDirection);
    } catch (e) {
      res = {'success': false, 'message': friendlyError(e)};
    }
    if (!mounted) return;
    if (res['success'] == true) {
      _loadAllData(silent: true);
      if (res['allBoarded'] == true) {
        _flutterTts.speak('${student.name} 원아 탑승 완료. 모든 원아가 탑승했습니다.');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('🎉 모든 원아가 탑승을 완료했습니다!\n원장님과 기사님께 알림이 전송되었습니다.'),
            backgroundColor: Color(0xFF10B981),
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        _flutterTts.speak('${student.name} 원아 탑승 완료');
      }
    } else {
      _loadAllData(silent: true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${student.name} 원아 탑승 처리에 실패했습니다. ${res['message'] ?? ''}'.trim()),
          backgroundColor: Colors.red,
          action: SnackBarAction(label: '다시 시도', textColor: Colors.white, onPressed: () => _handleManualBoard(student)),
        ),
      );
    }
  }

  /// 하차 처리 (탑승한 원아만)
  Future<bool> _dropStudent(StudentModel student, {bool reload = true, Map<String, String>? handover}) async {
    try {
      final res = await ApiService().postWithAuth(
        Uri.parse('${AppConfig.apiHost}/teacher/drop-student'),
        jsonEncode({'studentId': student.id, 'handover': ?handover}),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        setState(() {
          final idx = _students.indexWhere((s) => s.id == student.id);
          if (idx >= 0) {
            _students[idx] = StudentModel(
              id: student.id,
              name: student.name,
              realName: student.realName,
              address: student.address,
              boardingLocation: student.boardingLocation,
              dropoffLocation: student.dropoffLocation,
              latitude: student.latitude,
              longitude: student.longitude,
              allergies: student.allergies,
              gender: student.gender,
              parentName: student.parentName,
              parentRelation: student.parentRelation,
              emergencyContactName: student.emergencyContactName,
              emergencyContactRelation: student.emergencyContactRelation,
              emergencyContactPhone: student.emergencyContactPhone,
              boarded: false,
              absent: false,
              dropped: true,
              expectedTime: student.expectedTime,
              actualBoardTime: student.actualBoardTime,
              teacherMemo: student.teacherMemo,
              parentMessage: student.parentMessage,
              runNumber: student.runNumber,
              isOverride: student.isOverride,
              className: student.className,
              academyName: student.academyName,
              vehicleName: student.vehicleName,
              approvalStatus: student.approvalStatus,
            );
          }
        });
        if (reload) _loadAllData(silent: true);
        return true;
      }
      if (mounted) {
        String msg = '${student.name} 원아 하차 처리에 실패했습니다.';
        try {
          final m = jsonDecode(utf8.decode(res.bodyBytes))['message'];
          if (m != null) msg = '$msg ${m is List ? m.join(', ') : m}';
        } catch (_) {}
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${student.name} 원아 하차 처리에 실패했습니다. ${friendlyError(e)}'), backgroundColor: Colors.red),
        );
      }
    }
    return false;
  }

  /// 하차 + 보호자 인수 확인: 누가 아이를 받았는지 고른 뒤 하차 처리
  Future<void> _handleDropStudent(StudentModel student) async {
    final handover = await _askHandover(student);
    if (handover == null) return; // 취소
    if (await _dropStudent(student, handover: handover)) {
      _flutterTts.speak('${student.name} 원아 하차 완료');
    }
  }

  /// "누가 아이를 받았나요?" 주보호자 / 비상연락망 / 다른 분(이름·관계 입력) / 유치원 선생님께 인계
  Future<Map<String, String>?> _askHandover(StudentModel st) async {
    String join(List<String> parts) => parts.where((e) => e.trim().isNotEmpty).join(' ');
    final primary = join([st.parentRelation, st.parentName]);
    final emergency = join([st.emergencyContactRelation, st.emergencyContactName]);

    final choice = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        Widget option(String value, IconData icon, String title, String? sub) => ListTile(
              minTileHeight: 60,
              leading: Icon(icon, size: 26, color: const Color(0xFF7C3AED)),
              title: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              subtitle: sub == null || sub.isEmpty ? null : Text(sub, style: const TextStyle(fontSize: 14)),
              onTap: () => Navigator.pop(ctx, value),
            );
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 4),
                child: Text('${st.name} 원아를 누가 받았나요?',
                    style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Text('인수한 분을 기록하고 학부모님께 함께 알려드려요.',
                    style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
              ),
              option('PRIMARY', Icons.person, '주보호자', primary.isEmpty ? null : primary),
              if (st.emergencyContactPhone.isNotEmpty || emergency.isNotEmpty)
                option('EMERGENCY', Icons.contact_phone, '비상연락망 보호자', emergency.isEmpty ? null : emergency),
              option('OTHER', Icons.person_add_alt_1, '다른 분', '이름과 관계를 입력해요'),
              option('ACADEMY', Icons.school, '유치원 선생님께 인계', '등원해서 유치원에 도착했을 때'),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    if (choice == null || !mounted) return null;
    if (choice != 'OTHER') return {'type': choice};

    final nameCtrl = TextEditingController();
    final relCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('아이를 받은 분'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              autofocus: true,
              style: const TextStyle(fontSize: 17),
              decoration: const InputDecoration(labelText: '이름 (필수)', hintText: '예: 김철수'),
            ),
            TextField(
              controller: relCtrl,
              style: const TextStyle(fontSize: 17),
              decoration: const InputDecoration(labelText: '관계', hintText: '예: 이모, 학원 선생님'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('하차 처리')),
        ],
      ),
    );
    if (ok != true) return null;
    if (nameCtrl.text.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('아이를 받은 분의 이름을 입력해 주세요.')));
      }
      return null;
    }
    return {'type': 'OTHER', 'name': nameCtrl.text.trim(), 'relation': relCtrl.text.trim()};
  }

  bool _bulkBoarding = false;
  bool _bulkDropping = false;

  /// 탑승 처리할 수 있는 원아인지 (아직 타지 않았고 결석이나 하차 상태가 아닌 아이)
  bool _canBoard(StudentModel s) {
    if (s.absent) return false;
    if (s.boarded) return false;
    if (s.dropped) return false;
    return true;
  }

  /// 명단 전체 선택 / 전체 해제
  void _toggleSelectAll(List<StudentModel> runList) {
    final ids = runList.map((s) => s.id).toSet();
    setState(() {
      if (ids.isNotEmpty && ids.every(_selectedStudentIds.contains)) {
        _selectedStudentIds.removeAll(ids);
      } else {
        _selectedStudentIds.addAll(ids);
      }
    });
  }

  /// 선택한 원아를 한 번에 탑승 처리 (이미 탔거나 결석·하차한 아이는 건너뜀, 실패한 아이는 알려줌)
  Future<void> _boardSelected(List<StudentModel> runList) async {
    if (_bulkBoarding) return;
    final targets = runList.where((s) => _selectedStudentIds.contains(s.id) && _canBoard(s)).toList();
    if (targets.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('선택한 원아는 이미 탑승했거나 결석·하차 처리되어 탑승할 아이가 없어요.')),
      );
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${targets.length}명 탑승 처리', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text('선택한 원아를 탑승 처리할까요?\n\n${targets.map((s) => s.name).join(', ')}',
            style: const TextStyle(fontSize: 15, height: 1.4)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('탑승 처리', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final user = ApiService().currentUser;
    if (user == null) return;

    setState(() => _bulkBoarding = true);
    final failed = <String>[];
    bool lastAllBoarded = false;
    for (final s in targets) {
      try {
        final res = await ApiService().manualBoardStudent(user.email, s.id, '', mode: _activeDirection);
        if (res['success'] != true) {
          failed.add(s.name);
        } else if (res['allBoarded'] == true) {
          lastAllBoarded = true;
        }
      } catch (_) {
        failed.add(s.name);
      }
    }
    if (!mounted) return;
    setState(() {
      _bulkBoarding = false;
      // 탑승에 성공한 아이는 선택을 푼다 (실패한 아이는 남겨 두어 다시 시도할 수 있게)
      for (final s in targets) {
        if (!failed.contains(s.name)) _selectedStudentIds.remove(s.id);
      }
    });
    _loadAllData(silent: true);
    final done = targets.length - failed.length;
    if (done > 0) {
      if (lastAllBoarded) {
        _flutterTts.speak('$done명 탑승 완료. 모든 원아가 탑승했습니다.');
      } else {
        _flutterTts.speak('$done명 탑승 완료');
      }
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(failed.isEmpty
            ? (lastAllBoarded
                ? '🎉 전원 탑승 완료! ($done명)\n원장님과 기사님께 알림이 전송되었습니다.'
                : '$done명 탑승 처리했습니다.')
            : '$done명 탑승 처리했고, ${failed.length}명은 실패했어요: ${failed.join(', ')}. 다시 시도해 주세요.'),
        backgroundColor: failed.isEmpty ? const Color(0xFF10B981) : Colors.red,
        duration: const Duration(seconds: 4),
      ),
    );
  }

  /// 일괄 하차 공통 실행 루틴
  Future<void> _executeBulkDrop(List<StudentModel> targets, Map<String, String> handover) async {
    if (targets.isEmpty || _bulkDropping) return;
    setState(() => _bulkDropping = true);
    var ok = 0;
    final failed = <String>[];
    for (final s in targets) {
      try {
        final success = await _dropStudent(s, reload: false, handover: handover);
        if (success) {
          ok++;
          setState(() {
            _selectedStudentIds.remove(s.id);
          });
        } else {
          failed.add(s.name);
        }
      } catch (_) {
        failed.add(s.name);
      }
    }
    setState(() => _bulkDropping = false);
    _loadAllData(silent: true);
    if (ok > 0) {
      _flutterTts.speak('$ok명 하차 완료');
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(failed.isEmpty
            ? '$ok명 하차 처리 완료되었습니다.'
            : '$ok명 하차 완료, ${failed.length}명 실패: ${failed.join(', ')}'),
        backgroundColor: failed.isEmpty ? const Color(0xFF7C3AED) : Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  /// 회차 내 대기 중인 원아들을 한 번에 일괄 탑승(출석) 처리
  void _confirmBoardAll(List<StudentModel> waitingList) {
    if (waitingList.isEmpty) return;
    final names = waitingList.map((s) => s.name).join(', ');
    final isAfternoon = _activeDirection == 'AFTERNOON';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('${waitingList.length}명 전원 일괄 탑승', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(
          isAfternoon
              ? '유치원에서 하원 버스에 탑승할 원아 ${waitingList.length}명을 모두 탑승 처리할까요?\n\n$names'
              : '현재 회차의 대기 원아 ${waitingList.length}명을 모두 탑승 처리할까요?\n\n$names',
          style: const TextStyle(fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _bulkBoarding = true);
              final user = ApiService().currentUser;
              if (user == null) {
                setState(() => _bulkBoarding = false);
                return;
              }
              final failed = <String>[];
              for (final s in waitingList) {
                try {
                  final res = await ApiService().manualBoardStudent(user.email, s.id, '');
                  if (res['success'] != true) failed.add(s.name);
                } catch (_) {
                  failed.add(s.name);
                }
              }
              setState(() => _bulkBoarding = false);
              _loadAllData(silent: true);
              final done = waitingList.length - failed.length;
              if (done > 0) {
                _flutterTts.speak('$done명 전원 탑승 완료');
              }
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(failed.isEmpty
                      ? '🎉 $done명 전원 일괄 탑승 완료되었습니다!'
                      : '$done명 탑승 처리, ${failed.length}명 실패: ${failed.join(', ')}'),
                  backgroundColor: failed.isEmpty ? const Color(0xFF10B981) : Colors.red,
                  duration: const Duration(seconds: 3),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            ),
            child: const Text('전원 탑승', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _confirmDropAll(List<StudentModel> boarded) {
    if (boarded.isEmpty) return;
    final isAfternoon = _activeDirection == 'AFTERNOON';
    final defaultType = isAfternoon ? 'PRIMARY' : 'ACADEMY';
    final defaultLabel = isAfternoon ? '각 원아의 주보호자(부모님)' : '유치원 선생님';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${boarded.length}명 모두 하차', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(
          isAfternoon
              ? '하원 운행 중인 모든 탑승 원아를 하차 처리할까요?\n(인계 대상: $defaultLabel)\n\n${boarded.map((s) => s.name).join(', ')}'
              : '유치원에 도착해 선생님께 인계한 것으로 모두 하차 처리할까요?\n\n${boarded.map((s) => s.name).join(', ')}',
          style: const TextStyle(fontSize: 15, height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _executeBulkDrop(boarded, {'type': defaultType});
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('모두 하차', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  /// 동일 정류장의 탑승 원아들을 한 번에 일괄 하차 처리
  Future<void> _dropStopStudents(List<StudentModel> students) async {
    final boarded = students.where((s) => s.boarded).toList();
    if (boarded.isEmpty) return;

    final names = boarded.map((s) => s.name).join(', ');
    final isAfternoon = _activeDirection == 'AFTERNOON';
    final defaultType = isAfternoon ? 'PRIMARY' : 'ACADEMY';
    final defaultLabel = isAfternoon ? '각 원아의 주보호자(부모님)' : '유치원 선생님';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('${boarded.length}명 일괄 하차', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$names 원아를 모두 하차 처리할까요?', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F3FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFDDD6FE)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 18, color: Color(0xFF7C3AED)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '인계 대상: $defaultLabel',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C3AED),
              foregroundColor: Colors.white,
            ),
            child: const Text('모두 하차', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;
    await _executeBulkDrop(boarded, {'type': defaultType});
  }

  /// 선택된 원아들 일괄 하차 처리
  Future<void> _dropSelected(List<StudentModel> runList) async {
    final targets = runList.where((s) => _selectedStudentIds.contains(s.id) && s.boarded).toList();
    if (targets.isEmpty) return;

    final names = targets.map((s) => s.name).join(', ');
    final isAfternoon = _activeDirection == 'AFTERNOON';
    final defaultType = isAfternoon ? 'PRIMARY' : 'ACADEMY';
    final defaultLabel = isAfternoon ? '각 원아의 주보호자(부모님)' : '유치원 선생님';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('선택한 ${targets.length}명 일괄 하차', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('선택한 원아들을 모두 하차 처리할까요?\n$names', style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F3FF),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFDDD6FE)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 18, color: Color(0xFF7C3AED)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '인계 대상: $defaultLabel',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7C3AED)),
            child: const Text('모두 하차', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;
    await _executeBulkDrop(targets, {'type': defaultType});
  }

  /// 동일 정류장의 대기 원아들을 한 번에 일괄 탑승 처리
  Future<void> _boardStopStudents(List<StudentModel> students) async {
    final waiting = students.where((s) => _canBoard(s)).toList();
    if (waiting.isEmpty) return;

    final names = waiting.map((s) => s.name).join(', ');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${waiting.length}명 일괄 탑승', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text('$names 원아를 모두 탑승 처리할까요?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('모두 탑승', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (ok != true || !mounted) return;
    final user = ApiService().currentUser;
    if (user == null) return;

    final failed = <String>[];
    for (final s in waiting) {
      try {
        final res = await ApiService().manualBoardStudent(user.email, s.id, '', mode: _activeDirection);
        if (res['success'] != true) failed.add(s.name);
      } catch (_) {
        failed.add(s.name);
      }
    }
    _loadAllData(silent: true);
    final done = waiting.length - failed.length;
    if (done > 0) {
      _flutterTts.speak('$done명 탑승 완료');
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(failed.isEmpty
            ? '$done명 탑승 처리했습니다.'
            : '$done명 탑승 처리, ${failed.length}명 실패: ${failed.join(', ')}'),
        backgroundColor: failed.isEmpty ? const Color(0xFF10B981) : Colors.red,
      ),
    );
  }

  void _handleUnboardStudent(StudentModel student) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('${student.name} 원아 탑승 취소', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Text('${student.name} 원아의 탑승 처리를 취소하고 다시 대기 상태로 변경할까요?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final url = Uri.parse('${AppConfig.apiHost}/teacher/unboard-student');
              final res = await ApiService().postWithAuth(
                url,
                jsonEncode({'studentId': student.id}),
              );
              if (res.statusCode == 200 || res.statusCode == 201) {
                _loadAllData(silent: true);
                _flutterTts.speak('${student.name} 원아 탑승 취소');
              } else {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('탑승 취소 처리에 실패했습니다.'), backgroundColor: Colors.red),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('탑승 취소', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _handleSkipStudent(StudentModel student) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${student.name} 원아 미탑승(결석) 처리', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('해당 원아를 오늘 미탑승 처리하고 다음 목적지로 안내를 계속하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final user = ApiService().currentUser;
              if (user == null) return;
              final res = await ApiService().skipStudent(user.email, student.id);
              if (res['success'] == true) {
                _loadAllData(silent: true);
                _flutterTts.speak('${student.name} 원아 미탑승 처리 완료.');
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('결석 처리', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }



  void _showStudentMemoDialog(StudentModel student) {
    _memoController.text = student.teacherMemo ?? '';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${student.name} 원아 메모 및 특이사항', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (student.allergies.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFDC2626)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '알레르기: ${student.allergies}',
                        style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (student.parentMessage != null && student.parentMessage!.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '학부모 메시지: ${student.parentMessage}',
                  style: const TextStyle(color: Color(0xFF1E40AF), fontSize: 12),
                ),
              ),
              const SizedBox(height: 12),
            ],
            const Text('교사 메모 작성:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextField(
              controller: _memoController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: '특이사항이나 전달사항을 입력하세요.',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final res = await ApiService().saveTeacherMemo(student.id, _memoController.text.trim());
              if (res['success'] == true) {
                _loadAllData(silent: true);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB)),
            child: const Text('저장', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showBroadcastModal() {
    bool isSending = false;
    String messageType = 'TRAFFIC'; // 'TRAFFIC' | 'CUSTOM'
    int delayMinutes = 10;
    String trafficReason = '도로 정체'; // '도로 정체' | '사고 수습' | '도로 공사' | '기상 악화' | '신호 대기'

    void updateTrafficMessage(int mins, String reason) {
      String causeText = '도로 교통 정체';
      String actionText = '정류장에서 잠시만 여유를 갖고 기다려 주시면 안전하게 이동하겠습니다.';

      if (reason == '사고 수습') {
        causeText = '전방 교통사고 수습으로 인한 도로 정체';
        actionText = '원아들의 안전을 최우선으로 이동 중이오니 잠시만 기다려 주시기 바랍니다.';
      } else if (reason == '도로 공사') {
        causeText = '구간 내 도로 공사 및 차선 통제';
        actionText = '정류장에서 조금만 여유를 갖고 기다려 주시기 바랍니다.';
      } else if (reason == '기상 악화') {
        causeText = '기상 악화(눈/비)로 인한 안전 서행 운행';
        actionText = '안전을 최우선으로 서행 운행 중이오니 양해 부탁드립니다.';
      } else if (reason == '신호 대기') {
        causeText = '교차로 신호 대기 및 도로 혼잡';
        actionText = '정류장에서 잠시만 기다려 주시기 바랍니다.';
      }

      _broadcastMessageController.text =
          '[통학버스 지연 안내] $causeText로 인하여 차량 운행이 약 $mins분 지연되고 있습니다. $actionText';
    }

    // 기본 교통 정체 10분 지연 문구로 세팅
    updateTrafficMessage(delayMinutes, trafficReason);

    final runStudents = _students.where((s) => s.runNumber == _currentRunNumber).toList();
    // 타지 않은 원아(탑승 대기 중)를 기본 대상으로 지정 (체크박스 선택된 원아가 있으면 해당 원아들 우선)
    final waitingStudents = runStudents.where((s) => !s.boarded && !s.dropped && !s.absent).toList();
    final targetStudents = _selectedStudentIds.isNotEmpty
        ? runStudents.where((s) => _selectedStudentIds.contains(s.id)).toList()
        : (waitingStudents.isNotEmpty ? waitingStudents : runStudents);
    final targetStudentIds = targetStudents.map((s) => s.id).toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 24,
              bottom: MediaQuery.of(context).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      '단체 메시지 전송',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Color(0xFF64748B), size: 20),
                      onPressed: () => Navigator.pop(ctx),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // 수신 대상 안내 배너 (미탑승 원아 학부모 대상 표시)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.people_outline, size: 18, color: Color(0xFF2563EB)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          targetStudents.isEmpty
                              ? '현재 회차($_currentRunNumber차)에 대상 원아가 없습니다.'
                              : _selectedStudentIds.isNotEmpty
                                  ? '수신 대상: 선택된 원아 학부모 총 ${targetStudents.length}명'
                                  : '수신 대상: 미탑승(대기) 원아 학부모 총 ${targetStudents.length}명',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // 메시지 유형 선택 (교통 정체 / 직접 작성)
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('🚦 교통 정체 (지연 안내)'),
                      selected: messageType == 'TRAFFIC',
                      selectedColor: const Color(0xFF2563EB),
                      labelStyle: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: messageType == 'TRAFFIC' ? Colors.white : const Color(0xFF475569),
                      ),
                      onSelected: (_) {
                        setModalState(() {
                          messageType = 'TRAFFIC';
                          updateTrafficMessage(delayMinutes, trafficReason);
                        });
                      },
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('✏️ 기타 (직접 작성)'),
                      selected: messageType == 'CUSTOM',
                      selectedColor: const Color(0xFF2563EB),
                      labelStyle: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.bold,
                        color: messageType == 'CUSTOM' ? Colors.white : const Color(0xFF475569),
                      ),
                      onSelected: (_) {
                        setModalState(() {
                          messageType = 'CUSTOM';
                          _broadcastMessageController.clear();
                        });
                      },
                    ),
                  ],
                ),
                if (messageType == 'TRAFFIC') ...[
                  const SizedBox(height: 12),
                  // 1. 정체 원인(종류) 선택 칩
                  const Text('정체 원인(종류) 선택:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        {'label': '🚦 도로 정체', 'value': '도로 정체'},
                        {'label': '⚠️ 사고 수습', 'value': '사고 수습'},
                        {'label': '🚧 도로 공사', 'value': '도로 공사'},
                        {'label': '🌧️ 기상 악화', 'value': '기상 악화'},
                        {'label': '🚥 신호 대기', 'value': '신호 대기'},
                      ].map((item) {
                        final val = item['value']!;
                        final isSel = trafficReason == val;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(item['label']!),
                            selected: isSel,
                            selectedColor: const Color(0xFFEFF6FF),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: isSel ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                            ),
                            side: BorderSide(
                              color: isSel ? const Color(0xFF3B82F6) : const Color(0xFFCBD5E1),
                              width: isSel ? 1.5 : 1,
                            ),
                            checkmarkColor: const Color(0xFF1D4ED8),
                            onSelected: (_) {
                              setModalState(() {
                                trafficReason = val;
                                updateTrafficMessage(delayMinutes, val);
                              });
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  // 2. 지연 시간 선택 (5분, 10분, 15분, 20분, 30분)
                  const Text('예상 지연 시간 선택:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [5, 10, 15, 20, 30].map((mins) {
                        final isSel = delayMinutes == mins;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text('+$mins분'),
                            selected: isSel,
                            selectedColor: const Color(0xFFDBEAFE),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: isSel ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                            ),
                            side: BorderSide(
                              color: isSel ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
                              width: isSel ? 1.5 : 1,
                            ),
                            checkmarkColor: const Color(0xFF1D4ED8),
                            onSelected: (_) {
                              setModalState(() {
                                delayMinutes = mins;
                                updateTrafficMessage(mins, trafficReason);
                              });
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: _broadcastMessageController,
                  maxLines: 4,
                  autofocus: messageType == 'CUSTOM',
                  decoration: InputDecoration(
                    hintText: '전송할 메시지 내용을 입력하세요.',
                    hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5)),
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: isSending || targetStudentIds.isEmpty
                      ? null
                      : () async {
                          final msg = _broadcastMessageController.text.trim();
                          if (msg.isEmpty) return;

                          setModalState(() => isSending = true);
                          final user = ApiService().currentUser;
                          if (user != null) {
                            final res = await ApiService().broadcastMessage(
                              user.email,
                              studentIds: targetStudentIds,
                              targetRoles: ['PARENT'],
                              message: msg,
                            );
                            if (!ctx.mounted) return;
                            Navigator.pop(ctx);
                            if (!mounted) return;
                            if (res['success'] == true) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('학부모 ${targetStudents.length}명에게 메시지를 전송했습니다.'),
                                  backgroundColor: const Color(0xFF10B981),
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(res['message'] ?? '메시지 전송에 실패했습니다.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: isSending
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(
                          targetStudents.isEmpty
                              ? '수신 대상 없음'
                              : '학부모 ${targetStudents.length}명에게 전송하기',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _onMapStopTap(int idx, String name) {
    final runList = _students.where((s) => s.runNumber == _currentRunNumber).toList();
    final studentIdx = runList.indexWhere((s) => s.name == name || (s.address.contains(name)));
    final targetIdx = studentIdx >= 0 ? studentIdx : (idx < runList.length ? idx : 0);

    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        targetIdx * 76.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  /// 성별 표시: 서버 값이 MALE/FEMALE/M/F/남/여 어느 것이어도 '남'/'여'로
  String _genderKr(String g) {
    final v = g.trim().toUpperCase();
    if (v == 'FEMALE' || v == 'F' || v == '여' || v == '여자') return '여';
    if (v == 'MALE' || v == 'M' || v == '남' || v == '남자') return '남';
    return g;
  }

  /// 원아 상태(색 + 문구 + 아이콘): 탑승 대기 / 탑승 중 / 하차 완료 / 결석
  ({String label, IconData icon, Color fg, Color bg, Color border}) _statusOf(StudentModel st) {
    if (st.absent) {
      return (label: '결석', icon: Icons.block, fg: const Color(0xFFB91C1C), bg: const Color(0xFFFEE2E2), border: const Color(0xFFFECACA));
    }
    if (st.boarded) {
      return (label: '탑승 중', icon: Icons.check_circle_outline, fg: const Color(0xFF15803D), bg: const Color(0xFFDCFCE7), border: const Color(0xFFBBF7D0));
    }
    if (st.dropped) {
      return (label: '하차 완료', icon: Icons.where_to_vote, fg: const Color(0xFF6D28D9), bg: const Color(0xFFEDE9FE), border: const Color(0xFFDDD6FE));
    }
    return (label: '탑승 대기', icon: Icons.schedule, fg: const Color(0xFF475569), bg: const Color(0xFFF1F5F9), border: const Color(0xFFE2E8F0));
  }

  Widget _statusChip(StudentModel st, {double fontSize = 14}) {
    final s = _statusOf(st);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: s.bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: s.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(s.icon, size: fontSize + 2, color: s.fg),
          const SizedBox(width: 4),
          Text(s.label, style: TextStyle(color: s.fg, fontWeight: FontWeight.w800, fontSize: fontSize)),
        ],
      ),
    );
  }

  bool _hasNote(StudentModel st) =>
      st.allergies.isNotEmpty ||
      (st.teacherMemo != null && st.teacherMemo!.isNotEmpty) ||
      (st.parentMessage != null && st.parentMessage!.isNotEmpty);

  /// 원아 목록 한 줄: 이름 · 정류장 · 상태만 보여준다. 연락처와 특이사항은 눌러서 여는 상세 화면에서만 보인다.
  Widget _buildStudentCard(StudentModel st) {
    final isChecked = _selectedStudentIds.contains(st.id);
    final status = _statusOf(st);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _showStudentDetail(st),
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: status.border,
              width: (st.boarded || st.absent) ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              // 메시지 보내기 대상 선택 (터치 영역 48)
              SizedBox(
                width: 40,
                height: 48,
                child: Checkbox(
                  value: isChecked,
                  onChanged: (v) {
                    setState(() {
                      if (v == true) {
                        _selectedStudentIds.add(st.id);
                      } else {
                        _selectedStudentIds.remove(st.id);
                      }
                    });
                  },
                  activeColor: const Color(0xFF2563EB),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            st.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: Color(0xFF1E293B)),
                          ),
                        ),
                        if (_hasNote(st)) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.error_outline, size: 18, color: Color(0xFFDC2626), semanticLabel: '특이사항 있음'),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    // 주보호자 연락처 (없으면 '없음' 표시). 누르면 상세 화면에서 바로 전화할 수 있다
                    Builder(builder: (_) {
                      final phone = (_parentPhones[st.id] ?? '').trim();
                      return Row(
                        children: [
                          Icon(phone.isEmpty ? Icons.phone_disabled : Icons.phone,
                              size: 14, color: phone.isEmpty ? const Color(0xFFCBD5E1) : const Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              phone.isEmpty ? '주보호자 연락처 없음' : '주보호자 $phone',
                              style: TextStyle(
                                fontSize: 13,
                                color: phone.isEmpty ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                                fontWeight: phone.isEmpty ? FontWeight.w400 : FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              // 직관적인 원클릭 액션 버튼: 탑승 가능하면 [탑승] 버튼이 먼저 노출되어 하원 시 즉시 승차 체크 가능!
              if (_canBoard(st))
                SizedBox(
                  height: 36,
                  child: ElevatedButton.icon(
                    onPressed: () => _handleManualBoard(st),
                    icon: const Icon(Icons.check_circle_outline, size: 16),
                    label: const Text('탑승', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                  ),
                )
              else if (st.boarded)
                SizedBox(
                  height: 36,
                  child: ElevatedButton.icon(
                    onPressed: () => _handleDropStudent(st),
                    icon: const Icon(Icons.where_to_vote, size: 16),
                    label: const Text('하차', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF7C3AED),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                  ),
                )
              else
                _statusChip(st),
              const SizedBox(width: 2),
              const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
            ],
          ),
        ),
      ),
    );
  }

  /// 동일 정류장 그룹 카드 (정류장 헤더 + 해당 정류장에 속한 원아 묶음 목록)
  Widget _buildStopGroup(String stopName, List<StudentModel> students) {
    final waiting = students.where((s) => !s.boarded && !s.dropped && !s.absent).toList();
    final boarded = students.where((s) => s.boarded).toList();
    final canBoardList = students.where((s) => _canBoard(s)).toList();
    final canDropList = students.where((s) => s.boarded).toList();
    final allSelected = students.isNotEmpty && students.every((s) => _selectedStudentIds.contains(s.id));
    final expectedTime = students.map((s) => s.expectedTime).firstWhere((t) => t.isNotEmpty, orElse: () => '');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 정류장 헤더 카드
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
              border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1.5)),
            ),
            child: Row(
              children: [
                // 정류장 단위 선택 체크박스
                InkWell(
                  onTap: () {
                    setState(() {
                      if (allSelected) {
                        for (final s in students) {
                          _selectedStudentIds.remove(s.id);
                        }
                      } else {
                        for (final s in students) {
                          _selectedStudentIds.add(s.id);
                        }
                      }
                    });
                  },
                  borderRadius: BorderRadius.circular(4),
                  child: Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Icon(
                      allSelected ? Icons.check_box : Icons.check_box_outline_blank,
                      size: 20,
                      color: allSelected ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
                const Icon(Icons.location_on, size: 18, color: Color(0xFF2563EB)),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              stopName,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (expectedTime.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: Text(
                                expectedTime,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1D4ED8),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '원아 ${students.length}명 (대기 ${waiting.length} · 탑승 ${boarded.length})',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                // 정류장 내 2명 이상 대기 시 '일괄 탑승' 블럭 버튼 노출
                if (canBoardList.length >= 2) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 36,
                    child: ElevatedButton.icon(
                      onPressed: () => _boardStopStudents(canBoardList),
                      icon: const Icon(Icons.check_circle_outline, size: 16),
                      label: Text(
                        '${canBoardList.length}명 일괄 탑승',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 1,
                        shadowColor: const Color(0x3310B981),
                      ),
                    ),
                  ),
                ],
                // 정류장 내 2명 이상 탑승 중 시 '일괄 하차' 블럭 버튼 노출
                if (canDropList.length >= 2) ...[
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 36,
                    child: ElevatedButton.icon(
                      onPressed: () => _dropStopStudents(canDropList),
                      icon: const Icon(Icons.where_to_vote, size: 16),
                      label: Text(
                        '${canDropList.length}명 일괄 하차',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF7C3AED),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 1,
                        shadowColor: const Color(0x337C3AED),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          // 해당 정류장의 원아 카드들
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
            child: Column(
              children: students.map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _buildStudentCard(s),
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }

  /// 원아 상세: 이름·성별·학부모 연락처(누르면 전화)·특이사항, 같은 화면에서 탑승/결석 처리
  void _showStudentDetail(StudentModel st) {
    final phone = _parentPhones[st.id] ?? '';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        Widget actionButton({
          required String label,
          required IconData icon,
          required Color color,
          required VoidCallback onPressed,
          bool outlined = false,
        }) {
          // 버튼 폭이 좁으면 글자·아이콘을 함께 줄여서 넘치지 않게 한다
          final child = FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 22, color: outlined ? color : Colors.white),
                const SizedBox(width: 6),
                Text(label, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: outlined ? color : Colors.white)),
              ],
            ),
          );
          final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
          return SizedBox(
            height: 56,
            child: outlined
                ? OutlinedButton(
                    onPressed: onPressed,
                    style: OutlinedButton.styleFrom(shape: shape, side: BorderSide(color: color, width: 1.5)),
                    child: child,
                  )
                : ElevatedButton(
                    onPressed: onPressed,
                    style: ElevatedButton.styleFrom(backgroundColor: color, shape: shape, elevation: 0),
                    child: child,
                  ),
          );
        }

        Widget callButton(String label, String number, Color fg, Color border) => SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton(
                onPressed: () => _callParentPhone(st.name, number),
                style: OutlinedButton.styleFrom(
                  foregroundColor: fg,
                  side: BorderSide(color: border, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.phone, size: 22),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                    const Spacer(),
                    Text(number, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            );

        Widget noteBox(String text, Color fg, Color bg, IconData icon) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 20, color: fg),
                  const SizedBox(width: 8),
                  Expanded(child: Text(text, style: TextStyle(color: fg, fontSize: 16, fontWeight: FontWeight.w600))),
                ],
              ),
            );

        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + MediaQuery.of(ctx).viewInsets.bottom),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          st.name,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        ),
                      ),
                      _statusChip(st, fontSize: 16),
                    ],
                  ),
                  if (st.gender != null) ...[
                    const SizedBox(height: 4),
                    Text('성별: ${_genderKr(st.gender!)}', style: const TextStyle(fontSize: 16, color: Color(0xFF475569))),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    st.boardingLocation ?? st.address,
                    style: const TextStyle(fontSize: 15, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 16),

                  // 보호자 연락처: 누르면 전화 걸기. 주보호자가 안 받으면 비상연락망으로
                  // 예: "주보호자 · 모 김영희", "비상 · 조모 박순자"
                  if (phone.isNotEmpty)
                    callButton(
                      ['주보호자', [st.parentRelation, st.parentName].where((e) => e.isNotEmpty).join(' ')]
                          .where((e) => e.isNotEmpty)
                          .join(' · '),
                      phone,
                      const Color(0xFF1D4ED8),
                      const Color(0xFF93C5FD),
                    )
                  else
                    noteBox('등록된 주보호자 연락처가 없습니다.', const Color(0xFF64748B), const Color(0xFFF1F5F9), Icons.phone_disabled),
                  const SizedBox(height: 8),
                  if (st.emergencyContactPhone.isNotEmpty)
                    callButton(
                      ['비상', [st.emergencyContactRelation, st.emergencyContactName].where((e) => e.isNotEmpty).join(' ')]
                          .where((e) => e.isNotEmpty)
                          .join(' · '),
                      st.emergencyContactPhone,
                      const Color(0xFFB45309),
                      const Color(0xFFFCD34D),
                    )
                  else
                    noteBox('등록된 비상연락망이 없습니다.', const Color(0xFF64748B), const Color(0xFFF1F5F9), Icons.phone_disabled),
                  const SizedBox(height: 16),

                  // 특이사항
                  Row(
                    children: [
                      const Text('특이사항', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _showStudentMemoDialog(st);
                        },
                        icon: const Icon(Icons.edit_note),
                        label: const Text('메모 쓰기', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                      ),
                    ],
                  ),
                  // 특이사항 칸을 누르면 바로 메모 쓰기
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () {
                      Navigator.pop(ctx);
                      _showStudentMemoDialog(st);
                    },
                    child: Column(
                      children: [
                        if (st.allergies.isNotEmpty)
                          noteBox('알레르기: ${st.allergies}', const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.warning_amber_rounded),
                        if (st.parentMessage != null && st.parentMessage!.isNotEmpty)
                          noteBox('학부모 메시지: ${st.parentMessage}', const Color(0xFF1E40AF), const Color(0xFFEFF6FF), Icons.chat_bubble_outline),
                        if (st.teacherMemo != null && st.teacherMemo!.isNotEmpty)
                          noteBox('교사 메모: ${st.teacherMemo}', const Color(0xFF92400E), const Color(0xFFFFFBEB), Icons.sticky_note_2_outlined),
                        if (!_hasNote(st))
                          noteBox('등록된 특이사항이 없습니다. 눌러서 메모를 쓰세요.', const Color(0xFF64748B), const Color(0xFFF1F5F9), Icons.edit_note),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 처리 버튼: 상태마다 할 수 있는 동작만 보여준다 (하원 시에도 탑승이 먼저 가능하도록 보장)
                  if (_canBoard(st))
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: actionButton(
                            label: '탑승',
                            icon: Icons.check_circle_outline,
                            color: const Color(0xFF10B981),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _handleManualBoard(st);
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: actionButton(
                            label: '결석',
                            icon: Icons.block,
                            color: const Color(0xFFDC2626),
                            outlined: true,
                            onPressed: () {
                              Navigator.pop(ctx);
                              _handleSkipStudent(st);
                            },
                          ),
                        ),
                      ],
                    )
                  else if (st.boarded)
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: actionButton(
                            label: '하차',
                            icon: Icons.where_to_vote,
                            color: const Color(0xFF7C3AED),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _handleDropStudent(st);
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: actionButton(
                            label: '탑승 취소',
                            icon: Icons.undo,
                            color: const Color(0xFFDC2626),
                            outlined: true,
                            onPressed: () {
                              Navigator.pop(ctx);
                              _handleUnboardStudent(st);
                            },
                          ),
                        ),
                      ],
                    )
                  else if (st.dropped)
                    noteBox('오늘 이 운행에서 하차한 원아입니다.', const Color(0xFF6D28D9), const Color(0xFFF5F3FF), Icons.where_to_vote)
                  else
                    noteBox('오늘 결석(미탑승) 처리된 원아입니다.', const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.block),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// 등원/하원 운행 모드 전환 블럭 버튼 (높이 48px, 선명한 블럭 카드 형태)
  Widget _buildDirectionBlockButton({
    required String label,
    required String timeLabel,
    required IconData icon,
    required Color activeColor,
    required Color activeShadow,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          height: 48,
          decoration: BoxDecoration(
            color: isSelected ? activeColor : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? activeColor : const Color(0xFFCBD5E1),
              width: isSelected ? 2 : 1.2,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: activeShadow,
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 20,
                color: isSelected ? Colors.white : const Color(0xFF64748B),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: isSelected ? Colors.white : const Color(0xFF334155),
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.22)
                      : const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  timeLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                  ),
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
    final runList = _students.where((s) => s.runNumber == _currentRunNumber).toList();
    final availableRuns = _students.map((s) => s.runNumber).toSet().toList()..sort();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          '차량선생님 셔틀 탑승 관리',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF64748B)),
            onPressed: () async {
              await _loadAllData(silent: true);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('최신 정보로 갱신되었습니다.'), duration: Duration(seconds: 1)),
              );
            },
          ),
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.forum_outlined, color: Color(0xFF0F172A), size: 24),
                tooltip: '메신저',
                onPressed: () {
                  // 메신저 진입 시 시스템 알림도 함께 읽음 처리
                  ApiService().markAllTeacherNotificationsRead();
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChatRoomListScreen()),
                  ).then((_) => _loadUnreadCount());
                },
              ),
              if (_unreadChatCount > 0)
                Positioned(
                  right: 4,
                  bottom: 4,
                  child: IgnorePointer(
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                      alignment: Alignment.center,
                      child: Text(
                        _unreadChatCount > 9
                            ? '9+'
                            : '$_unreadChatCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          // 사진 보관함(클라우드)은 담임교사 화면에만 둔다. 지도교사 화면에는 없다.
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF475569)),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(66),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Row(
                  children: [
                    // 등원 블럭 버튼
                    Expanded(
                      child: _buildDirectionBlockButton(
                        label: '등원 운행',
                        timeLabel: '오전',
                        icon: Icons.wb_sunny_rounded,
                        activeColor: const Color(0xFF2563EB),
                        activeShadow: const Color(0x3D2563EB),
                        isSelected: _activeDirection == 'MORNING',
                        onTap: () {
                          if (_activeDirection != 'MORNING') {
                            setState(() {
                              _activeDirection = 'MORNING';
                              _selectedStudentIds.clear();
                            });
                            _loadAllData(silent: true);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    // 하원 블럭 버튼
                    Expanded(
                      child: _buildDirectionBlockButton(
                        label: '하원 운행',
                        timeLabel: '오후',
                        icon: Icons.home_rounded,
                        activeColor: const Color(0xFF7C3AED),
                        activeShadow: const Color(0x3D7C3AED),
                        isSelected: _activeDirection == 'AFTERNOON',
                        onTap: () {
                          if (_activeDirection != 'AFTERNOON') {
                            setState(() {
                              _activeDirection = 'AFTERNOON';
                              _selectedStudentIds.clear();
                            });
                            _loadAllData(silent: true);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),
              Container(color: const Color(0xFFE2E8F0), height: 1),
            ],
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : OrientationBuilder(
              builder: (context, orientation) {
                final isLandscape = orientation == Orientation.landscape;

                final mapWidget = Container(
                  height: isLandscape ? double.infinity : 200,
                  margin: isLandscape
                      ? const EdgeInsets.fromLTRB(16, 8, 8, 8)
                      : const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: KakaoMapView(
                    vehicleId: _vehicleId,
                    stops: _routeData?.stops ?? [],
                    routePoints: _routeData?.routePoints ?? [],
                    actualRoadPath: _actualRoadPath,
                    progressIndex: _progressIndex,
                    busLat: _busLat,
                    busLng: _busLng,
                    academyLat: _routeData?.academyLat,
                    academyLng: _routeData?.academyLng,
                    academyName: _routeData?.academyName,
                    onStopTap: _onMapStopTap,
                  ),
                );

                final listWidget = Column(
                  children: [
                    // Passenger count header & active selections
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      color: const Color(0xFFF8FAFC),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '탑승 명단 (${runList.where((s) => s.boarded).length}/${runList.length}명) · $_currentRunNumber차',
                                  style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF1E293B), fontSize: 14),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (_selectedStudentIds.isEmpty) ...[
                                // 대기 원아가 있을 때: '일괄 탑승' 블럭 버튼 노출
                                if (runList.any((s) => _canBoard(s))) ...[
                                  const SizedBox(width: 6),
                                  SizedBox(
                                    height: 36,
                                    child: ElevatedButton.icon(
                                      onPressed: () => _confirmBoardAll(runList.where((s) => _canBoard(s)).toList()),
                                      icon: const Icon(Icons.check_circle_outline, size: 16),
                                      label: Text(
                                        '일괄 탑승 (${runList.where((s) => _canBoard(s)).length})',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF10B981),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        elevation: 1,
                                        shadowColor: const Color(0x3310B981),
                                      ),
                                    ),
                                  ),
                                ],
                                // 탑승 중인 원아가 있을 때: '일괄 하차' 블럭 버튼 노출
                                if (runList.any((s) => s.boarded)) ...[
                                  const SizedBox(width: 6),
                                  SizedBox(
                                    height: 36,
                                    child: ElevatedButton.icon(
                                      onPressed: () => _confirmDropAll(runList.where((s) => s.boarded).toList()),
                                      icon: const Icon(Icons.where_to_vote, size: 16),
                                      label: Text(
                                        '일괄 하차 (${runList.where((s) => s.boarded).length})',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF7C3AED),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        elevation: 1,
                                        shadowColor: const Color(0x337C3AED),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                              if (_selectedStudentIds.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                GestureDetector(
                                  onTap: _showBroadcastModal,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF6FF),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFBFDBFE)),
                                    ),
                                    child: Text(
                                      '선택 메시지 (${_selectedStudentIds.length})',
                                      style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 12),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          // 전체 선택 + 선택한 원아 탑승/하차
                          Builder(builder: (_) {
                            final allSelected = runList.isNotEmpty && runList.every((s) => _selectedStudentIds.contains(s.id));
                            final boardable = runList.where((s) => _selectedStudentIds.contains(s.id) && _canBoard(s)).length;
                            final droppable = runList.where((s) => _selectedStudentIds.contains(s.id) && s.boarded).length;
                            return Row(
                              children: [
                                TextButton.icon(
                                  onPressed: runList.isEmpty ? null : () => _toggleSelectAll(runList),
                                  icon: Icon(allSelected ? Icons.check_box : Icons.check_box_outline_blank,
                                      size: 22, color: const Color(0xFF2563EB)),
                                  label: Text(allSelected ? '전체 해제' : '전체 선택',
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF2563EB))),
                                  style: TextButton.styleFrom(minimumSize: const Size(48, 44), padding: const EdgeInsets.symmetric(horizontal: 8)),
                                ),
                                const Spacer(),
                                if (_selectedStudentIds.isNotEmpty) ...[
                                  if (boardable > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(left: 6),
                                      child: SizedBox(
                                        height: 40,
                                        child: ElevatedButton.icon(
                                          onPressed: _bulkBoarding ? null : () => _boardSelected(runList),
                                          icon: _bulkBoarding
                                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                              : const Icon(Icons.check_circle, size: 18),
                                          label: Text('$boardable명 탑승',
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF10B981),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 10),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                        ),
                                      ),
                                    ),
                                  if (droppable > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(left: 6),
                                      child: SizedBox(
                                        height: 40,
                                        child: ElevatedButton.icon(
                                          onPressed: _bulkDropping ? null : () => _dropSelected(runList),
                                          icon: _bulkDropping
                                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                              : const Icon(Icons.where_to_vote, size: 18),
                                          label: Text('$droppable명 하차',
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF7C3AED),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 10),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                          ),
                                        ),
                                      ),
                                    ),
                                  if (boardable == 0 && droppable == 0)
                                    const Padding(
                                      padding: EdgeInsets.symmetric(horizontal: 8),
                                      child: Text('처리 가능한 원아 없음', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                                    ),
                                ],
                              ],
                            );
                          }),
                          if (availableRuns.length > 1) ...[
                            const SizedBox(height: 6),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: availableRuns.map((r) {
                                  final isSelected = _currentRunNumber == r;
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 6),
                                    child: ChoiceChip(
                                      label: Text('$r차 운행'),
                                      selected: isSelected,
                                      onSelected: (_) => setState(() => _currentRunNumber = r),
                                      selectedColor: const Color(0xFF2563EB),
                                      visualDensity: VisualDensity.compact,
                                      labelStyle: TextStyle(
                                        fontSize: 12,
                                        color: isSelected ? Colors.white : const Color(0xFF475569),
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    // Passenger List with bottom margin for the collapsible panel
                    Expanded(
                      child: runList.isEmpty
                          ? const Center(child: Text('해당 회차에 배정된 원아가 없습니다.', style: TextStyle(color: Color(0xFF94A3B8))))
                          : Builder(builder: (_) {
                              // 원아 목록을 정류장(등원 탑승지 / 하원 하차지) 단위로 그룹핑
                              final stopGroups = <String, List<StudentModel>>{};
                              final isAfternoon = _activeDirection == 'AFTERNOON';
                              for (final s in runList) {
                                final stopName = isAfternoon
                                    ? ((s.dropoffLocation?.trim().isNotEmpty ?? false)
                                        ? s.dropoffLocation!.trim()
                                        : ((s.boardingLocation?.trim().isNotEmpty ?? false)
                                            ? s.boardingLocation!.trim()
                                            : (s.address.trim().isNotEmpty ? s.address.trim() : '하차 정류장 미지정')))
                                    : ((s.boardingLocation?.trim().isNotEmpty ?? false)
                                        ? s.boardingLocation!.trim()
                                        : (s.address.trim().isNotEmpty ? s.address.trim() : '탑승 정류장 미지정'));
                                stopGroups.putIfAbsent(stopName, () => []).add(s);
                              }
                              final groupKeys = stopGroups.keys.toList();

                              return ListView.builder(
                                controller: _scrollController,
                                padding: EdgeInsets.fromLTRB(isLandscape ? 8 : 16, 4, 16, 16),
                                itemCount: groupKeys.length,
                                itemBuilder: (ctx, idx) {
                                  final stopName = groupKeys[idx];
                                  final stopStudents = stopGroups[stopName]!;
                                  return _buildStopGroup(stopName, stopStudents);
                                },
                              );
                            }),
                    ),
                  ],
                );

                if (isLandscape) {
                  return Row(
                    children: [
                      Expanded(flex: 5, child: mapWidget),
                      Expanded(flex: 5, child: listWidget),
                    ],
                  );
                } else {
                  return Column(
                    children: [
                      mapWidget,
                      Expanded(child: listWidget),
                    ],
                  );
                }
              },
            ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          boxShadow: [
            BoxShadow(color: Color(0x12000000), blurRadius: 8, offset: Offset(0, -2)),
          ],
        ),
        child: SafeArea(
          top: false,
          bottom: true,
          left: true,
          right: true,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                // 단체 메시지
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _showBroadcastModal,
                    icon: const Icon(Icons.campaign, color: Colors.white, size: 18),
                    label: const Text(
                      '단체 메시지',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E293B),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
