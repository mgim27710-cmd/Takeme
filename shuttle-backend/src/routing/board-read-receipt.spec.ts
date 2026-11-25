import { ForbiddenException } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { UserRole } from '../entities/user.entity';

/** 읽음 확인: 학부모가 열면 기록, 명단은 교직원만 볼 수 있다 */
describe('게시물 읽음 확인', () => {
  const mom = { id: 11, name: '김엄마' };
  const dad = { id: 12, name: '이아빠' };
  const other = { id: 13, name: '박학부모' };
  const students = [
    { id: 1, name: '민준', adminDisplayName: null, raw: { 반명: '햇살반' }, parentUser: mom },
    { id: 2, name: '서연', adminDisplayName: null, raw: { 반명: '햇살반' }, parentUser: dad },
    { id: 3, name: '지호', adminDisplayName: null, raw: { 반명: '열매반' }, parentUser: other },
    { id: 4, name: '고아', adminDisplayName: null, raw: { 반명: '햇살반' }, parentUser: null },
  ];

  function setup(post: any, reads: any[] = []) {
    const saved: any[] = [];
    const readRepo = {
      findOne: jest.fn(async ({ where }: any) => reads.find(r => r.postId === where.postId && r.userId === where.userId) ?? null),
      find: jest.fn(async () => reads),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => { saved.push(x); reads.push({ ...x, readAt: new Date('2026-11-25T01:00:00Z') }); return x; }),
    };
    const studentRepo = { find: jest.fn(async () => students) };
    const svc: any = Object.create(RoutingService.prototype);
    svc.boardPostReadRepository = readRepo;
    svc.studentRepository = studentRepo;
    svc.getBoardPostById = jest.fn(async () => post);
    return { svc: svc as RoutingService, readRepo, saved };
  }

  const classPost = { id: 100, visibility: 'CLASS', targetClass: '햇살반', academy: { id: 1 } };
  const allPost = { id: 101, visibility: 'ALL', academy: { id: 1 } };

  it('학부모가 열면 읽음으로 한 번만 남긴다', async () => {
    const { svc, saved } = setup(classPost);
    const viewer = { sub: 11, role: UserRole.PARENT };
    expect(await svc.markBoardPostRead(100, viewer)).toEqual({ read: true });
    await svc.markBoardPostRead(100, viewer); // 두 번 열어도
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ postId: 100, userId: 11 });
  });

  it('교직원이 열어 본 것은 기록하지 않는다', async () => {
    const { svc, saved } = setup(classPost);
    expect(await svc.markBoardPostRead(100, { sub: 5, role: 'HOMEROOM_TEACHER' })).toEqual({ read: false });
    expect(saved).toHaveLength(0);
  });

  it('학부모는 읽음 명단을 볼 수 없다', async () => {
    const { svc } = setup(classPost);
    await expect(svc.getBoardPostReaders(100, { sub: 11, role: UserRole.PARENT })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('반 글의 명단은 그 반 학부모만 대상이고, 읽은 사람과 안 읽은 사람이 나뉜다', async () => {
    const { svc } = setup(classPost, [{ postId: 100, userId: 11, readAt: new Date('2026-11-25T01:00:00Z') }]);
    const r = await svc.getBoardPostReaders(100, { sub: 5, role: 'HOMEROOM_TEACHER' });
    expect(r.total).toBe(2); // 햇살반 학부모 2명 (열매반 박학부모, 부모 없는 원아 제외)
    expect(r.readCount).toBe(1);
    expect(r.readers.map((x: any) => x.name)).toEqual(['김엄마']);
    expect(r.readers[0].childNames).toEqual(['민준']);
    expect(r.unread.map((x: any) => x.name)).toEqual(['이아빠']);
  });

  it('전체 공개 글의 명단은 기관의 모든 학부모가 대상이다', async () => {
    const { svc } = setup(allPost);
    const r = await svc.getBoardPostReaders(101, { sub: 5, role: 'ACADEMY_ADMIN' });
    expect(r.total).toBe(3);
    expect(r.readCount).toBe(0);
  });
});
