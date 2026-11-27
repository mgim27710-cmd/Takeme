import { loginLevelProblem, normalizeClientLevel } from './education-level.util';

describe('앱 교육 단계 로그인 제한', () => {
  it('앱이 보낸 단계를 정리한다', () => {
    expect(normalizeClientLevel(' elementary ')).toBe('ELEMENTARY');
    expect(normalizeClientLevel('middle_high')).toBe('MIDDLE_HIGH');
    expect(normalizeClientLevel('')).toBeNull();
    expect(normalizeClientLevel(undefined)).toBeNull();
    expect(normalizeClientLevel('아무거나')).toBeNull();
  });

  it('단계가 같으면 로그인할 수 있다', () => {
    expect(loginLevelProblem('ELEMENTARY', 'ELEMENTARY', 'PARENT')).toBeNull();
    expect(loginLevelProblem('MIDDLE_HIGH', 'MIDDLE_HIGH', 'HOMEROOM_TEACHER')).toBeNull();
  });

  it('초등 앱에 유치원·중고등 학원 계정은 들어올 수 없다', () => {
    expect(loginLevelProblem('ELEMENTARY', 'KINDERGARTEN', 'PARENT')).toContain('초등 전용');
    expect(loginLevelProblem('ELEMENTARY', 'MIDDLE_HIGH', 'DRIVER')).toContain('중·고등');
  });

  it('학원 정보가 없으면 유치원으로 본다', () => {
    expect(loginLevelProblem('ELEMENTARY', null, 'PARENT')).not.toBeNull();
    expect(loginLevelProblem('KINDERGARTEN', undefined, 'PARENT')).toBeNull();
  });

  it('앱이 단계를 보내지 않으면(예전 앱) 제한하지 않는다', () => {
    expect(loginLevelProblem(null, 'ELEMENTARY', 'PARENT')).toBeNull();
  });

  it('웹 관리자는 제한하지 않는다', () => {
    expect(loginLevelProblem('ELEMENTARY', 'KINDERGARTEN', 'ACADEMY_ADMIN')).toBeNull();
    expect(loginLevelProblem('MIDDLE_HIGH', 'ELEMENTARY', 'SUPER_ADMIN')).toBeNull();
  });
});
