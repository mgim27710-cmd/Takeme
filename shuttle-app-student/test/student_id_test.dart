import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_parent/utils/student_id.dart';

void main() {
  group('학생 아이디 ↔ 이메일', () {
    test('아이디에는 서버용 주소가 붙는다', () {
      expect(studentEmailFromId('Minjun01'), 'minjun01@student.takeme');
    });
    test('이미 이메일이면 그대로 쓴다 (예전 학생 계정)', () {
      expect(studentEmailFromId(' Kid@Test.com '), 'kid@test.com');
    });
    test('빈 입력은 빈 문자열', () {
      expect(studentEmailFromId('  '), '');
    });
    test('화면에는 주소를 뗀 아이디를 보여 준다', () {
      expect(studentIdFromEmail('minjun01@student.takeme'), 'minjun01');
      expect(studentIdFromEmail('kid@test.com'), 'kid@test.com');
    });
  });

  group('입력 검사', () {
    test('아이디: 영어 소문자·숫자·_ 3~20자', () {
      expect(validateStudentId('minjun_01'), isNull);
      expect(validateStudentId('MinJun'), isNull); // 대문자는 소문자로 바꿔 쓴다
      expect(validateStudentId('ab'), isNotNull);
      expect(validateStudentId('민준'), isNotNull);
      expect(validateStudentId('has space'), isNotNull);
      expect(validateStudentId(''), isNotNull);
    });
    test('비밀번호: 영문+숫자 8자 이상', () {
      expect(validateStudentPassword('abcd1234'), isNull);
      expect(validateStudentPassword('abcdefgh'), isNotNull);
      expect(validateStudentPassword('12345678'), isNotNull);
      expect(validateStudentPassword('abc123'), isNotNull);
      expect(validateStudentPassword(''), isNotNull);
    });
    test('초대 코드: 6자리, 헷갈리는 글자 없음, 입력은 정리해서 검사', () {
      expect(validateInviteCode('abc-234'), isNull);
      expect(validateInviteCode(' ABC 234 '), isNull);
      expect(validateInviteCode('ABC23'), isNotNull);
      expect(validateInviteCode('ABC230'), isNotNull); // 0 은 쓰지 않는다
      expect(validateInviteCode(''), isNotNull);
      expect(normalizeInviteCode('ab-c 2d3'), 'ABC2D3');
    });
  });
}
