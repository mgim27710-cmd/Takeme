import { Injectable, BadRequestException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom, ChatRoomType } from '../entities/chat-room.entity';
import { ChatRoomMember } from '../entities/chat-room-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { User, UserRole } from '../entities/user.entity';
import { Student } from '../entities/student.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Academy } from '../entities/academy.entity';
import { Notification } from '../entities/notification.entity';
import { ChatGateway } from './chat.gateway';
import { getStudentClassName, isSameClass } from '../utils/school.util';

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
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * 대화방 참여 여부 확인
   */
  async isUserRoomMember(roomId: number, userId: number): Promise<boolean> {
    const member = await this.memberRepo.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    return !!member;
  }

  /**
   * 대화 상대 규칙에 따른 사용자 목록 조회
   * - 학부모: 내 아이 반 담임, 내 아이 차량 지도교사, 기관 관리자 (학부모끼리는 불가)
   * - 담임교사: 담당 원아 학부모, 같은 기관 교직원, 기관 관리자
   * - 지도교사/기사: 담당 차량 원아 학부모, 같은 기관 교직원, 기관 관리자
   * - 기관 관리자: 같은 기관 전체 교직원 및 학부모
   * (전화번호 등 개인정보는 목록에 노출하지 않음)
   */
  async getAcademyUsers(currentUserId: number, targetAcademyId?: number) {
    const currentUser = await this.userRepo.findOne({
      where: { id: currentUserId },
      relations: { academy: true },
    });
    if (!currentUser) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const academyId = currentUser.academy?.id || targetAcademyId || currentUser.academyId;
    if (!academyId) {
      return { drivers: [], teachers: [], parents: [], admins: [] };
    }

    // 1. 차량 정보 (기사 및 지도교사)
    const vehicles = await this.vehicleRepo.find({
      where: { academy: { id: academyId } },
      relations: { driverUser: true, teacherUser: true },
    });

    const driverVehicleMap = new Map<number, string>();
    const teacherVehicleMap = new Map<number, string>();
    for (const v of vehicles) {
      if (v.driverUser) {
        driverVehicleMap.set(v.driverUser.id, v.busNumber ? `${v.busNumber} 기사` : '셔틀 기사');
      }
      if (v.teacherUser) {
        teacherVehicleMap.set(v.teacherUser.id, v.busNumber ? `${v.busNumber} 지도교사` : '지도교사');
      }
    }

    // 2. 원아 정보 (학부모 매핑)
    const students = await this.studentRepo.find({
      where: { academy: { id: academyId } },
      relations: { parentUser: true, assignedVehicle: true },
    });

    // 3. 같은 기관 교직원 및 관리자 목록
    const allUsers = await this.userRepo.find({
      where: { academy: { id: academyId } },
    });

    const homeroomTeachers = allUsers.filter(u => u.role === UserRole.HOMEROOM_TEACHER);
    const escortTeachers = allUsers.filter(u => u.role === UserRole.TEACHER || u.role === UserRole.SHUTTLE_TEACHER);
    const drivers = allUsers.filter(u => u.role === UserRole.DRIVER);
    const admins = allUsers.filter(u => u.role === UserRole.ACADEMY_ADMIN || u.role === UserRole.SUPER_ADMIN);

    const resultTeachers: any[] = [];
    const resultParents: any[] = [];
    const resultDrivers: any[] = [];
    const resultAdmins: any[] = [];

    if (currentUser.role === UserRole.PARENT) {
      // 학부모 ↔ 내 아이 반 담임, 내 아이 차량 지도교사, 기관 관리자 (학부모끼리는 대화 불가)
      const myStudents = students.filter(s => s.parentUser?.id === currentUser.id);

      // 1) 내 아이 반 담임
      for (const st of myStudents) {
        const cName = getStudentClassName(st);
        if (cName) {
          const ht = homeroomTeachers.find(t => isSameClass(t.assignedClass, cName));
          if (ht && !resultTeachers.some(t => t.id === ht.id)) {
            resultTeachers.push({
              id: ht.id,
              name: ht.name || '담임선생님',
              role: ht.role,
              subText: `${cName} 담임교사`,
            });
          }
        }
      }

      // 2) 내 아이 차량 지도교사 및 기사
      for (const st of myStudents) {
        if (st.assignedVehicle) {
          const v = vehicles.find(veh => veh.id === st.assignedVehicle.id);
          if (v?.teacherUser && !resultTeachers.some(t => t.id === v.teacherUser.id)) {
            resultTeachers.push({
              id: v.teacherUser.id,
              name: v.teacherUser.name || '지도교사',
              role: v.teacherUser.role,
              subText: teacherVehicleMap.get(v.teacherUser.id) || '지도교사',
            });
          }
          if (v?.driverUser && !resultDrivers.some(d => d.id === v.driverUser.id)) {
            resultDrivers.push({
              id: v.driverUser.id,
              name: v.driverUser.name || '기사님',
              role: v.driverUser.role,
              subText: driverVehicleMap.get(v.driverUser.id) || '셔틀 기사',
            });
          }
        }
      }

      // 3) 기관 관리자
      for (const adm of admins) {
        resultAdmins.push({
          id: adm.id,
          name: adm.name || '기관 관리자',
          role: adm.role,
          subText: '기관 관리자',
        });
      }

      // 학부모끼리는 대화 불가 -> resultParents 는 빈 배열

    } else if (currentUser.role === UserRole.HOMEROOM_TEACHER) {
      // 담임교사 ↔ 담당 반 원아 학부모, 같은 기관 교직원, 기관 관리자
      const myClass = currentUser.assignedClass || '';
      const myClassStudents = students.filter(s => isSameClass(getStudentClassName(s), myClass));

      for (const st of myClassStudents) {
        if (st.parentUser && st.parentUser.id !== currentUser.id && !resultParents.some(p => p.id === st.parentUser.id)) {
          resultParents.push({
            id: st.parentUser.id,
            name: st.parentUser.name || `${st.name} 학부모`,
            role: st.parentUser.role,
            subText: `${st.name} 원아 학부모 (${myClass})`,
          });
        }
      }

      for (const t of [...homeroomTeachers, ...escortTeachers]) {
        if (t.id === currentUser.id) continue;
        resultTeachers.push({
          id: t.id,
          name: t.name || '선생님',
          role: t.role,
          subText: t.assignedClass ? `${t.assignedClass} 담임` : (teacherVehicleMap.get(t.id) || '지도교사'),
        });
      }

      for (const d of drivers) {
        resultDrivers.push({
          id: d.id,
          name: d.name || '기사님',
          role: d.role,
          subText: driverVehicleMap.get(d.id) || '셔틀 기사',
        });
      }

      for (const adm of admins) {
        resultAdmins.push({
          id: adm.id,
          name: adm.name || '기관 관리자',
          role: adm.role,
          subText: '기관 관리자',
        });
      }

    } else if (currentUser.role === UserRole.TEACHER || currentUser.role === UserRole.SHUTTLE_TEACHER) {
      // 지도교사 ↔ 담당 차량 원아 학부모, 같은 기관 교직원, 기관 관리자
      const myVehicles = vehicles.filter(v => v.teacherUser?.id === currentUser.id);
      const myVehicleStudents = students.filter(s => myVehicles.some(v => v.id === s.assignedVehicle?.id));

      for (const st of myVehicleStudents) {
        if (st.parentUser && !resultParents.some(p => p.id === st.parentUser.id)) {
          const vName = st.assignedVehicle?.busNumber || '셔틀';
          resultParents.push({
            id: st.parentUser.id,
            name: st.parentUser.name || `${st.name} 학부모`,
            role: st.parentUser.role,
            subText: `${st.name} 원아 학부모 (${vName})`,
          });
        }
      }

      for (const t of [...homeroomTeachers, ...escortTeachers]) {
        if (t.id === currentUser.id) continue;
        resultTeachers.push({
          id: t.id,
          name: t.name || '선생님',
          role: t.role,
          subText: t.assignedClass ? `${t.assignedClass} 담임` : '지도교사',
        });
      }

      for (const d of drivers) {
        resultDrivers.push({
          id: d.id,
          name: d.name || '기사님',
          role: d.role,
          subText: driverVehicleMap.get(d.id) || '셔틀 기사',
        });
      }

      for (const adm of admins) {
        resultAdmins.push({
          id: adm.id,
          name: adm.name || '기관 관리자',
          role: adm.role,
          subText: '기관 관리자',
        });
      }

    } else if (currentUser.role === UserRole.DRIVER) {
      // 기사 ↔ 담당 차량 원아 학부모, 같은 기관 교직원, 기관 관리자
      const myVehicles = vehicles.filter(v => v.driverUser?.id === currentUser.id);
      const myVehicleStudents = students.filter(s => myVehicles.some(v => v.id === s.assignedVehicle?.id));

      for (const st of myVehicleStudents) {
        if (st.parentUser && !resultParents.some(p => p.id === st.parentUser.id)) {
          resultParents.push({
            id: st.parentUser.id,
            name: st.parentUser.name || `${st.name} 학부모`,
            role: st.parentUser.role,
            subText: `${st.name} 원아 학부모`,
          });
        }
      }

      for (const t of [...homeroomTeachers, ...escortTeachers]) {
        resultTeachers.push({
          id: t.id,
          name: t.name || '선생님',
          role: t.role,
          subText: t.assignedClass ? `${t.assignedClass} 담임` : '지도교사',
        });
      }

      for (const d of drivers) {
        if (d.id === currentUser.id) continue;
        resultDrivers.push({
          id: d.id,
          name: d.name || '기사님',
          role: d.role,
          subText: driverVehicleMap.get(d.id) || '셔틀 기사',
        });
      }

      for (const adm of admins) {
        resultAdmins.push({
          id: adm.id,
          name: adm.name || '기관 관리자',
          role: adm.role,
          subText: '기관 관리자',
        });
      }

    } else {
      // 기관 관리자(ADMIN, ACADEMY_ADMIN, SUPER_ADMIN) ↔ 전체 교직원 및 학부모
      for (const st of students) {
        if (st.parentUser && !resultParents.some(p => p.id === st.parentUser.id)) {
          const cName = getStudentClassName(st);
          resultParents.push({
            id: st.parentUser.id,
            name: st.parentUser.name || `${st.name} 학부모`,
            role: st.parentUser.role,
            subText: cName ? `${st.name} 원아 학부모 (${cName})` : `${st.name} 원아 학부모`,
          });
        }
      }

      for (const t of [...homeroomTeachers, ...escortTeachers]) {
        if (t.id === currentUser.id) continue;
        resultTeachers.push({
          id: t.id,
          name: t.name || '선생님',
          role: t.role,
          subText: t.assignedClass ? `${t.assignedClass} 담임` : '지도교사',
        });
      }

      for (const d of drivers) {
        resultDrivers.push({
          id: d.id,
          name: d.name || '기사님',
          role: d.role,
          subText: driverVehicleMap.get(d.id) || '셔틀 기사',
        });
      }

      for (const adm of admins) {
        if (adm.id === currentUser.id) continue;
        resultAdmins.push({
          id: adm.id,
          name: adm.name || '기관 관리자',
          role: adm.role,
          subText: '기관 관리자',
        });
      }
    }

    const sortFn = (a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko');
    resultTeachers.sort(sortFn);
    resultParents.sort(sortFn);
    resultDrivers.sort(sortFn);
    resultAdmins.sort(sortFn);

    return {
      teachers: resultTeachers,
      parents: resultParents,
      drivers: resultDrivers,
      admins: resultAdmins,
    };
  }

  /**
   * 내가 참여한 대화방 목록 조회 (안 읽은 개수, 최신 메시지, 상대방 정보 포함)
   */
  async getRoomsByUser(userId: number) {
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
      this.decorateRoomForUser(room, userId);
    }

    // 최신 메시지 시각순 정렬
    rooms.sort((a: any, b: any) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    return rooms;
  }

  decorateRoomForUser(room: ChatRoom, currentUserId: number) {
    const otherMembers = (room.members || []).filter(m => m.user?.id !== currentUserId);
    if (otherMembers.length === 1) {
      const target = otherMembers[0].user;
      (room as any).targetUser = {
        id: target.id,
        name: target.name || '상대방',
        role: target.role,
        assignedClass: target.assignedClass,
      };
      (room as any).displayName = target.name || room.name;
    } else {
      (room as any).displayName = room.name;
    }
    return room;
  }

  /**
   * 대화방 메시지 조회 (참여자 권한 검사, 읽음 처리, 메시지별 안 읽은 사람 수 포함)
   */
  async getMessages(roomId: number, currentUserId?: number) {
    if (currentUserId) {
      const isMember = await this.isUserRoomMember(roomId, currentUserId);
      if (!isMember) {
        throw new ForbiddenException('대화방 참여자만 메시지를 조회할 수 있습니다.');
      }
    }

    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: { user: true } },
    });
    const memberCount = room?.members?.length || 2;

    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      order: { createdAt: 'ASC' },
      relations: { sender: true },
    });

    let hasNewRead = false;
    for (const m of messages) {
      const readByList = (m.readBy || []).map(Number);
      if (currentUserId && m.sender && m.sender.id !== currentUserId && !readByList.includes(currentUserId)) {
        readByList.push(currentUserId);
        m.readBy = readByList;
        await this.messageRepo.save(m);
        hasNewRead = true;
      }
      (m as any).unreadCount = Math.max(0, memberCount - (m.readBy ? m.readBy.length : 0));
    }

    if (hasNewRead && currentUserId) {
      await this.memberRepo.update(
        { room: { id: roomId }, user: { id: currentUserId } },
        { lastReadAt: new Date() }
      ).catch(() => {});
      this.chatGateway.broadcastReadStatus(roomId, currentUserId);
    }

    return messages;
  }

  /**
   * 대화방 읽음 처리 (API)
   */
  async markRoomAsRead(roomId: number, userId: number) {
    const isMember = await this.isUserRoomMember(roomId, userId);
    if (!isMember) {
      throw new ForbiddenException('대화방 참여자만 읽음 처리할 수 있습니다.');
    }

    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      relations: { sender: true },
    });

    for (const m of messages) {
      const readByList = (m.readBy || []).map(Number);
      if (m.sender && m.sender.id !== userId && !readByList.includes(userId)) {
        readByList.push(userId);
        m.readBy = readByList;
        await this.messageRepo.save(m);
      }
    }

    await this.memberRepo.update(
      { room: { id: roomId }, user: { id: userId } },
      { lastReadAt: new Date() }
    ).catch(() => {});

    this.chatGateway.broadcastReadStatus(roomId, userId);

    return { success: true };
  }

  /**
   * 대화방 생성 (1:1 중복 방지, 학부모 간 대화 방지, 같은 기관 검증)
   */
  async createRoom(creatorId: number, targetUserIds: number[], name?: string, type?: string) {
    const creator = await this.userRepo.findOne({ where: { id: creatorId }, relations: { academy: true } });
    if (!creator) throw new BadRequestException('생성자 계정을 찾을 수 없습니다.');

    const allUserIds = Array.from(new Set([creatorId, ...(targetUserIds || [])]));
    if (allUserIds.length < 2) {
      throw new BadRequestException('대화 상대를 1명 이상 선택해야 합니다.');
    }

    const targetUsers = await this.userRepo.find({
      where: { id: In(allUserIds) },
      relations: { academy: true },
    });

    // 같은 기관 소속 검증
    const creatorAcademyId = creator.academy?.id || creator.academyId;
    for (const u of targetUsers) {
      const uAid = u.academy?.id || u.academyId;
      if (
        creatorAcademyId &&
        uAid &&
        creatorAcademyId !== uAid &&
        creator.role !== UserRole.SUPER_ADMIN &&
        u.role !== UserRole.SUPER_ADMIN
      ) {
        throw new BadRequestException('다른 기관 소속 사용자와는 대화방을 만들 수 없습니다.');
      }
    }

    const isDirect = allUserIds.length === 2;

    // 학부모 간 1:1 대화 불가
    if (isDirect) {
      const other = targetUsers.find(u => u.id !== creatorId);
      if (creator.role === UserRole.PARENT && other?.role === UserRole.PARENT) {
        throw new BadRequestException('학부모 간 대화는 허용되지 않습니다.');
      }
    }

    // 1:1 대화인 경우 같은 2명으로 구성된 기존 방 재사용
    if (isDirect) {
      const u1 = allUserIds[0];
      const u2 = allUserIds[1];
      const existingRooms = await this.roomRepo.createQueryBuilder('room')
        .innerJoin('room.members', 'm1', 'm1.userId = :u1', { u1 })
        .innerJoin('room.members', 'm2', 'm2.userId = :u2', { u2 })
        .leftJoinAndSelect('room.members', 'allMembers')
        .leftJoinAndSelect('allMembers.user', 'user')
        .getMany();

      for (const r of existingRooms) {
        if (r.members && r.members.length === 2) {
          return this.decorateRoomForUser(r, creatorId);
        }
      }
    }

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
      type: isDirect ? (ChatRoomType.STAFF as any) : ((type as any) || ChatRoomType.STAFF),
    });
    const savedRoom = await this.roomRepo.save(room);

    const members = allUserIds.map(uid => this.memberRepo.create({
      room: savedRoom,
      user: { id: uid },
      lastReadAt: uid === creatorId ? new Date() : undefined,
    }));
    await this.memberRepo.save(members);

    for (const uid of allUserIds) {
      this.chatGateway?.server?.to(`user_${uid}`).emit('roomUpdated', { roomId: savedRoom.id });
    }

    const fullRoom = await this.roomRepo.findOne({
      where: { id: savedRoom.id },
      relations: { members: { user: true } },
    });
    return this.decorateRoomForUser(fullRoom!, creatorId);
  }

  /**
   * 메시지 전송 및 알림 생성·소켓 브로드캐스트
   */
  async sendMessage(roomId: number, senderId: number, text: string) {
    const isMember = await this.isUserRoomMember(roomId, senderId);
    if (!isMember) {
      throw new ForbiddenException('대화방 참여자만 메시지를 보낼 수 있습니다.');
    }

    const sender = await this.userRepo.findOne({
      where: { id: senderId },
      relations: { academy: true },
    });
    if (!sender) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const message = this.messageRepo.create({
      room: { id: roomId },
      sender,
      text: text.trim(),
      readBy: [senderId],
    });
    const saved = await this.messageRepo.save(message);

    await this.roomRepo.update(roomId, { updatedAt: new Date() });

    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: { user: true } },
    });
    const memberCount = room?.members?.length || 2;
    const memberUserIds = (room?.members || []).map(m => m.user.id);

    const fullMessage = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });
    (fullMessage as any).unreadCount = Math.max(0, memberCount - 1);

    // 수신자(발신자 제외)에게 Notification 엔티티 생성 & 저장
    for (const member of room?.members || []) {
      if (member.user && member.user.id !== senderId) {
        const noti = this.notificationRepo.create({
          recipient: member.user,
          recipientRole: member.user.role,
          type: 'MESSAGE',
          message: `${sender.name || '상대방'}: ${text.trim()}`,
          academy: sender.academy || undefined,
        });
        await this.notificationRepo.save(noti).catch(() => {});
      }
    }

    if (fullMessage) {
      this.chatGateway.broadcastMessageToRoom(roomId, fullMessage, memberUserIds);
    }

    return fullMessage;
  }

  // ==================== 이전 API 호환 브리지 ====================
  async getRoomsByEmail(email: string) {
    if (!email) return [];
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return [];
    return this.getRoomsByUser(user.id);
  }

  async createRoomByEmail(name: string | undefined, type: string | undefined, userIds: number[], creatorEmail: string) {
    const user = await this.userRepo.findOne({ where: { email: creatorEmail } });
    if (!user) throw new BadRequestException('생성자 계정을 찾을 수 없습니다.');
    return this.createRoom(user.id, userIds, name, type);
  }

  async sendMessageAndBroadcast(roomId: number, senderEmail: string, text: string) {
    const user = await this.userRepo.findOne({ where: { email: senderEmail } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    return this.sendMessage(roomId, user.id, text);
  }
}
