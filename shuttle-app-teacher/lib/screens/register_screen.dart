import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  String _selectedRole = 'HOMEROOM_TEACHER';
  // 담당 학급: 기관 인증코드를 입력하면 서버에서 그 기관의 반 목록을 받아 온다 (코드에 고정된 반 이름 없음)
  String? _selectedClass;
  List<String> _classList = [];
  bool _classesLoading = false;
  String? _classesMessage; // 안내/오류 문구
  String _classesLoadedFor = '';
  Timer? _classesDebounce;
  final _authCodeController = TextEditingController();
  final _nameController = TextEditingController();
  final _parentNameController = TextEditingController();
  final _allergiesController = TextEditingController();
  final _emailController = TextEditingController();
  final _verifyCodeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordConfirmController = TextEditingController();

  bool _isEmailSent = false;
  bool _isEmailVerified = false;
  bool _isLoading = false;

  /// 인증코드가 바뀌면 잠시 뒤(입력이 멈춘 뒤) 그 기관의 반 목록을 불러온다
  void _onAuthCodeChanged(String _) {
    _classesDebounce?.cancel();
    _classesDebounce = Timer(const Duration(milliseconds: 600), _loadClasses);
  }

  Future<void> _loadClasses() async {
    final code = _authCodeController.text.trim();
    if (_selectedRole != 'HOMEROOM_TEACHER') return;
    if (code.isEmpty) {
      if (mounted) {
        setState(() {
          _classList = [];
          _selectedClass = null;
          _classesMessage = null;
          _classesLoadedFor = '';
        });
      }
      return;
    }
    if (code == _classesLoadedFor) return;
    setState(() {
      _classesLoading = true;
      _classesMessage = null;
    });
    final res = await ApiService().verifyAuthCode(code);
    if (!mounted) return;
    setState(() {
      _classesLoading = false;
      if (res['success'] == true) {
        _classesLoadedFor = code;
        _classList = List<String>.from(res['classes'] as List);
        if (!_classList.contains(_selectedClass)) _selectedClass = null;
        _classesMessage = _classList.isEmpty
            ? '이 기관에 등록된 반이 없습니다. 원장님께 원아 명단 등록을 요청해 주세요.'
            : null;
      } else {
        _classList = [];
        _selectedClass = null;
        _classesLoadedFor = '';
        _classesMessage = res['message']?.toString() ?? '반 목록을 불러오지 못했습니다.';
      }
    });
  }

  @override
  void dispose() {
    _classesDebounce?.cancel();
    _authCodeController.dispose();
    _nameController.dispose();
    _parentNameController.dispose();
    _allergiesController.dispose();
    _emailController.dispose();
    _verifyCodeController.dispose();
    _passwordController.dispose();
    _passwordConfirmController.dispose();
    super.dispose();
  }

  void _showMessage(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF10B981),
      ),
    );
  }

  bool _validatePassword(String pw) {
    final regex = RegExp(r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$');
    return regex.hasMatch(pw);
  }

  Future<void> _handleSendVerification() async {
    final email = _emailController.text.trim();
    if (!email.contains('@')) {
      _showMessage('유효한 이메일을 입력해주세요.');
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService().sendVerificationEmail(email);
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      setState(() => _isEmailSent = true);
      _showMessage('인증 코드가 이메일로 전송되었습니다. 메일함을 확인해주세요.', isError: false);
    } else {
      _showMessage(res['message'] ?? '인증 메일 전송 실패');
    }
  }

  Future<void> _handleVerifyCode() async {
    final email = _emailController.text.trim();
    final code = _verifyCodeController.text.trim();
    if (code.isEmpty) {
      _showMessage('인증코드를 입력해주세요.');
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService().verifyEmailCode(email, code);
    setState(() => _isLoading = false);

    if (res['success'] == true) {
      setState(() => _isEmailVerified = true);
      _showMessage('이메일 인증이 완료되었습니다.', isError: false);
    } else {
      _showMessage(res['message'] ?? '인증 코드가 올바르지 않습니다.');
    }
  }

  Future<void> _handleRegister() async {
    if (!_isEmailVerified) {
      _showMessage('먼저 이메일 인증을 완료해주세요.');
      return;
    }
    if (_authCodeController.text.trim().isEmpty) {
      _showMessage('기관 인증코드를 입력해주세요.');
      return;
    }
    if (_selectedRole == 'HOMEROOM_TEACHER' && _selectedClass == null) {
      _showMessage('담당 학급을 선택해주세요.');
      return;
    }
    if (_nameController.text.trim().isEmpty) {
      if (_selectedRole == 'HOMEROOM_TEACHER') {
        _showMessage('담임교사 성명을 입력해주세요.');
      } else if (_selectedRole == 'SHUTTLE_TEACHER') {
        _showMessage('지도교사 성명을 입력해주세요.');
      } else if (_selectedRole == 'PARENT') {
        _showMessage('원아 이름을 입력해주세요.');
      } else {
        _showMessage('기사님 성명을 입력해주세요.');
      }
      return;
    }
    if (_selectedRole == 'PARENT' && _parentNameController.text.trim().isEmpty) {
      _showMessage('학부모 본인 이름을 입력해주세요.');
      return;
    }
    final pw = _passwordController.text;
    if (!_validatePassword(pw)) {
      _showMessage('비밀번호는 영문, 숫자, 특수문자를 모두 포함하여 8자 이상이어야 합니다.');
      return;
    }
    if (pw != _passwordConfirmController.text) {
      _showMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setState(() => _isLoading = true);

    final payloadName = _selectedRole == 'PARENT' ? _parentNameController.text.trim() : _nameController.text.trim();
    final res = await ApiService().register(
      email: _emailController.text.trim(),
      password: pw,
      name: payloadName,
      targetName: _nameController.text.trim(),
      authCode: _authCodeController.text.trim(),
      role: _selectedRole,
      allergies: _selectedRole == 'PARENT' ? _allergiesController.text.trim() : null,
      assignedClass: _selectedRole == 'HOMEROOM_TEACHER' ? _selectedClass : null,
    );

    setState(() => _isLoading = false);

    if (res['success'] == true) {
      if (!mounted) return;
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Text('회원가입 완료', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Text(res['message'] ?? '회원가입이 정상적으로 완료되었습니다.'),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D9488)),
              child: const Text('로그인으로 이동', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    } else {
      _showMessage(res['message'] ?? '회원가입에 실패했습니다.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('회원가입', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1E293B))),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Color(0xFF64748B)),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFF1F5F9), height: 1),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Info Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          '기관 인증코드가 필요합니다',
                          style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF1E40AF), fontSize: 15),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '안전한 통학 관리를 위해 관리자님이 발급하신 기관 인증코드를 입력해야 가입이 진행됩니다.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF3B82F6), height: 1.4),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Role Selection
                  const Text('가입 역할 선택', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildRoleButton('HOMEROOM_TEACHER', '담임교사'),
                      const SizedBox(width: 8),
                      _buildRoleButton('SHUTTLE_TEACHER', '지도교사'),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Role Description Banner
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Text(
                      _selectedRole == 'HOMEROOM_TEACHER'
                          ? '유치원 교실 담임교사: 학급 알림장 사진/공지 등록 및 학부모 소통을 담당합니다.'
                          : (_selectedRole == 'SHUTTLE_TEACHER'
                              ? '통학차량 동승 지도교사: 셔틀버스 원아 탑승 명단 확인, 결석 처리 및 탑승 QR 체크를 담당합니다.'
                              : (_selectedRole == 'PARENT'
                                  ? '원아 학부모: 자녀 통학 실시간 위치 확인 및 출결 결석 신청을 이용할 수 있습니다.'
                                  : '셔틀 운전 기사님: 통학차량 안전 운행 및 실시간 내비게이션 경로 안내를 이용할 수 있습니다.')),
                      style: const TextStyle(fontSize: 11, color: Color(0xFF475569), height: 1.4),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Auth Code
                  const Text('기관 인증코드', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  _buildTextField(_authCodeController, '예: TAKEME123', onChanged: _onAuthCodeChanged),
                  const SizedBox(height: 16),

                  // Homeroom class selector if HOMEROOM_TEACHER
                  if (_selectedRole == 'HOMEROOM_TEACHER') ...[
                    const Text('담당 학급 선택', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      key: ValueKey('class_${_classList.join(',')}'),
                      initialValue: _selectedClass,
                      hint: Text(
                        _classesLoading
                            ? '반 목록을 불러오는 중...'
                            : (_authCodeController.text.trim().isEmpty ? '기관 인증코드를 먼저 입력하세요' : '반을 선택하세요'),
                        style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
                      ),
                      decoration: InputDecoration(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        filled: true,
                        fillColor: Colors.white,
                      ),
                      items: _classList.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                      onChanged: _classList.isEmpty ? null : (val) => setState(() => _selectedClass = val),
                    ),
                    if (_classesMessage != null) ...[
                      const SizedBox(height: 6),
                      Text(_classesMessage!, style: const TextStyle(fontSize: 12, color: Color(0xFFEF4444))),
                    ],
                    const SizedBox(height: 16),
                  ],

                  // Name Field
                  Text(
                    _selectedRole == 'HOMEROOM_TEACHER'
                        ? '담임교사 성명'
                        : (_selectedRole == 'SHUTTLE_TEACHER'
                            ? '지도교사 성명'
                            : (_selectedRole == 'PARENT' ? '원아 이름' : '기사님 성명')),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                  ),
                  const SizedBox(height: 6),
                  _buildTextField(
                    _nameController,
                    _selectedRole == 'HOMEROOM_TEACHER'
                        ? '유치원에 등록된 담임교사 성명 (예: 김선생)'
                        : (_selectedRole == 'SHUTTLE_TEACHER'
                            ? '유치원에 등록된 동승 지도교사 성명 (예: 박교사)'
                            : (_selectedRole == 'PARENT' ? '유치원에 등록된 원아 이름 (예: 홍길동)' : '유치원에 등록된 기사님 성명 (예: 박기사)')),
                  ),
                  const SizedBox(height: 16),

                  // Parent Name (if parent)
                  if (_selectedRole == 'PARENT') ...[
                    const Text('학부모 본인 이름', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    _buildTextField(_parentNameController, '학부모님의 성명을 입력해주세요 (예: 김철수)'),
                    const SizedBox(height: 16),

                    // Allergy Input
                    const Text('원아 알레르기 정보 (선택사항)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    _buildTextField(_allergiesController, '식품/약품 알레르기 (예: 땅콩, 복숭아, 유제품 등)'),
                    const SizedBox(height: 16),
                  ],

                  // Email Input with Verification
                  const Text('로그인 이메일', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: _buildTextField(
                          _emailController,
                          'example@email.com',
                          enabled: !_isEmailVerified,
                          keyboardType: TextInputType.emailAddress,
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isEmailVerified || _isLoading ? null : _handleSendVerification,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0D9488),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: Text(
                          _isEmailSent ? '재전송' : '인증요청',
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Verification Code
                  if (_isEmailSent && !_isEmailVerified) ...[
                    const Text('이메일 인증코드', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _buildTextField(_verifyCodeController, '인증코드 6자리 입력', keyboardType: TextInputType.number),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleVerifyCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: const Text('인증확인', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  if (_isEmailVerified)
                    Container(
                      padding: const EdgeInsets.all(10),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, size: 16, color: Color(0xFF10B981)),
                          SizedBox(width: 6),
                          Text('이메일 인증이 완료되었습니다.', style: TextStyle(color: Color(0xFF065F46), fontSize: 12, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),

                  // Password
                  const Text('비밀번호', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  _buildTextField(_passwordController, '영문, 숫자, 특수문자 포함 8자 이상', obscureText: true),
                  const SizedBox(height: 16),

                  // Password Confirm
                  const Text('비밀번호 확인', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 6),
                  _buildTextField(_passwordConfirmController, '비밀번호를 한 번 더 입력하세요', obscureText: true),
                  const SizedBox(height: 28),

                  // Register Button
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handleRegister,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D9488),
                      disabledBackgroundColor: const Color(0xFF93C5FD),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                          )
                        : const Text('회원가입 완료', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleButton(String role, String label) {
    final isSelected = _selectedRole == role;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() => _selectedRole = role);
          if (role == 'HOMEROOM_TEACHER') _loadClasses();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0D9488) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isSelected ? const Color(0xFF0D9488) : const Color(0xFFE2E8F0)),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isSelected ? Colors.white : const Color(0xFF64748B),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String hint, {
    bool obscureText = false,
    bool enabled = true,
    TextInputType? keyboardType,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      obscureText: obscureText,
      enabled: enabled,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        filled: true,
        fillColor: enabled ? Colors.white : const Color(0xFFF1F5F9),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.5),
        ),
      ),
    );
  }
}
