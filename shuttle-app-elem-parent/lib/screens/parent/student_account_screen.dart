import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';

/// 학생 앱 로그인 아이디 뒤에 자동으로 붙는 주소. 화면에서는 떼고 보여 준다.
const String kStudentIdDomain = '@student.takeme';

/// 자녀의 학생 앱 계정을 만드는 화면 (초등 학부모용)
/// - 초대 코드를 발급해서 자녀에게 알려 주면, 자녀가 학생 앱에서 그 코드로 가입한다.
/// - 만 14세 미만 자녀의 가입이라 보호자 동의가 필요하다.
class StudentAccountScreen extends StatefulWidget {
  const StudentAccountScreen({super.key});

  @override
  State<StudentAccountScreen> createState() => _StudentAccountScreenState();
}

class _StudentAccountScreenState extends State<StudentAccountScreen> {
  List<Map<String, dynamic>> _children = [];
  bool _loading = true;
  String? _error;
  int? _busyStudentId;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _load();
    // 남은 시간을 1분마다 새로 그린다
    _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ApiService().getStudentInviteStatus();
      if (!mounted) return;
      setState(() {
        _children = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = friendlyError(e);
        _loading = false;
      });
    }
  }

  Future<bool> _askConsent(String studentName) async {
    bool agreed = false;
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('보호자 동의', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$studentName 학생이 학생 앱에 가입해서 통학 정보, 알림장, 게시판을 이용합니다.\n\n'
                '만 14세 미만 자녀의 가입에는 보호자(법정대리인)의 동의가 필요합니다.',
                style: const TextStyle(fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 8),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: agreed,
                onChanged: (v) => setLocal(() => agreed = v ?? false),
                title: const Text('위 내용에 동의합니다', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
            FilledButton(
              onPressed: agreed ? () => Navigator.pop(ctx, true) : null,
              child: const Text('동의하고 코드 받기'),
            ),
          ],
        ),
      ),
    );
    return result == true;
  }

  Future<void> _issue(Map<String, dynamic> child) async {
    final studentId = (child['studentId'] as num?)?.toInt();
    if (studentId == null) return;
    final name = child['studentName']?.toString() ?? '자녀';
    if (!await _askConsent(name)) return;
    setState(() => _busyStudentId = studentId);
    try {
      await ApiService().issueStudentInvite(studentId: studentId);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('코드를 받지 못했습니다. ${friendlyError(e)}'), backgroundColor: const Color(0xFFEF4444)),
      );
    } finally {
      if (mounted) setState(() => _busyStudentId = null);
    }
  }

  String _remaining(dynamic expiresAt) {
    try {
      final left = DateTime.parse(expiresAt.toString()).difference(DateTime.now());
      if (left.isNegative) return '기간이 지났어요';
      final h = left.inHours;
      final m = left.inMinutes % 60;
      return h > 0 ? '$h시간 $m분 남음' : '$m분 남음';
    } catch (_) {
      return '';
    }
  }

  String _loginIdOf(String email) =>
      email.endsWith(kStudentIdDomain) ? email.substring(0, email.length - kStudentIdDomain.length) : email;

  Widget _card(Map<String, dynamic> c) {
    final name = c['studentName']?.toString() ?? '자녀';
    final linked = c['linked'] == true;
    final invite = c['activeInvite'] is Map ? Map<String, dynamic>.from(c['activeInvite'] as Map) : null;
    final id = (c['studentId'] as num?)?.toInt();
    final busy = _busyStudentId == id;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.child_care_rounded, color: Color(0xFF2563EB)),
              const SizedBox(width: 8),
              Expanded(child: Text(name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: linked ? const Color(0xFFECFDF5) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  linked ? '학생 계정 연결됨' : '학생 계정 없음',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: linked ? const Color(0xFF059669) : const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (linked) ...[
            Text(
              '학생 아이디: ${_loginIdOf(c['studentLoginId']?.toString() ?? '')}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 4),
            const Text('학생 앱에서 이 아이디와 정한 비밀번호로 로그인해요.', style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          ] else if (invite != null) ...[
            const Text('학생 앱 가입 화면에 이 코드를 입력하게 해 주세요.', style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  Text(
                    invite['code']?.toString() ?? '',
                    style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, letterSpacing: 8, color: Color(0xFF1D4ED8)),
                  ),
                  const SizedBox(height: 4),
                  Text(_remaining(invite['expiresAt']), style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: invite['code']?.toString() ?? ''));
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('코드를 복사했어요.')));
                    },
                    icon: const Icon(Icons.copy_rounded, size: 18),
                    label: const Text('코드 복사'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : () => _issue(c),
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('새 코드 받기'),
                  ),
                ),
              ],
            ),
          ] else ...[
            const Text(
              '초대 코드를 받아서 자녀에게 알려 주세요. 코드는 24시간 동안, 한 번만 쓸 수 있어요.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                onPressed: busy ? null : () => _issue(c),
                icon: busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.vpn_key_rounded),
                label: const Text('초대 코드 받기', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('학생 계정 만들기', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _load, child: const Text('다시 불러오기')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Text(
                          '자녀가 쓰는 학생 앱(Takeme 학생)의 계정을 만들어요. 아래에서 초대 코드를 받아 자녀에게 알려 주면, '
                          '자녀가 학생 앱에서 가입하기를 눌러 코드와 아이디, 비밀번호를 정해요.',
                          style: TextStyle(fontSize: 13, height: 1.5, color: Color(0xFF475569)),
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (_children.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(child: Text('연결된 자녀 정보가 없습니다.', style: TextStyle(color: Color(0xFF94A3B8)))),
                        )
                      else
                        ..._children.map(_card),
                    ],
                  ),
                ),
    );
  }
}
