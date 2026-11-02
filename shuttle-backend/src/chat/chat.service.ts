import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom, ChatRoomType } from '../entities/chat-room.entity';
import { ChatRoomMember } from '../entities/chat-room-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { User, UserRole } from '../entities/user.entity';
import { Student } from '../entities/student.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Academy } from '../entities/academy.entity';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom) private roomRepo: Repository<ChatRoom>,
    @InjectRepository(ChatRoomMember) private memberRepo: Repository<ChatRoomMember>,
    @InjectRepository(ChatMessage) private messageRepo: Repository<ChatMessage>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Academy) private academyRepo: Repository<Academy>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async getAcademyUsers(academyId?: number, currentUserEmail?: string) {
    let currentUser: User | null = null;
    if (currentUserEmail) {
      currentUser = await this.userRepo.findOne({ where: { email: currentUserEmail } });
    }

    // 1. 차량 정보 조회 (기사 및 동승교사 매핑)
    const vehicleWhere = academyId ? { academy: { id: academyId } } : {};
    const vehicles = await this.vehicleRepo.find({
      where: vehicleWhere,
      relations: { driverUser: true, teacherUser: true },
    });

    const driverVehicleMap = new Map<number, string>();
    const teacherVehicleMap = new Map<number, string>();
    const vehicleUserIds = new Set<number>();

    for (const v of vehicles) {
      if (v.driverUser) {
        driverVehicleMap.set(v.driverUser.id, v.busNumber ? `${v.busNumber} 기사` : '셔틀 기사');
        vehicleUserIds.add(v.driverUser.id);
      }
      if (v.teacherUser) {
        teacherVehicleMap.set(v.teacherUser.id, v.busNumber ? `${v.busNumber} 동승교사` : '동승교사');
        vehicleUserIds.add(v.teacherUser.id);
      }
    }

    // 2. 원생 정보 조회 (학부모 매핑)
    const studentWhere = academyId ? { academy: { id: academyId } } : {};
    const students = await this.studentRepo.find({
      where: studentWhere,
      relations: { parentUser: true, studentUser: true },
    });

    const parentChildMap = new Map<number, string>();
    const parentUserIds = new Set<number>();
    for (const s of students) {
      if (s.parentUser) {
        const existing = parentChildMap.get(s.parentUser.id);
        const childName = s.name || '원아';
        parentChildMap.set(s.parentUser.id, existing ? `${existing}, ${childName}` : `${childName} 학부모`);
        parentUserIds.add(s.parentUser.id);
      }
    }

    // 3. 사용자 목록 조회
    const userQuery = this.userRepo.createQueryBuilder('u');
    if (academyId) {
      const vIds = vehicleUserIds.size > 0 ? Array.from(vehicleUserIds) : [0];
      const pIds = parentUserIds.size > 0 ? Array.from(parentUserIds) : [0];
      userQuery.where(
        '(u.academyId = :academyId OR u.id IN (:...vIds) OR u.id IN (:...pIds) OR u.role = :superRole)',
        { academyId, vIds, pIds, superRole: UserRole.SUPER_ADMIN }
      );
    }
    const allUsers = await userQuery.getMany();

    const drivers: any[] = [];
    const teachers: any[] = [];
    const parents: any[] = [];
    const admins: any[] = [];

    for (const u of allUsers) {
      if (currentUser && u.id === currentUser.id) continue;

      if (u.role === UserRole.DRIVER) {
        const sub = driverVehicleMap.get(u.id) || '셔틀 기사';
        drivers.push({
          id: u.id,
          name: u.name || '기사님',
          role: u.role,
          email: u.email,
          subText: sub,
        });
      } else if (
        u.role === UserRole.TEACHER ||
        u.role === UserRole.HOMEROOM_TEACHER ||
        u.role === UserRole.SHUTTLE_TEACHER
      ) {
        let sub = u.assignedClass ? `${u.assignedClass} 담임` : teacherVehicleMap.get(u.id) || '유치원 교사';
        teachers.push({
          id: u.id,
          name: u.name || '선생님',
          role: u.role,
          email: u.email,
          subText: sub,
        });
      } else if (u.role === UserRole.PARENT) {
        const sub = parentChildMap.get(u.id) || '학부모';
        parents.push({
          id: u.id,
          name: u.name || '학부모님',
          role: u.role,
          email: u.email,
          subText: sub,
        });
      } else if (u.role === UserRole.ACADEMY_ADMIN || u.role === UserRole.SUPER_ADMIN) {
        admins.push({
          id: u.id,
          name: u.name || '원장선생님',
          role: u.role,
          email: u.email,
          subText: u.role === UserRole.SUPER_ADMIN ? '통합 관리자' : '원장',
        });
      }
    }

    const sortFn = (a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko');
    drivers.sort(sortFn);
    teachers.sort(sortFn);
    parents.sort(sortFn);
    admins.sort(sortFn);

    return { drivers, teachers, parents, admins };
  }

  async getRoomsByEmail(email: string) {
    if (!email) return [];
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return [];
    const userId = user.id;

    const query = this.roomRepo.createQueryBuilder('room')
      .innerJoin('room.members', 'myMember', 'myMember.userId = :userId', { userId })
      .leftJoinAndSelect('room.members', 'allMembers')
      .leftJoinAndSelect('allMembers.user', 'memberUser');

    const rooms = await query.getMany();

    for (const room of rooms) {
      const latestMessage = await this.messageRepo.findOne({
        where: { room: { id: room.id } },
        order: { createdAt: 'DESC' },
        relations: { sender: true },
      });
      (room as any).latestMessage = latestMessage || null;

      // 안 읽은 메시지 수 계산
      const allMsgs = await this.messageRepo.find({
        where: { room: { id: room.id } },
        relations: { sender: true },
      });
      let unread = 0;
      for (const m of allMsgs) {
        if (m.sender && m.sender.id !== userId) {
          const reads = (m.readBy || []).map(Number);
          if (!reads.includes(userId)) {
            unread++;
          }
        }
      }
      (room as any).unreadCount = unread;
    }

    // 최신 메시지 또는 갱신 시간 기준 정렬
    rooms.sort((a: any, b: any) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    return rooms;
  }

  async getMessages(roomId: number, currentUserId?: number) {
    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      order: { createdAt: 'ASC' },
      relations: { sender: true },
    });

    if (currentUserId) {
      for (const m of messages) {
        if (m.sender && m.sender.id !== currentUserId) {
          const readByList = (m.readBy || []).map(Number);
          if (!readByList.includes(currentUserId)) {
            readByList.push(currentUserId);
            m.readBy = readByList;
            await this.messageRepo.save(m);
          }
        }
      }
    }

    return messages;
  }

  async createRoomByEmail(name: string | undefined, type: string | undefined, userIds: number[], creatorEmail: string) {
    userIds = userIds || [];
    const creator = await this.userRepo.findOne({ where: { email: creatorEmail } });
    if (!creator) throw new BadRequestException('생성자 계정을 찾을 수 없습니다.');

    if (!userIds.includes(creator.id)) {
      userIds.push(creator.id);
    }

    const isDirect = userIds.length === 2;
    const roomType = isDirect ? 'DIRECT' : (type || 'GROUP');

    // 1:1 대화인 경우 동일 2명으로 구성된 기존 방이 있는지 확인
    if (isDirect) {
      const u1 = userIds[0];
      const u2 = userIds[1];
      const existingRooms = await this.roomRepo.createQueryBuilder('room')
        .innerJoin('room.members', 'm1', 'm1.userId = :u1', { u1 })
        .innerJoin('room.members', 'm2', 'm2.userId = :u2', { u2 })
        .leftJoinAndSelect('room.members', 'allMembers')
        .leftJoinAndSelect('allMembers.user', 'user')
        .getMany();

      for (const r of existingRooms) {
        if (r.members && r.members.length === 2) {
          return r;
        }
      }
    }

    const targetUsers = await this.userRepo.find({ where: { id: In(userIds) } });
    let roomName = name?.trim();
    if (!roomName) {
      const otherNames = targetUsers.filter(u => u.id !== creator.id).map(u => u.name || u.email);
      if (isDirect) {
        roomName = otherNames[0] || '1:1 대화';
      } else {
        const preview = otherNames.slice(0, 3).join(', ');
        roomName = `${preview}${otherNames.length > 3 ? ' 외' : ''} (${targetUsers.length}명)`;
      }
    }

    const room = this.roomRepo.create({
      name: roomName,
      type: roomType as any,
    });
    const savedRoom = await this.roomRepo.save(room);

    const members = userIds.map(uid => this.memberRepo.create({
      room: savedRoom,
      user: { id: uid },
    }));
    await this.memberRepo.save(members);

    this.chatGateway?.server?.emit('roomUpdated', { roomId: savedRoom.id });

    return this.roomRepo.findOne({
      where: { id: savedRoom.id },
      relations: { members: { user: true } },
    });
  }

  async sendMessageAndBroadcast(roomId: number, senderEmail: string, text: string) {
    const user = await this.userRepo.findOne({ where: { email: senderEmail } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const message = this.messageRepo.create({
      room: { id: roomId },
      sender: user,
      text: text.trim(),
      readBy: [user.id],
    });
    const saved = await this.messageRepo.save(message);

    await this.roomRepo.update(roomId, { updatedAt: new Date() });

    const fullMessage = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });

    if (fullMessage) {
      this.chatGateway.broadcastMessageToRoom(roomId, fullMessage);
    }

    return fullMessage;
  }
}
