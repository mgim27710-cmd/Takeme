import 'package:flutter/material.dart';
import '../../models/student_model.dart';
import '../../services/api_service.dart';
import '../../utils/student_id.dart';
import '../login_screen.dart';
import '../parent/notification_list_screen.dart';

/// 학생 앱 홈: 오늘 몇 호차를, 어디서, 몇 시에 타는지 한눈에 보여 준다. (글씨와 버튼은 크게)
class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key});

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> {
  StudentModel? _me;
  Map<String, dynamic>? _today;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = ApiService().currentUser;
    if (user == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final me = await ApiService().getMyChild(user.email, throwOnError: true);
      final today = await ApiService().getTodaySchedule(user.email);
      if (!mounted) return;
      setState(() {
        _me = me;
        _today = today;
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

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('로그아웃 할까요?', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('아니요')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('로그아웃')),
        ],
      ),
    );
    if (ok != true) return;
    await ApiService().logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  Widget _row(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: const Color(0xFF2563EB), size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(value, style: const TextStyle(fontSize: 18, color: Color(0xFF0F172A), fontWeight: FontWeight.w800, height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _todayCard() {
    final t = _today;
    final hasToday = t != null && (t['vehicleName'] != null || t['address'] != null);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.directions_bus_rounded, color: Color(0xFF2563EB)),
              const SizedBox(width: 8),
              const Text('오늘의 버스', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const Spacer(),
              if (t?['isChanged'] == true)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(12)),
                  child: const Text('오늘만 바뀌었어요', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (!hasToday)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Text('오늘은 통학 일정이 없어요.', style: TextStyle(fontSize: 16, color: Color(0xFF64748B))),
            )
          else ...[
            _row(Icons.confirmation_number_rounded, '타는 버스', t!['vehicleName']?.toString() ?? '아직 정해지지 않았어요'),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            _row(Icons.place_rounded, '타는 곳', t['address']?.toString() ?? '아직 정해지지 않았어요'),
            if ((t['timeString']?.toString() ?? '').isNotEmpty) ...[
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              _row(Icons.schedule_rounded, '시간', t['timeString'].toString()),
            ],
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ApiService().currentUser;
    final name = _me?.name ?? user?.name ?? '';
    final place = [
      if ((_me?.academyName ?? '').isNotEmpty) _me!.academyName!,
      if ((_me?.className ?? '').isNotEmpty) _me!.className!,
    ].join(' · ');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Takeme 학생', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(tooltip: '새로고침', icon: const Icon(Icons.refresh_rounded), onPressed: _load),
          IconButton(tooltip: '로그아웃', icon: const Icon(Icons.logout_rounded), onPressed: _logout),
        ],
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
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15)),
                        const SizedBox(height: 14),
                        FilledButton(onPressed: _load, child: const Text('다시 불러오기')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        name.isEmpty ? '안녕!' : '안녕, $name!',
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      if (place.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(place, style: const TextStyle(fontSize: 15, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                      ],
                      const SizedBox(height: 16),
                      _todayCard(),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 60,
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationListScreen())),
                          icon: const Icon(Icons.notifications_rounded),
                          label: const Text('알림 보기', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                          style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Center(
                        child: Text(
                          '내 아이디: ${studentIdFromEmail(user?.email ?? '')}',
                          style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
