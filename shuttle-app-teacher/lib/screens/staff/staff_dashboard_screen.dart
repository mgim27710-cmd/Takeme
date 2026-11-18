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
  bool _isDriverOperating = false;
  String? _escortName;
  String? _escortConfirmedAt;
  bool _isCheckingIn = false;
  int _unreadNotificationCount = 0;
  int _unreadChatCount = 0;
  Timer? _notificationPollTimer;

  int _currentRunNumber = 1;

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
    });
  }

  @override
  void dispose() {
    _notificationPollTimer?.cancel();
    _scrollController.dispose();
    _broadcastMessageController.dispose();
    _memoController.dispose();
    _flutterTts.stop();
    super.dispose();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final count = await ApiService().getTeacherUnreadCount();
      final chatCount = await ApiService().getChatTotalUnreadCount();
      if (mounted) {
        setState(() {
          _unreadNotificationCount = count;
          _unreadChatCount = chatCount;
        });
      }
    } catch (_) {}
  }

  void _initTts() async {
    await _flutterTts.setLanguage('ko-KR');
    await _flutterTts.setSpeechRate(0.5);
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    final user = ApiService().currentUser;
    if (user == null) return;

    SocketService().connect(ApiService().token);

    final dynamic vehicle;
    final List<Map<String, dynamic>> studentsJson; // 원아 목록 원본 (모델 + 보호자 연락처를 한 번의 요청으로)
    final RouteDataModel? route;
    final Map<String, dynamic>? routePathData;
    try {
      vehicle = await ApiService().getTeacherVehicle(user.email);
      studentsJson = await ApiService().getTeacherStudentsJson(user.email);
      route = await ApiService().getTeacherRoute(user.email);
      routePathData = await ApiService().getRoutePath();
    } catch (e) {
      // 불러오기에 실패하면 로딩 화면에서 멈추지 않고 이유와 다시 시도를 알려준다
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
    // 원아 목록은 이름 가나다순으로 보여준다
    final students = studentsJson.map((item) => StudentModel.fromJson(item)).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    for (final item in studentsJson) {
      final sid = item['id'] is int ? item['id'] as int : int.tryParse(item['id']?.toString() ?? '');
      final phone = item['parentPhone']?.toString() ?? '';
      if (sid != null && phone.isNotEmpty) {
        _parentPhones[sid] = phone;
      }
    }

    // 동승 확인(escort) 상태

    try {
      final escortUrl = Uri.parse('${AppConfig.apiHost}/teacher/escort/status');
      final eRes = await ApiService().getWithAuth(escortUrl);
      if (eRes.statusCode == 200) {
        final data = jsonDecode(utf8.decode(eRes.bodyBytes)) as Map<String, dynamic>;
        _isDriverOperating = data['operating'] == true;
        _escortName = data['escortName'];
        _escortConfirmedAt = data['confirmedAt'];
      }
    } catch (_) {}

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
        SocketService().joinVehicleRoom(vehicleId);

        SocketService().onLocationUpdated((data) {
          if (!mounted) return;
          final lat = (data['lat'] as num?)?.toDouble() ?? (data['latitude'] as num?)?.toDouble();
          final lng = (data['lng'] as num?)?.toDouble() ?? (data['longitude'] as num?)?.toDouble();
          if (lat != null && lng != null) {
            setState(() {
              _busLat = lat;
              _busLng = lng;
              _isDriverOperating = true;
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

  Future<void> _handleEscortCheckIn() async {
    if (!_isDriverOperating) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('기사님이 운행을 시작하면 누를 수 있어요'),
          backgroundColor: Color(0xFFEA580C),
        ),
      );
      return;
    }

    setState(() => _isCheckingIn = true);
    try {
      final url = Uri.parse('${AppConfig.apiHost}/teacher/escort/check-in');
      final res = await ApiService().postWithAuth(url, jsonEncode({}));
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(utf8.decode(res.bodyBytes));
        setState(() {
          _escortName = data['escortName'] ?? ApiService().currentUser?.name;
          _escortConfirmedAt = data['confirmedAt'] ?? DateTime.now().toIso8601String();
        });
        _flutterTts.speak('동승 확인이 완료되었습니다.');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('동승 확인이 완료되었습니다.'),
              backgroundColor: Color(0xFF10B981),
            ),
          );
        }
      } else if (res.statusCode == 409) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('기사님이 운행을 시작하면 누를 수 있어요'),
              backgroundColor: Color(0xFFEA580C),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('동승 확인 처리 실패 (${res.statusCode})'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('네트워크 오류: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isCheckingIn = false);
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
    Map<String, dynamic> res;
    try {
      res = await ApiService().manualBoardStudent(user.email, student.id, '');
    } catch (e) {
      res = {'success': false, 'message': friendlyError(e)};
    }
    if (!mounted) return;
    if (res['success'] == true) {
      _loadAllData();
      _flutterTts.speak('${student.name} 원아 탑승 완료');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${student.name} 원아 탑승 처리에 실패했습니다. ${res['message'] ?? ''}'.trim()),
          backgroundColor: Colors.red,
          action: SnackBarAction(label: '다시 시도', textColor: Colors.white, onPressed: () => _handleManualBoard(student)),
        ),
      );
    }
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
                _loadAllData();
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
                _loadAllData();
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
                _loadAllData();
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
    _broadcastMessageController.clear();
    bool isSending = false;

    final runStudents = _students.where((s) => s.runNumber == _currentRunNumber).toList();
    final targetStudents = _selectedStudentIds.isNotEmpty
        ? runStudents.where((s) => _selectedStudentIds.contains(s.id)).toList()
        : runStudents;
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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.people_outline, size: 18, color: Color(0xFF2563EB)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          targetStudents.isEmpty
                              ? '현재 회차($_currentRunNumber차)에 원아가 없습니다.'
                              : '수신 대상: $_currentRunNumber차 원아 학부모 총 ${targetStudents.length}명',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _broadcastMessageController,
                  maxLines: 4,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: '전송할 메시지 내용을 입력하세요.\n(예: 현재 버스가 탑승지에 곧 도착할 예정입니다)',
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

  String _formatTime(String? iso) {
    if (iso == null || iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      final h = dt.hour.toString().padLeft(2, '0');
      final m = dt.minute.toString().padLeft(2, '0');
      return '$h:$m';
    } catch (_) {
      return iso;
    }
  }

  /// 원아 상태(색 + 문구 + 아이콘). 서버 상태값이 탑승 대기/탑승/결석 세 가지라 하차는 아직 표시하지 않는다.
  ({String label, IconData icon, Color fg, Color bg, Color border}) _statusOf(StudentModel st) {
    if (st.absent) {
      return (label: '결석', icon: Icons.block, fg: const Color(0xFFB91C1C), bg: const Color(0xFFFEE2E2), border: const Color(0xFFFECACA));
    }
    if (st.boarded) {
      return (label: '탑승', icon: Icons.check_circle, fg: const Color(0xFF15803D), bg: const Color(0xFFDCFCE7), border: const Color(0xFFBBF7D0));
    }
    return (label: '탑승 전', icon: Icons.schedule, fg: const Color(0xFF475569), bg: const Color(0xFFF1F5F9), border: const Color(0xFFE2E8F0));
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
                    Text(
                      st.boardingLocation ?? st.address,
                      style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              _statusChip(st),
              const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
            ],
          ),
        ),
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
          final child = Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: outlined ? color : Colors.white),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: outlined ? color : Colors.white)),
            ],
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
                    Text('성별: ${st.gender}', style: const TextStyle(fontSize: 16, color: Color(0xFF475569))),
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
                  if (st.allergies.isNotEmpty)
                    noteBox('알레르기: ${st.allergies}', const Color(0xFFB91C1C), const Color(0xFFFEF2F2), Icons.warning_amber_rounded),
                  if (st.parentMessage != null && st.parentMessage!.isNotEmpty)
                    noteBox('학부모 메시지: ${st.parentMessage}', const Color(0xFF1E40AF), const Color(0xFFEFF6FF), Icons.chat_bubble_outline),
                  if (st.teacherMemo != null && st.teacherMemo!.isNotEmpty)
                    noteBox('교사 메모: ${st.teacherMemo}', const Color(0xFF92400E), const Color(0xFFFFFBEB), Icons.sticky_note_2_outlined),
                  if (!_hasNote(st))
                    noteBox('등록된 특이사항이 없습니다.', const Color(0xFF64748B), const Color(0xFFF1F5F9), Icons.info_outline),
                  const SizedBox(height: 16),

                  // 처리 버튼: 상태마다 할 수 있는 동작만 보여준다
                  if (!st.boarded && !st.absent)
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: actionButton(
                            label: '탑승',
                            icon: Icons.check_circle,
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
                    SizedBox(
                      width: double.infinity,
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
                    )
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
            onPressed: _loadAllData,
          ),
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.forum_outlined, color: Color(0xFF0F172A), size: 24),
                tooltip: '메신저 & 알림',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChatRoomListScreen()),
                  ).then((_) => _loadUnreadCount());
                },
              ),
              if ((_unreadNotificationCount + _unreadChatCount) > 0)
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
                        (_unreadNotificationCount + _unreadChatCount) > 9
                            ? '9+'
                            : '${_unreadNotificationCount + _unreadChatCount}',
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
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
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
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Text(
                                  '탑승 명단 (${runList.where((s) => s.boarded).length}/${runList.length}명) · $_currentRunNumber차',
                                  style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF334155), fontSize: 14),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (_selectedStudentIds.isNotEmpty)
                                GestureDetector(
                                  onTap: _showBroadcastModal,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF6FF),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFBFDBFE)),
                                    ),
                                    child: Text(
                                      '선택 메시지 전송 (${_selectedStudentIds.length})',
                                      style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 11),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                            ],
                          ),
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
                          : ListView.separated(
                              controller: _scrollController,
                              padding: EdgeInsets.fromLTRB(isLandscape ? 8 : 16, 4, 16, 16),
                              itemCount: runList.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 8),
                              itemBuilder: (ctx, idx) => _buildStudentCard(runList[idx]),
                            ),
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
                // Escort Button / Badge
                Expanded(
                  child: _escortConfirmedAt != null
                      ? Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF86EFAC)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.verified, size: 18, color: Color(0xFF15803D)),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Tooltip(
                                  message: _escortName != null && _escortName!.isNotEmpty ? '동승자: $_escortName' : '',
                                  child: Text(
                                    '동승 확인됨 · ${_formatTime(_escortConfirmedAt)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                      color: Color(0xFF15803D),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ElevatedButton.icon(
                          onPressed: _isCheckingIn ? null : _handleEscortCheckIn,
                          icon: _isCheckingIn
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.airline_seat_recline_normal, color: Colors.white, size: 18),
                          label: const Text(
                            '동승 시작',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _isDriverOperating ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                        ),
                ),

                const SizedBox(width: 8),

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
