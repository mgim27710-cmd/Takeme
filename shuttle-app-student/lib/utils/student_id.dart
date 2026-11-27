/// 학생 앱 로그인 아이디 규칙.
/// 초등 저학년은 이메일이 없으므로, 학생은 '아이디'만 정하고 서버에는 아이디 뒤에 아래 주소를 붙여 보낸다.
const String kStudentIdDomain = '@student.takeme';

/// 학부모 앱의 초대 코드와 같은 글자만 쓴다 (헷갈리는 0, O, 1, I 제외)
const String kInviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const int kInviteCodeLength = 6;

final RegExp _idPattern = RegExp(r'^[a-z0-9_]{3,20}$');

/// 학생이 입력한 아이디(또는 이메일)를 서버에 보낼 이메일 형태로 바꾼다.
/// '@' 가 들어 있으면 이미 이메일이라고 보고 그대로 쓴다. (예전에 이메일로 가입한 학생 계정)
String studentEmailFromId(String raw) {
  final t = raw.trim().toLowerCase();
  if (t.isEmpty) return '';
  return t.contains('@') ? t : '$t$kStudentIdDomain';
}

/// 서버의 이메일에서 화면에 보여 줄 아이디를 뽑는다.
String studentIdFromEmail(String email) =>
    email.endsWith(kStudentIdDomain) ? email.substring(0, email.length - kStudentIdDomain.length) : email;

/// 아이디가 올바르지 않으면 사용자에게 보여 줄 안내 문구, 올바르면 null
String? validateStudentId(String raw) {
  final t = raw.trim().toLowerCase();
  if (t.isEmpty) return '아이디를 입력해 주세요.';
  if (!_idPattern.hasMatch(t)) return '아이디는 영어 소문자, 숫자, _ 로 3~20자로 만들어 주세요.';
  return null;
}

/// 비밀번호 규칙 (서버와 같음: 영문과 숫자를 함께 쓰고 8자 이상, 공백 없음)
String? validateStudentPassword(String pw) {
  if (pw.isEmpty) return '비밀번호를 입력해 주세요.';
  final ok = RegExp(r'^(?=.*[A-Za-z])(?=.*\d)\S{8,}$').hasMatch(pw);
  return ok ? null : '비밀번호는 영어와 숫자를 함께 써서 8자 이상으로 만들어 주세요.';
}

/// 초대 코드를 정리한다 (공백·하이픈 제거, 대문자)
String normalizeInviteCode(String raw) => raw.replaceAll(RegExp(r'[\s-]'), '').toUpperCase();

/// 초대 코드가 올바른 모양이 아니면 안내 문구, 맞으면 null
String? validateInviteCode(String raw) {
  final c = normalizeInviteCode(raw);
  if (c.isEmpty) return '학부모님께 받은 초대 코드를 입력해 주세요.';
  if (c.length != kInviteCodeLength || c.split('').any((ch) => !kInviteAlphabet.contains(ch))) {
    return '초대 코드는 영어와 숫자 6자리예요. 다시 확인해 주세요.';
  }
  return null;
}
