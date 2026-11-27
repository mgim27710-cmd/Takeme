import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ParentService } from './parent.service';

/** 학부모가 자녀의 학생 계정 초대 코드를 발급한다 */
describe('학생 초대 코드 발급 (학부모)', () => {
  const parent = { id: 10, email: 'mom@test.com', role: 'PARENT' };
  const child = (id: number, extra: any = {}) => ({ id, name: `아이${id}`, adminDisplayName: null, studentUser: null, academy: { educationLevel: 'ELEMENTARY' }, ...extra });

  function setup(opts: { user?: any; children?: any[] } = {}) {
    const saved: any[] = [];
    const invites = {
      delete: jest.fn(async () => undefined),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => { saved.push(x); return x; }),
      findOne: jest.fn(async () => null),
    };
    const svc: any = Object.create(ParentService.prototype);
    svc.userRepository = { findOne: jest.fn(async () => ('user' in opts ? opts.user : parent)) };
    svc.studentRepository = { find: jest.fn(async () => opts.children ?? [child(3)]) };
    svc.studentInviteRepository = invites;
    return { svc: svc as ParentService, invites, saved };
  }

  it('보호자 동의가 없으면 발급하지 않는다', async () => {
    const { svc } = setup();
    await expect(svc.issueStudentInvite('mom@test.com', undefined, false)).rejects.toThrow('동의');
  });

  it('학부모가 아닌 계정(학생 등)은 발급할 수 없다', async () => {
    const { svc } = setup({ user: { ...parent, role: 'STUDENT' } });
    await expect(svc.issueStudentInvite('kid@test.com', undefined, true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('내 자녀가 아니면 발급하지 않는다', async () => {
    const { svc } = setup();
    await expect(svc.issueStudentInvite('mom@test.com', 999, true)).rejects.toThrow('내 자녀가 아닙니다');
  });

  it('자녀가 여럿이면 고르게 한다', async () => {
    const { svc } = setup({ children: [child(3), child(4)] });
    await expect(svc.issueStudentInvite('mom@test.com', undefined, true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('이미 학생 계정이 연결된 자녀는 발급하지 않는다', async () => {
    const { svc } = setup({ children: [child(3, { studentUser: { id: 77 } })] });
    await expect(svc.issueStudentInvite('mom@test.com', undefined, true)).rejects.toBeInstanceOf(ConflictException);
  });

  it('유치원·중고등 학원의 자녀는 발급하지 않는다 (초등 학원만)', async () => {
    for (const level of ['KINDERGARTEN', 'MIDDLE_HIGH']) {
      const { svc } = setup({ children: [child(3, { academy: { educationLevel: level } })] });
      await expect(svc.issueStudentInvite('mom@test.com', undefined, true)).rejects.toThrow('초등 학원에서만');
    }
  });

  it('정상 발급: 6자리 코드, 24시간 유효, 동의 시각 기록, 예전 코드는 지움', async () => {
    const { svc, invites, saved } = setup();
    const r = await svc.issueStudentInvite('mom@test.com', undefined, true);
    expect(r.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(r.studentId).toBe(3);
    expect(invites.delete).toHaveBeenCalledTimes(1);
    expect(saved[0].parentUserId).toBe(10);
    expect(saved[0].consentAt).toBeInstanceOf(Date);
    const hours = (new Date(saved[0].expiresAt).getTime() - saved[0].consentAt.getTime()) / 3600000;
    expect(Math.round(hours)).toBe(24);
  });
});
