import { ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

/** 학생끼리는 대화방을 만들 수 없다 (서버에서 막는다) */
describe('학생끼리 채팅방 금지', () => {
  function setup(members: Array<{ id: number; role: string }>) {
    const svc: any = Object.create(ChatService.prototype);
    svc.userRepo = {
      findOne: jest.fn(async () => ({ id: members[0].id, role: members[0].role, email: 'a@test.com', academyId: 1 })),
      find: jest.fn(async () => members),
    };
    return svc as ChatService;
  }

  it('학생 둘이 있는 대화방은 만들 수 없다', async () => {
    const svc = setup([{ id: 1, role: 'STUDENT' }, { id: 2, role: 'STUDENT' }]);
    await expect(svc.createRoomByEmail(undefined, undefined, [2], 'a@test.com')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('학생이 둘 이상 섞인 단체방도 만들 수 없다', async () => {
    const svc = setup([{ id: 1, role: 'STUDENT' }, { id: 2, role: 'STUDENT' }, { id: 3, role: 'HOMEROOM_TEACHER' }]);
    await expect(svc.createRoomByEmail('반 방', 'GROUP', [2, 3], 'a@test.com')).rejects.toThrow('학생끼리');
  });
});
