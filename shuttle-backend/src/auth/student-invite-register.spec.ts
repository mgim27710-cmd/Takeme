import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../entities/user.entity';

/** 학생 가입은 학부모가 발급한 초대 코드로만 된다 */
describe('학생 가입 (초대 코드)', () => {
  const future = new Date(Date.now() + 3600 * 1000);
  const academy = { id: 7, name: '새싹유치원' };
  const baseInvite = () => ({ id: 1, studentId: 3, code: 'ABC234', expiresAt: future, usedAt: null as Date | null, usedByUserId: null as number | null });
  const baseStudent = () => ({ id: 3, name: '김민준', adminDisplayName: null, academy, studentUser: null as any });

  function setup(opts: { invite?: any; student?: any; emailTaken?: boolean; academyByCode?: any } = {}) {
    const invite = 'invite' in opts ? opts.invite : baseInvite();
    const student = 'student' in opts ? opts.student : baseStudent();
    const users = {
      findOne: jest.fn(async () => (opts.emailTaken ? { id: 99 } : null)),
      create: jest.fn((x: any) => ({ ...x })),
      save: jest.fn(async (x: any) => ({ id: 50, ...x })),
      remove: jest.fn(async () => undefined),
    };
    const invites = { findOne: jest.fn(async () => invite), save: jest.fn(async (x: any) => x) };
    const students = { findOne: jest.fn(async () => student), save: jest.fn(async (x: any) => x) };
    const svc: any = Object.create(AuthService.prototype);
    svc.usersRepository = users;
    svc.studentInviteRepository = invites;
    svc.studentRepository = students;
    svc.academyRepository = { findOne: jest.fn(async () => opts.academyByCode ?? null) };
    return { svc: svc as AuthService, users, invites, students, invite, student };
  }
  const data = (extra: any = {}) => ({ email: 'kid1@student.takeme', password: 'abcd1234', role: UserRole.STUDENT, inviteCode: 'abc234', ...extra });

  it('초등 학원은 초대 코드 없이 이름만으로 가입할 수 없다', async () => {
    const { svc, users } = setup({ academyByCode: { id: 7, name: '푸른초등학원', educationLevel: 'ELEMENTARY' } });
    await expect(svc.register(data({ inviteCode: '', authCode: 'ELEM01', targetName: '김민준' }))).rejects.toThrow('초대 코드로 가입');
    expect(users.save).not.toHaveBeenCalled();
  });

  it('학원 인증코드가 틀리면 (초대 코드가 없는 가입은) 거절한다', async () => {
    const { svc } = setup();
    await expect(svc.register(data({ inviteCode: '', authCode: 'WRONG1', targetName: '김민준' }))).rejects.toThrow('유효하지 않은');
  });

  it('없는 코드는 거절한다', async () => {
    const { svc } = setup({ invite: null });
    await expect(svc.register(data())).rejects.toThrow('찾을 수 없');
  });

  it('기간이 지난 코드는 거절한다', async () => {
    const { svc } = setup({ invite: { ...baseInvite(), expiresAt: new Date(Date.now() - 1000) } });
    await expect(svc.register(data())).rejects.toThrow('기간');
  });

  it('이미 쓴 코드는 거절한다', async () => {
    const { svc } = setup({ invite: { ...baseInvite(), usedAt: new Date() } });
    await expect(svc.register(data())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('이미 학생 계정이 연결된 원아는 거절한다', async () => {
    const { svc, users } = setup({ student: { ...baseStudent(), studentUser: { id: 5 } } });
    await expect(svc.register(data())).rejects.toThrow('이미 학생 계정');
    expect(users.save).not.toHaveBeenCalled();
  });

  it('정상 가입: 코드가 가리키는 원아와 연결되고 코드는 사용 처리된다', async () => {
    const { svc, invite, student, users } = setup();
    const res: any = await svc.register(data());
    expect(res.success).toBe(true);
    // 학생 계정의 이름과 소속은 입력이 아니라 원아 정보에서 온다
    const created = users.create.mock.calls[0][0] as any;
    expect(created.role).toBe(UserRole.STUDENT);
    const saved = users.save.mock.calls[0][0] as any;
    expect(saved.name).toBe('김민준');
    expect(saved.academyId).toBe(7);
    expect(student.studentUser).toMatchObject({ id: 50 });
    expect(invite.usedAt).toBeInstanceOf(Date);
    expect(invite.usedByUserId).toBe(50);
  });
});
