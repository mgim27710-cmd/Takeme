import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/student_id.dart';

/// 중·고등 학생 가입 화면: 학원 인증코드 + 내 이름 + 아이디 + 비밀번호.
/// 가입하면 원장님이 확인(승인)한 뒤에 로그인할 수 있다. (이름만으로 남이 대신 가입하는 것을 막기 위해서)
class StudentRegisterScreen extends StatefulWidget {
  const StudentRegisterScreen({super.key});

  @override
  State<StudentRegisterScreen> createState() => _StudentRegisterScreenState();
}

class _StudentRegisterScreenState extends State<StudentRegisterScreen> {
  final _authCodeController = TextEditingController();
  final _nameController = TextEditingController();
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  final _password2Controller = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _authCodeController.dispose();
    _nameController.dispose();
    _idController.dispose();
    _passwordController.dispose();
    _password2Controller.dispose();
    super.dispose();
  }

  String? _validateAuthCode(String raw) => raw.trim().length < 4 ? '학원에서 받은 인증코드를 입력해 주세요.' : null;

  String? _validateName(String raw) {
    final t = raw.trim();
    if (t.length < 2) return '이름을 정확히 입력해 주세요. (학원에 등록된 이름)';
    return null;
  }

  Future<void> _submit() async {
    final problem = _validateAuthCode(_authCodeController.text) ??
        _validateName(_nameController.text) ??
        validateStudentId(_idController.text) ??
        validateStudentPassword(_passwordController.text) ??
        (_passwordController.text != _password2Controller.text ? '비밀번호가 서로 달라요. 다시 확인해 주세요.' : null);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ApiService().registerStudentDirect(
        loginId: _idController.text,
        password: _passwordController.text,
        name: _nameController.text,
        authCode: _authCodeController.text,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('가입 신청 완료', style: TextStyle(fontWeight: FontWeight.bold)),
            content: Text(
              '아이디 "${_idController.text.trim().toLowerCase()}" 로 가입을 신청했어요.\n'
              '원장님이 확인하면 로그인할 수 있어요.',
            ),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('확인'))],
          ),
        );
        if (mounted) Navigator.pop(context);
      } else {
        setState(() {
          _busy = false;
          _error = res['message']?.toString() ?? '가입하지 못했어요. 잠시 뒤 다시 해 주세요.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '가입하지 못했어요. ${friendlyError(e)}';
      });
    }
  }

  InputDecoration _decoration(String hint, IconData icon) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 15),
        filled: true,
        fillColor: Colors.white,
        prefixIcon: Icon(icon, color: const Color(0xFF94A3B8)),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        contentPadding: const EdgeInsets.symmetric(vertical: 16),
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 16),
        child: Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF334155))),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('학생 가입하기', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                child: const Text(
                  '학원에서 받은 인증코드와 학원에 등록된 내 이름을 입력해 주세요.\n가입을 신청하면 원장님이 확인한 뒤 로그인할 수 있어요.',
                  style: TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF475569)),
                ),
              ),
              _label('학원 인증코드'),
              TextField(
                controller: _authCodeController,
                textCapitalization: TextCapitalization.characters,
                autocorrect: false,
                decoration: _decoration('학원에서 알려 준 코드', Icons.vpn_key_rounded),
              ),
              _label('내 이름'),
              TextField(
                controller: _nameController,
                decoration: _decoration('학원에 등록된 이름', Icons.badge_outlined),
              ),
              _label('내 아이디'),
              TextField(
                controller: _idController,
                autocorrect: false,
                keyboardType: TextInputType.visiblePassword,
                decoration: _decoration('영어 소문자와 숫자 (예: minjun01)', Icons.person_outline_rounded),
              ),
              _label('비밀번호'),
              TextField(
                controller: _passwordController,
                obscureText: _obscure,
                decoration: _decoration('영어와 숫자를 함께, 8자 이상', Icons.lock_outline_rounded).copyWith(
                  suffixIcon: IconButton(
                    icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: const Color(0xFF94A3B8)),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
              _label('비밀번호 한 번 더'),
              TextField(
                controller: _password2Controller,
                obscureText: _obscure,
                onSubmitted: (_) => _submit(),
                decoration: _decoration('같은 비밀번호를 한 번 더', Icons.lock_outline_rounded),
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(fontSize: 14, color: Color(0xFFB91C1C), height: 1.4)),
                ),
              ],
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton(
                  onPressed: _busy ? null : _submit,
                  style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : const Text('가입 신청하기', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
