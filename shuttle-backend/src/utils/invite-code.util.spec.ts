import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  inviteExpiresAt,
  inviteProblem,
  normalizeInviteCode,
} from './invite-code.util';

describe('학생 초대 코드', () => {
  it('6자리이고 헷갈리는 글자(0, O, 1, I)가 없다', () => {
    for (let i = 0; i < 300; i++) {
      const c = generateInviteCode();
      expect(c).toHaveLength(INVITE_CODE_LENGTH);
      expect(c.split('').every(ch => INVITE_ALPHABET.includes(ch))).toBe(true);
      expect(/[01OI]/.test(c)).toBe(false);
    }
  });

  it('여러 번 만들면 서로 다른 코드가 나온다', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
    expect(set.size).toBeGreaterThan(190);
  });

  it('입력한 코드의 공백·하이픈을 지우고 대문자로 바꾼다', () => {
    expect(normalizeInviteCode(' ab-c 2d3 ')).toBe('ABC2D3');
    expect(normalizeInviteCode(undefined)).toBe('');
  });

  it('코드가 없으면 찾을 수 없다고 알린다', () => {
    expect(inviteProblem(null)).toContain('찾을 수 없');
  });

  it('쓴 코드는 다시 쓸 수 없다', () => {
    const now = new Date('2026-11-27T01:00:00Z');
    expect(inviteProblem({ usedAt: now, expiresAt: inviteExpiresAt(now) }, now)).toContain('이미 사용');
  });

  it('24시간이 지나면 쓸 수 없다', () => {
    const issued = new Date('2026-11-27T01:00:00Z');
    const exp = inviteExpiresAt(issued);
    expect(exp.getTime() - issued.getTime()).toBe(24 * 3600 * 1000);
    expect(inviteProblem({ usedAt: null, expiresAt: exp }, new Date(issued.getTime() + 23 * 3600 * 1000))).toBeNull();
    expect(inviteProblem({ usedAt: null, expiresAt: exp }, new Date(issued.getTime() + 25 * 3600 * 1000))).toContain('기간');
  });
});
