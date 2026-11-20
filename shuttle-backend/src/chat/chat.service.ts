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
import { PickupPoint } from '../entities/pickup-point.entity';
import { ParentMessage } from '../entities/parent-message.entity';
import { Notification } from '../entities/notification.entity';
import { ChatGateway } from './chat.gateway';
import { RoutingService } from '../routing/routing.service';
import { ApprovalService } from '../approval/approval.service';
import { formatTeacherName } from '../utils/teacher.util';
import { getStudentClassName, isSameClass } from '../utils/school.util';
import { isNotificationEnabled } from '../utils/notification.util';

/** 개인 알림방 이름 (NOTIFICATION_SYSTEM 타입, 사용자 1명 전용) */
export const PERSONAL_NOTI_ROOM_NAME = 'TakeMe 알림';
/** 기관 공지 채널 이름 (NOTIFICATION_SYSTEM 타입, 기관 전체 공유) */
export const ACADEMY_NOTI_ROOM_NAME = '공지사항';
/** 예전 이름 (이미 만들어진 방은 접근할 때 새 이름으로 바꾼다) */
export const LEGACY_ACADEMY_NOTI_ROOM_NAME = '실시간 알림 채널';
const ACADEMY_NOTI_ROOM_NAMES = [ACADEMY_NOTI_ROOM_NAME, LEGACY_ACADEMY_NOTI_ROOM_NAME];

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
    @InjectRepository(PickupPoint) private pickupPointRepo: Repository<PickupPoint>,
    @InjectRepository(ParentMessage) private parentMessageRepo: Repository<ParentMessage>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @Inject(forwardRef(() => RoutingService))
    private readonly routingService: RoutingService,
  ) {
    this.routingService.registerSystemNotificationHandler(
      (academyId: number | null, category: string, title: string, content: string, extra?: any) => {
        return this.sendSystemNotification(academyId, category as any, title, content, extra);
      }
    );
    this.routingService.registerStudentNotificationHandler(
      (studentId: number, title: string, content: string, roles: any[], options?: any) => {
        return this.notifyStudentRelated(studentId, title, content, roles as any, options);
      }
    );
  }

  async getAcademyUsers(academyId?: number, currentUserEmail?: string, educationLevel?: string) {
    let currentUser: User | null = null;
    if (currentUserEmail) {
      currentUser = await this.userRepo.findOne({ where: { email: currentUserEmail } });
    }
    const targetAcademyId = academyId || currentUser?.academyId;
    if (!targetAcademyId) {
      return { drivers: [], teachers: [], parents: [], students: [], admins: [] };
    }

    // 1. 차량 정보 조회 (기사 및 차량선생님 매핑)
    const vehicles = await this.vehicleRepo.find({
      where: { academy: { id: targetAcademyId } },
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
        teacherVehicleMap.set(v.teacherUser.id, v.busNumber ? `${v.busNumber} 차량선생님` : '차량선생님');
        vehicleUserIds.add(v.teacherUser.id);
      }
    }

    // 2. 원생 정보 조회 (학부모 및 학생 계정 매핑)
    const students = await this.studentRepo.find({
      where: { academy: { id: targetAcademyId } },
      relations: { parentUser: true, studentUser: true },
    });

    const parentChildMap = new Map<number, string>();
    const parentUserIds = new Set<number>();
    const studentUserMap = new Map<number, string>();
    const studentUserIds = new Set<number>();

    for (const s of students) {
      if (s.parentUser) {
        const existing = parentChildMap.get(s.parentUser.id);
        const childName = s.name || '원아';
        parentChildMap.set(s.parentUser.id, existing ? `${existing}, ${childName}` : `${childName} 학부모`);
        parentUserIds.add(s.parentUser.id);
      }
      if (s.studentUser) {
        studentUserMap.set(s.studentUser.id, `${s.className ? s.className + ' · ' : ''}${s.name || '학생'}`);
        studentUserIds.add(s.studentUser.id);
      }
    }

    // 3. 사용자 목록 조회 (해당 유치원/학원 소속 사용자만 엄격 격리)
    const vIds = vehicleUserIds.size > 0 ? Array.from(vehicleUserIds) : [0];
    const pIds = parentUserIds.size > 0 ? Array.from(parentUserIds) : [0];
    const sIds = studentUserIds.size > 0 ? Array.from(studentUserIds) : [0];
    const userQuery = this.userRepo.createQueryBuilder('u')
      .where(
        '(u.academyId = :targetAcademyId OR u.id IN (:...vIds) OR u.id IN (:...pIds) OR u.id IN (:...sIds))',
        { targetAcademyId, vIds, pIds, sIds }
      );
    const allUsers = await userQuery.getMany();

    const isKindergarten = educationLevel === '유치원';
    const drivers: any[] = [];
    const teachers: any[] = [];
    const parents: any[] = [];
    const studentsList: any[] = [];
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
        const sub = u.assignedClass ? `${u.assignedClass} 담임` : teacherVehicleMap.get(u.id) || (u.role === UserRole.SHUTTLE_TEACHER ? '차량선생님' : '교사');
        teachers.push({
          id: u.id,
          name: u.name || '선생님',
          role: u.role,
          email: u.email,
          subText: sub,
        });
      } else if (u.role === UserRole.STUDENT) {
        // 유치원에서는 학생이 스마트폰 앱을 사용하지 않으므로 제외! 초등부와 중등부에서는 포함!
        if (!isKindergarten) {
          const sub = studentUserMap.get(u.id) || u.assignedClass || '학생';
          studentsList.push({
            id: u.id,
            name: u.name ? (u.name.includes('학생') ? u.name : `${u.name} 학생`) : '학생',
            role: u.role,
            email: u.email,
            subText: sub,
          });
        }
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
    studentsList.sort(sortFn);
    admins.sort(sortFn);

    return { drivers, teachers, parents, students: studentsList, admins };
  }

  /** 대화방 참여자 목록을 조회해서 해당 방 참여자에게만 메시지 전송 */
  private async broadcastToRoom(roomId: number, message: any) {
    const room = await this.roomRepo.findOne({ where: { id: roomId }, relations: { members: { user: true } } });
    const ids = (room?.members || []).map(m => m.user?.id).filter(Boolean) as number[];
    const memberCount = ids.length || 2;
    const msgWithCounts = {
      ...message,
      memberCount,
      unreadCount: message.unreadCount !== undefined ? message.unreadCount : Math.max(0, memberCount - 1),
    };
    this.chatGateway.broadcastMessageToRoom(roomId, msgWithCounts, ids);
  }

  /** WebSocket 메시지 전송용: 사용자 ID 기준 (참여자 검증 포함) */
  async sendMessage(roomId: number, senderId: number, text: string) {
    const sender = await this.userRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    return this.sendMessageAndBroadcast(roomId, sender.email, text);
  }

  /** 대화방 참여 여부 확인 */
  async isUserRoomMember(roomId: number, userId: number): Promise<boolean> {
    const member = await this.memberRepo.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    return !!member;
  }

  /**
   * 사용자의 개인 알림방("TakeMe 알림", NOTIFICATION_SYSTEM) 조회 또는 생성.
   * 기관 공지 채널(공지사항)과는 이름과 참여자(1명)로 구분한다.
   */
  async getOrCreateNotificationRoom(userId: number): Promise<ChatRoom> {
    const existingMember = await this.memberRepo.findOne({
      where: {
        user: { id: userId },
        room: { type: ChatRoomType.NOTIFICATION_SYSTEM, name: PERSONAL_NOTI_ROOM_NAME },
      },
      relations: { room: true },
    });
    if (existingMember?.room) return existingMember.room;

    const newRoom = this.roomRepo.create({
      name: PERSONAL_NOTI_ROOM_NAME,
      type: ChatRoomType.NOTIFICATION_SYSTEM,
    });
    const savedRoom = await this.roomRepo.save(newRoom);
    await this.memberRepo.save(this.memberRepo.create({ room: savedRoom, user: { id: userId } }));
    return savedRoom;
  }

  /**
   * 개인 알림 발송 (메신저 "TakeMe 알림" 방으로 전송)
   * - 알림 수신 설정(isNotificationEnabled)에서 꺼진 종류는 발송하지 않음
   */
  async sendSystemNotificationToUser(
    userId: number,
    title: string,
    message: string,
    options?: {
      type?: 'change_request' | 'chat' | 'notice' | 'escort' | 'shuttle' | 'board' | string;
      metadata?: any;
      actionUrl?: string;
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;

    if (options?.type && !isNotificationEnabled(user, options.type as any)) {
      return null;
    }

    const room = await this.getOrCreateNotificationRoom(userId);
    const chatMsg = this.messageRepo.create({
      room,
      sender: undefined,
      text: `[${title}]\n${message}`,
      type: 'TEXT',
      payload: {
        isSystemAlert: true,
        senderLabel: PERSONAL_NOTI_ROOM_NAME,
        category: options?.type,
        title,
        content: message,
        ...(options?.metadata || { type: options?.type, actionUrl: options?.actionUrl }),
      },
      readBy: [],
    });
    const saved = await this.messageRepo.save(chatMsg);
    await this.roomRepo.update(room.id, { updatedAt: new Date() });

    if (this.chatGateway?.server) {
      this.chatGateway.broadcastMessageToRoom(room.id, saved, [userId]);
      this.chatGateway.server.to(`user_${userId}`).emit('roomUpdated', { roomId: room.id });
      this.chatGateway.server.to(`user_${userId}`).emit('notificationReceived', {
        type: options?.type || 'SYSTEM',
        title,
        message,
        roomId: room.id,
        createdAt: saved.createdAt,
      });
    }
    return saved;
  }

  /** 여러 사용자에게 개인 알림 발송 */
  async sendSystemNotificationToUsers(
    userIds: number[],
    title: string,
    message: string,
    options?: {
      type?: 'change_request' | 'chat' | 'notice' | 'escort' | 'shuttle' | 'board' | string;
      metadata?: any;
      actionUrl?: string;
    },
  ) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    const results = [];
    for (const uid of uniqueIds) {
      const res = await this.sendSystemNotificationToUser(uid, title, message, options);
      if (res) results.push(res);
    }
    return results;
  }

  /** 대화방 읽음 처리 */
  async markRoomAsRead(roomId: number, userId: number) {
    if (!(await this.isUserRoomMember(roomId, userId))) {
      throw new ForbiddenException('대화방 참여자만 읽음 처리할 수 있습니다.');
    }
    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      relations: { sender: true },
    });
    for (const m of messages) {
      const readByList = (m.readBy || []).map(Number);
      if (!readByList.includes(userId) && (!m.sender || m.sender.id !== userId)) {
        readByList.push(userId);
        m.readBy = readByList;
        await this.messageRepo.save(m);
      }
    }
    await this.memberRepo.update(
      { room: { id: roomId }, user: { id: userId } },
      { lastReadAt: new Date() },
    ).catch(() => {});
    this.chatGateway.broadcastReadStatus(roomId, userId);
    return { success: true };
  }

  // ============================================================
  // 관련자에게만 보내는 개인 알림 (기관 공지 채널로 보내지 않는다)
  // ============================================================

  /** 같은 기관 관리자(원장)들의 사용자 ID */
  async getAcademyAdminIds(academyId?: number | null): Promise<number[]> {
    if (!academyId) return [];
    const ids = new Set<number>();
    const admins = await this.userRepo.find({ where: { academyId, role: UserRole.ACADEMY_ADMIN } });
    admins.forEach(a => ids.add(a.id));
    const academy = await this.academyRepo.findOne({ where: { id: academyId }, relations: { owner: true } });
    if (academy?.owner?.id) ids.add(academy.owner.id);
    return Array.from(ids);
  }

  /**
   * 원아와 연결된 사람들의 사용자 ID
   * - PARENT: 그 원아의 학부모 / HOMEROOM: 그 원아 반의 담임 / VEHICLE: 배정된 차량의 지도교사·기사 / ADMIN: 그 기관 관리자
   * 원아 이름이 들어가는 알림은 반드시 이 함수로 대상자를 정한다.
   */
  async getStudentRelatedUserIds(
    studentId: number,
    roles: Array<'PARENT' | 'HOMEROOM' | 'VEHICLE' | 'ADMIN'>,
  ): Promise<number[]> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: {
        parentUser: true,
        studentUser: true,
        academy: true,
        assignedVehicle: { driverUser: true, teacherUser: true },
      },
    });
    if (!student) return [];
    const ids = new Set<number>();

    if (roles.includes('PARENT')) {
      if (student.parentUser?.id) ids.add(student.parentUser.id);
      if (student.studentUser?.id) ids.add(student.studentUser.id);
    }
    if (roles.includes('VEHICLE')) {
      const v = student.assignedVehicle;
      if (v?.driverUser?.id) ids.add(v.driverUser.id);
      if (v?.teacherUser?.id) ids.add(v.teacherUser.id);
    }
    if (roles.includes('HOMEROOM') && student.academy?.id) {
      const cls = getStudentClassName(student);
      if (cls) {
        const teachers = await this.userRepo.find({
          where: { academyId: student.academy.id, role: UserRole.HOMEROOM_TEACHER },
        });
        teachers.filter(t => isSameClass(t.assignedClass, cls)).forEach(t => ids.add(t.id));
      }
    }
    if (roles.includes('ADMIN')) {
      (await this.getAcademyAdminIds(student.academy?.id)).forEach(id => ids.add(id));
    }
    return Array.from(ids);
  }

  /** 원아와 연결된 사람들에게만 개인 알림("TakeMe 알림")을 보낸다 */
  async notifyStudentRelated(
    studentId: number,
    title: string,
    message: string,
    roles: Array<'PARENT' | 'HOMEROOM' | 'VEHICLE' | 'ADMIN'>,
    options?: { type?: 'change_request' | 'shuttle' | 'escort' | string; metadata?: any; excludeUserIds?: number[] },
  ) {
    try {
      const exclude = new Set(options?.excludeUserIds || []);
      const ids = (await this.getStudentRelatedUserIds(studentId, roles)).filter(id => !exclude.has(id));
      if (ids.length === 0) return [];
      return await this.sendSystemNotificationToUsers(ids, title, message, {
        type: options?.type,
        metadata: options?.metadata,
      });
    } catch (err) {
      console.error('[ChatService] notifyStudentRelated error:', err);
      return [];
    }
  }

  async sendSystemNotification(
    academyId: number | null,
    category: 'ABSENT' | 'SHUTTLE_REQUEST' | 'PICKUP' | 'PAYMENT_REQUEST' | 'PAYMENT_DECISION' | 'GENERAL',
    title: string,
    content: string,
    extraData?: any,
  ) {
    // 공지사항 채널은 기관 전체 공지(행사·휴원·규정 변경 등) 전용이다.
    // 결석·결재·운행 같은 개별 소식은 관련자에게만 개인 알림으로 보낸다(notifyStudentRelated 등).
    if (category !== 'GENERAL') {
      console.warn(`[ChatService] 공지사항 채널에는 개별 업무 알림(${category})을 보내지 않습니다. 개인 알림을 사용하세요.`);
      return;
    }
    try {
      let notiRoom = await this.roomRepo.findOne({
        where: {
          type: ChatRoomType.NOTIFICATION_SYSTEM,
          name: In(ACADEMY_NOTI_ROOM_NAMES),
          ...(academyId ? { academyId } : {}),
        },
        relations: { members: { user: true } },
      });

      if (notiRoom && notiRoom.name !== ACADEMY_NOTI_ROOM_NAME) {
        await this.roomRepo.update(notiRoom.id, { name: ACADEMY_NOTI_ROOM_NAME });
        notiRoom.name = ACADEMY_NOTI_ROOM_NAME;
      }

      if (!notiRoom) {
        notiRoom = this.roomRepo.create({
          name: ACADEMY_NOTI_ROOM_NAME,
          type: ChatRoomType.NOTIFICATION_SYSTEM,
          academyId: academyId || null,
        });
        notiRoom = await this.roomRepo.save(notiRoom);
      }

      let senderUser: User | null = null;
      if (academyId) {
        senderUser = await this.userRepo.findOne({
          where: { academyId, role: In([UserRole.ACADEMY_ADMIN, UserRole.SUPER_ADMIN]) },
        });
      }
      if (!senderUser) {
        senderUser = await this.userRepo.findOne({
          where: { role: UserRole.SUPER_ADMIN },
        });
      }

      const message = this.messageRepo.create({
        room: notiRoom,
        sender: senderUser || undefined,
        text: `[${title}] ${content}`,
        type: 'TEXT',
        payload: {
          isSystemAlert: true,
          category,
          title,
          content,
          extraData,
          createdAt: new Date().toISOString(),
        },
        readBy: senderUser ? [senderUser.id] : [],
      });

      const saved = await this.messageRepo.save(message);
      await this.roomRepo.update(notiRoom.id, { updatedAt: new Date() });

      this.chatGateway.broadcastMessageToRoom(notiRoom.id, saved, (notiRoom.members || []).map(m => m.user?.id).filter(Boolean) as number[]);
      this.chatGateway.server?.to(`chat_${notiRoom.id}`).emit('roomUpdated', { roomId: notiRoom.id });
      if (academyId) this.chatGateway.server?.to(`academy_${academyId}`).emit('roomUpdated', { roomId: notiRoom.id });

      const alertPayload = {
        id: saved.id,
        category,
        title,
        message: content,
        timestamp: new Date().toISOString(),
        data: extraData,
      };

      if (academyId && this.chatGateway?.server) {
        // 원장·데스크 방(academy_admin_{id}, LocationGateway에서 역할별로 입장)에만 보낸다.
        // 기관 전체 방(academy_{id})에는 학부모·학생도 있으므로 보내지 않는다.
        this.chatGateway.server.to(`academy_admin_${academyId}`).emit('directorAlert', alertPayload);
        this.chatGateway.server.to(`academy_admin_${academyId}`).emit('notificationReceived', {
          type: 'DIRECTOR_ALERT',
          data: alertPayload,
        });
      }
      // 전체 전송 대신 통합 관리자 개인 방으로만 전달
      const superAdmins = await this.userRepo.find({ where: { role: UserRole.SUPER_ADMIN } });
      for (const sa of superAdmins) {
        this.chatGateway?.server?.to(`user_${sa.id}`).emit('globalDirectorAlert', alertPayload);
      }

      return saved;
    } catch (err) {
      console.error('Failed to send system notification:', err);
    }
  }

  async getRoomsByEmail(email: string, educationLevel?: string) {
    if (!email) return [];
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) return [];
    const userId = user.id;

    const targetAcademyId = user.academyId || null;

    // Ensure '공지사항' exists and user is member
    let notiSystemRoom = await this.roomRepo.findOne({
      where: {
        type: ChatRoomType.NOTIFICATION_SYSTEM,
        name: In(ACADEMY_NOTI_ROOM_NAMES),
        ...(targetAcademyId ? { academyId: targetAcademyId } : {}),
      },
      relations: { members: { user: true } },
    });

    if (notiSystemRoom && notiSystemRoom.name !== ACADEMY_NOTI_ROOM_NAME) {
      await this.roomRepo.update(notiSystemRoom.id, { name: ACADEMY_NOTI_ROOM_NAME });
      notiSystemRoom.name = ACADEMY_NOTI_ROOM_NAME;
    }

    if (!notiSystemRoom) {
      notiSystemRoom = this.roomRepo.create({
        name: ACADEMY_NOTI_ROOM_NAME,
        type: ChatRoomType.NOTIFICATION_SYSTEM,
        academyId: targetAcademyId,
      });
      notiSystemRoom = await this.roomRepo.save(notiSystemRoom);
    }

    const isNotiMember = (notiSystemRoom.members || []).some(m => m.user?.id === userId);
    if (!isNotiMember) {
      const notiMember = this.memberRepo.create({
        room: notiSystemRoom,
        user: { id: userId },
      });
      await this.memberRepo.save(notiMember);
    }

    // 개인 알림방 보장 ("TakeMe 알림")
    await this.getOrCreateNotificationRoom(userId);

    // Fetch all rooms the user is a member of
    const query = this.roomRepo.createQueryBuilder('room')
      .innerJoin('room.members', 'myMember', 'myMember.userId = :userId', { userId })
      .leftJoinAndSelect('room.members', 'allMembers')
      .leftJoinAndSelect('allMembers.user', 'memberUser');

    if (targetAcademyId) {
      query.andWhere('(room.academyId = :targetAcademyId OR room.academyId IS NULL)', { targetAcademyId });
    }

    const rooms = await query.getMany();
    const roomIds = rooms.map(r => r.id);

    const latestMap = new Map<number, ChatMessage>();
    const unreadMap = new Map<number, number>();

    if (roomIds.length > 0) {
      // 1) 각 방별 최신 메시지를 MAX(id) 기반 단일 조인 쿼리로 일괄 조회
      try {
        const latestMessages = await this.messageRepo
          .createQueryBuilder('msg')
          .leftJoinAndSelect('msg.sender', 'sender')
          .leftJoinAndSelect('msg.room', 'room')
          .innerJoin(
            (subQuery) =>
              subQuery
                .select('m.roomId', 'roomId')
                .addSelect('MAX(m.id)', 'maxId')
                .from(ChatMessage, 'm')
                .where('m.roomId IN (:...roomIds)', { roomIds })
                .groupBy('m.roomId'),
            'latest',
            'msg.id = latest.maxId'
          )
          .getMany();

        for (const msg of latestMessages) {
          if (msg.room?.id) {
            latestMap.set(msg.room.id, msg);
          }
        }
      } catch (err) {
        // 폴백: 서브쿼리 조인이 실패할 경우 최신순 조회로 안전하게 매핑
        const recentMessages = await this.messageRepo.find({
          where: { room: { id: In(roomIds) } },
          order: { createdAt: 'DESC' },
          relations: { sender: true, room: true },
          take: roomIds.length * 5,
        });
        for (const msg of recentMessages) {
          if (msg.room?.id && !latestMap.has(msg.room.id)) {
            latestMap.set(msg.room.id, msg);
          }
        }
      }

      // 2) 안 읽은 메시지 수 계산:
      // senderId != userId 인 안 읽은 메시지 후보들만 경량 조회
      try {
        const candidateMsgs = await this.messageRepo
          .createQueryBuilder('msg')
          .select(['msg.id', 'msg.readBy', 'room.id', 'sender.id'])
          .leftJoin('msg.room', 'room')
          .leftJoin('msg.sender', 'sender')
          .where('room.id IN (:...roomIds)', { roomIds })
          .andWhere('(sender.id IS NULL OR sender.id != :userId)', { userId })
          .getMany();

        for (const m of candidateMsgs) {
          const reads = (m.readBy || []).map(Number);
          if (!reads.includes(userId)) {
            const rId = m.room?.id;
            if (rId) {
              unreadMap.set(rId, (unreadMap.get(rId) || 0) + 1);
            }
          }
        }
      } catch (err) {
        // 에러 시 0 유지
      }
    }

    for (const room of rooms) {
      (room as any).latestMessage = latestMap.get(room.id) || null;
      (room as any).unreadCount = unreadMap.get(room.id) || 0;
    }

    // 내 참여 정보(고정·삭제 여부)
    const myMemberships = await this.memberRepo.find({
      where: { user: { id: userId } },
      relations: { room: true },
    });
    const myMemberByRoom = new Map<number, ChatRoomMember>();
    for (const m of myMemberships) if (m.room?.id) myMemberByRoom.set(m.room.id, m);

    // 결재 전용 방 제외 및 알림 채널 단 1개 유지
    const seenSpecialTypes = new Set<string>();
    const deduplicatedRooms: ChatRoom[] = [];
    for (const room of rooms) {
      const mine = myMemberByRoom.get(room.id);
      // 내가 삭제한 방: 삭제한 뒤로 새 메시지가 없으면 목록에서 뺀다
      if (mine?.hiddenAt) {
        const latestAt = (room as any).latestMessage?.createdAt ? new Date((room as any).latestMessage.createdAt).getTime() : 0;
        if (latestAt <= new Date(mine.hiddenAt).getTime()) continue;
      }
      (room as any).pinnedAt = mine?.pinnedAt || null;
      (room as any).isPinned = !!mine?.pinnedAt;
      // 결재 전용 채널은 제거 (일반 1:1 및 그룹 대화방에서 결재 진행)
      if (room.type === ChatRoomType.PAYMENT_SYSTEM) {
        continue;
      }
      // 학제 격리: 방의 학제 정보가 지정되어 있고 현재 학제와 다르면 제외
      if ((room as any).educationLevel && educationLevel && (room as any).educationLevel !== educationLevel) {
        continue;
      }
      if (room.type === ChatRoomType.NOTIFICATION_SYSTEM) {
        // 개인 알림방(TakeMe 알림) 1개 + 기관 공지 채널(공지사항) 1개만 유지
        const key = room.name === PERSONAL_NOTI_ROOM_NAME ? 'PERSONAL' : 'ACADEMY';
        if (seenSpecialTypes.has(key)) continue;
        seenSpecialTypes.add(key);
        room.name = key === 'PERSONAL' ? PERSONAL_NOTI_ROOM_NAME : ACADEMY_NOTI_ROOM_NAME;
      }
      deduplicatedRooms.push(room);
    }

    // 정렬: 1) TakeMe 알림 2) 공지사항 3) 내가 고정한 방(먼저 고정한 순서) 4) 나머지는 최신 메시지 순
    deduplicatedRooms.sort((a: any, b: any) => {
      const aNoti = a.type === ChatRoomType.NOTIFICATION_SYSTEM;
      const bNoti = b.type === ChatRoomType.NOTIFICATION_SYSTEM;
      if (aNoti !== bNoti) return aNoti ? -1 : 1;
      if (aNoti && bNoti) return a.name === PERSONAL_NOTI_ROOM_NAME ? -1 : 1; // TakeMe 알림 → 공지사항
      const aPin = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bPin = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      if (!!aPin !== !!bPin) return aPin ? -1 : 1;
      if (aPin && bPin && aPin !== bPin) return aPin - bPin;
      const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    return deduplicatedRooms;
  }

  // ============================================================
  // 공지사항 읽음 확인 (원장·데스크·통합 관리자)
  // ============================================================

  /** 공지를 받아야 하는 사람: 그 기관의 학부모·학생·교사·기사 (원장·데스크 제외) */
  private async getNoticeAudience(academyId: number) {
    const users = await this.userRepo.find({ where: { academyId }, select: { id: true, name: true, email: true, role: true } });
    const audienceRoles = new Set<string>([
      UserRole.PARENT, UserRole.STUDENT, UserRole.DRIVER,
      UserRole.TEACHER, UserRole.HOMEROOM_TEACHER, UserRole.SHUTTLE_TEACHER,
    ]);
    return users.filter(u => audienceRoles.has(u.role));
  }

  /** 공지사항 방이고, 요청한 사람이 그 기관 원장·데스크(또는 통합 관리자)인지 확인 */
  private async assertNoticeManager(roomId: number, requester: { sub: number; role: string; academyId: number | null }) {
    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room || room.type !== ChatRoomType.NOTIFICATION_SYSTEM || room.name === PERSONAL_NOTI_ROOM_NAME) {
      throw new BadRequestException('공지사항 방이 아닙니다.');
    }
    const isSuper = requester.role === UserRole.SUPER_ADMIN;
    const isManager = requester.role === UserRole.ACADEMY_ADMIN || requester.role === UserRole.DESK_STAFF;
    if (!isSuper && !(isManager && requester.academyId && room.academyId === Number(requester.academyId))) {
      throw new ForbiddenException('공지 읽음 확인은 원장님(데스크)만 볼 수 있습니다.');
    }
    if (!room.academyId) throw new BadRequestException('기관 정보가 없는 공지사항 방입니다.');
    return room;
  }

  /** 최근 공지별 읽음 현황: 읽은 수/대상 수, 안 읽은 사람 */
  async getNoticeReadStatus(roomId: number, requester: { sub: number; role: string; academyId: number | null }) {
    const room = await this.assertNoticeManager(roomId, requester);
    const audience = await this.getNoticeAudience(room.academyId!);
    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      order: { createdAt: 'DESC' },
      take: 20,
      relations: { sender: true },
    });
    return messages.map(m => {
      const reads = new Set((m.readBy || []).map(Number));
      const unread = audience.filter(u => u.id !== m.sender?.id && !reads.has(u.id));
      const total = audience.filter(u => u.id !== m.sender?.id).length;
      return {
        messageId: m.id,
        text: m.text,
        createdAt: m.createdAt,
        total,
        readCount: total - unread.length,
        unread: unread.map(u => ({ id: u.id, name: u.name || u.email, role: u.role })),
      };
    });
  }

  /** 안 읽은 사람에게만 TakeMe 알림으로 다시 알림 */
  async remindUnreadNotice(messageId: number, requester: { sub: number; role: string; academyId: number | null }) {
    const msg = await this.messageRepo.findOne({ where: { id: messageId }, relations: { room: true, sender: true } });
    if (!msg?.room) throw new BadRequestException('공지를 찾을 수 없습니다.');
    const room = await this.assertNoticeManager(msg.room.id, requester);
    const audience = await this.getNoticeAudience(room.academyId!);
    const reads = new Set((msg.readBy || []).map(Number));
    const targets = audience.filter(u => u.id !== msg.sender?.id && !reads.has(u.id)).map(u => u.id);
    if (targets.length === 0) return { success: true, sentCount: 0 };
    const preview = (msg.text || '').replace(/\s+/g, ' ').slice(0, 60);
    const sent = await this.sendSystemNotificationToUsers(
      targets,
      '공지 확인 부탁드려요',
      `아직 확인하지 않은 공지가 있어요: "${preview}${(msg.text || '').length > 60 ? '…' : ''}" 메신저의 공지사항에서 확인해 주세요.`,
      { type: 'notice' },
    );
    return { success: true, sentCount: sent.length };
  }

  /** 내 목록에서 대화방 맨 위 고정/해제 (TakeMe 알림은 항상 맨 위라 고정 대상이 아님) */
  async setRoomPinned(roomId: number, userId: number, pinned: boolean) {
    const member = await this.memberRepo.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
      relations: { room: true },
    });
    if (!member) throw new ForbiddenException('대화방 참여자만 고정할 수 있습니다.');
    if (member.room?.type === ChatRoomType.NOTIFICATION_SYSTEM) {
      throw new BadRequestException('TakeMe 알림은 항상 맨 위에 있어 따로 고정할 수 없습니다.');
    }
    member.pinnedAt = pinned ? new Date() : null;
    await this.memberRepo.save(member);
    return { success: true, roomId, isPinned: pinned };
  }

  /** 내 목록에서 대화방 삭제 (다른 참여자에게는 그대로 있고, 새 메시지가 오면 다시 보인다) */
  async hideRoom(roomId: number, userId: number) {
    const member = await this.memberRepo.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
      relations: { room: true },
    });
    if (!member) throw new ForbiddenException('대화방 참여자만 삭제할 수 있습니다.');
    if (member.room?.type === ChatRoomType.NOTIFICATION_SYSTEM) {
      throw new BadRequestException('TakeMe 알림은 삭제할 수 없습니다.');
    }
    member.hiddenAt = new Date();
    member.pinnedAt = null;
    await this.memberRepo.save(member);
    return { success: true, roomId };
  }

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
    if (!room) {
      throw new BadRequestException('채팅방을 찾을 수 없습니다.');
    }

    // 테넌트 격리 및 인가 검증: 참여자가 아닌 경우 조회 차단 (SUPER_ADMIN 제외)
    if (currentUserId) {
      const isMember = room.members?.some(m => m.user?.id === currentUserId);
      if (!isMember) {
        const user = await this.userRepo.findOne({ where: { id: currentUserId } });
        if (user && user.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('해당 채팅방에 참여 중인 사용자만 메시지를 조회할 수 있습니다.');
        }
      }
    }

    const memberCount = room?.members?.length && room.members.length > 0 ? room.members.length : 2;

    const messages = await this.messageRepo.find({
      where: { room: { id: roomId } },
      order: { createdAt: 'ASC' },
      relations: { sender: true },
    });

    const updatedIds: number[] = [];
    if (currentUserId) {
      const toUpdate: ChatMessage[] = [];
      for (const m of messages) {
        // 보낸 사람이 없는 시스템 알림(TakeMe 알림)도 열어 보면 읽음 처리한다
        if (!m.sender || m.sender.id !== currentUserId) {
          const readByList = (m.readBy || []).map(Number);
          if (!readByList.includes(currentUserId)) {
            readByList.push(currentUserId);
            m.readBy = readByList;
            toUpdate.push(m);
            updatedIds.push(m.id);
          }
        }
      }
      if (toUpdate.length > 0) {
        await this.messageRepo.save(toUpdate);
        await this.memberRepo.update(
          { room: { id: roomId }, user: { id: currentUserId } },
          { lastReadAt: new Date() }
        ).catch(() => {});
        this.chatGateway.server?.to(`chat_${roomId}`).emit('messagesRead', {
          roomId,
          userId: currentUserId,
          messageIds: updatedIds,
        });
        this.chatGateway.broadcastReadStatus(roomId, currentUserId);
        this.chatGateway.server?.emit('roomUpdated', { roomId });
      }
    }

    return messages.map(m => {
      const readSet = new Set((m.readBy || []).map(Number));
      if (m.sender?.id) readSet.add(m.sender.id);
      const readCount = readSet.size;
      const unreadCount = Math.max(0, memberCount - readCount);
      return {
        ...m,
        memberCount,
        unreadCount,
      };
    });
  }

  async markRoomMessagesRead(roomId: number, userId: number) {
    if (!roomId || !userId) return { success: false, count: 0 };
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) return { success: false, count: 0 };

    const unreadMessages = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.roomId = :roomId', { roomId })
      .andWhere('(m.senderId != :userId OR m.senderId IS NULL)', { userId })
      .getMany();

    const updatedIds: number[] = [];
    for (const m of unreadMessages) {
      const readList = (m.readBy || []).map(Number);
      if (!readList.includes(userId)) {
        readList.push(userId);
        m.readBy = readList;
        await this.messageRepo.save(m);
        updatedIds.push(m.id);
      }
    }

    if (updatedIds.length > 0) {
      this.chatGateway.server?.to(`chat_${roomId}`).emit('messagesRead', {
        roomId,
        userId,
        messageIds: updatedIds,
      });
      this.chatGateway.server?.emit('roomUpdated', { roomId });
    }

    return { success: true, count: updatedIds.length };
  }

  async createRoomByEmail(name: string | undefined, type: string | undefined, userIds: number[], creatorEmail: string) {
    userIds = userIds || [];
    const creator = await this.userRepo.findOne({ where: { email: creatorEmail } });
    if (!creator) throw new BadRequestException('생성자 계정을 찾을 수 없습니다.');

    if (!userIds.includes(creator.id)) {
      userIds.push(creator.id);
    }

    const isDirect = userIds.length === 2;
    const roomType = isDirect ? ChatRoomType.DIRECT : ((type as any) || ChatRoomType.GROUP);

    // 1:1 대화인 경우 동일 2명으로 구성된 기존 방이 있는지 확인
    if (isDirect) {
      const u1 = userIds[0];
      const u2 = userIds[1];
      const existingQuery = this.roomRepo.createQueryBuilder('room')
        .innerJoin('room.members', 'm1', 'm1.userId = :u1', { u1 })
        .innerJoin('room.members', 'm2', 'm2.userId = :u2', { u2 })
        .leftJoinAndSelect('room.members', 'allMembers')
        .leftJoinAndSelect('allMembers.user', 'user');

      if (creator.academyId) {
        existingQuery.andWhere('(room.academyId = :cadId OR room.academyId IS NULL)', { cadId: creator.academyId });
      }
      const existingRooms = await existingQuery.getMany();

      for (const r of existingRooms) {
        if (r.members && r.members.length === 2 && r.type !== ChatRoomType.PAYMENT_SYSTEM) {
          return r;
        }
      }
    }

    const targetUsers = await this.userRepo.find({ where: { id: In(userIds) } });
    if (creator.academyId && creator.role !== UserRole.SUPER_ADMIN) {
      const otherUsers = targetUsers.filter(u => u.id !== creator.id);
      for (const u of otherUsers) {
        if (u.academyId && u.academyId !== creator.academyId) {
          throw new ForbiddenException('타 유치원 소속 사용자는 채팅방에 초대할 수 없습니다.');
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
      type: roomType,
      academyId: creator.academyId || null,
    });
    const savedRoom = await this.roomRepo.save(room);

    const members = userIds.map(uid => this.memberRepo.create({
      room: savedRoom,
      user: { id: uid },
    }));
    await this.memberRepo.save(members);

    for (const uid of userIds) {
      this.chatGateway?.server?.to(`user_${uid}`).emit('roomUpdated', { roomId: savedRoom.id });
    }

    return this.roomRepo.findOne({
      where: { id: savedRoom.id },
      relations: { members: { user: true } },
    });
  }

  async sendMessageAndBroadcast(roomId: number, senderEmail: string, text: string, type: string = 'TEXT', payload?: any) {
    const user = await this.userRepo.findOne({ where: { email: senderEmail } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    if (!(await this.isUserRoomMember(roomId, user.id))) {
      throw new ForbiddenException('대화방 참여자만 메시지를 보낼 수 있습니다.');
    }
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: { user: true } },
    });
    if (!room) throw new BadRequestException('채팅방을 찾을 수 없습니다.');

    if (room.type === ChatRoomType.NOTIFICATION_SYSTEM) {
      const isAdmin = user.role === UserRole.ACADEMY_ADMIN || user.role === UserRole.SUPER_ADMIN;
      if (room.name === PERSONAL_NOTI_ROOM_NAME || !isAdmin) {
        throw new ForbiddenException('알림 채널에는 답장을 보낼 수 없습니다.');
      }
    }

    const isMember = room.members?.some(m => m.user?.id === user.id);
    if (!isMember && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('해당 채팅방에 참여 중인 멤버만 메시지를 전송할 수 있습니다.');
    }
    const memberCount = room?.members?.length && room.members.length > 0 ? room.members.length : 2;
    const initialUnreadCount = Math.max(0, memberCount - 1);

    const message = this.messageRepo.create({
      room: { id: roomId },
      sender: user,
      text: (text || '').trim(),
      type: type || 'TEXT',
      payload: payload || null,
      readBy: [user.id],
    });
    const saved = await this.messageRepo.save(message);

    await this.roomRepo.update(roomId, { updatedAt: new Date() });

    const fullMessage = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });

    if (fullMessage) {
      const payloadMessage = {
        ...fullMessage,
        memberCount,
        unreadCount: initialUnreadCount,
      };
      const memberIds = (room?.members || []).map(m => m.user?.id).filter(Boolean) as number[];
      this.chatGateway.broadcastMessageToRoom(roomId, payloadMessage, memberIds);
    }

    // [교사/기사 앱 수신함 즉시 동기화]
    // 관리자(원장님) 또는 다른 사용자가 메시지를 보냈을 때,
    // 이 방의 다른 멤버들(교사, 기사 등)의 앱 수신함(ParentMessage)으로 자동 전달!
    try {
      if (room && room.members) {
        const isSenderAdmin = user.role === 'ACADEMY_ADMIN' || user.role === 'SUPER_ADMIN';
        const isDirect = room.type === ChatRoomType.DIRECT || room.members.length <= 2;
        const prefix = isSenderAdmin
          ? (isDirect ? '[원장님 1:1 개인 메세지]' : '[원장님 공지]')
          : `[${user.name || '알림'}]`;

        for (const m of room.members) {
          if (m.user && m.user.id !== user.id) {
            const receiverRole = m.user.role || '';
            const targetRoles: string[] = [String(receiverRole)];
            if (
              receiverRole.includes('TEACHER') ||
              receiverRole === 'HOMEROOM_TEACHER' ||
              receiverRole === 'SHUTTLE_TEACHER'
            ) {
              targetRoles.push('TEACHER', 'HOMEROOM_TEACHER', 'SHUTTLE_TEACHER');
            }

            const pMsg = this.parentMessageRepo.create({
              receiverUser: m.user,
              targetRoles: targetRoles,
              message: `${prefix} ${text.trim()}`,
              isRead: false,
            });
            await this.parentMessageRepo.save(pMsg);
          }
        }
      }
    } catch (bridgeErr) {
      console.warn('[ChatService] ParentMessage sync error:', bridgeErr);
    }

    return fullMessage;
  }

  // ============================================================
  // 결재 및 탑승 신청 관련 메서드
  // ============================================================

  async getPaymentContext(academyId?: number, userEmail?: string) {
    let aId = academyId;
    if (!aId && userEmail) {
      const u = await this.userRepo.findOne({ where: { email: userEmail } });
      if (u?.academyId) aId = u.academyId;
    }

    if (!aId) {
      return { vehicles: [], students: [], pickupPoints: [] };
    }

    const vehicles = await this.vehicleRepo.find({
      where: { academy: { id: aId } },
      relations: { driverUser: true, teacherUser: true },
    });

    const students = await this.studentRepo.find({
      where: { academy: { id: aId } },
      relations: { assignedVehicle: true, parentUser: true },
    });

    const pickupPoints = await this.pickupPointRepo.find({
      where: { academy: { id: aId } },
    });

    return {
      vehicles: vehicles.map(v => ({
        id: v.id,
        busNumber: v.busNumber,
        driverName: v.driverUser?.name || v.driverName || '기사님',
        driverPhone: v.driverPhone,
        teacherName: v.teacherUser?.name || v.teacherName || '차량선생님',
        teacherPhone: v.teacherPhone,
        colorHex: v.colorHex || '#3b82f6',
      })),
      students: students.map(s => {
        let raw: any = {};
        if (typeof s.raw === 'string') {
          try { raw = JSON.parse(s.raw); } catch (e) {}
        } else if (typeof s.raw === 'object' && s.raw) {
          raw = s.raw;
        }
        return {
          id: s.id,
          name: s.adminDisplayName || s.name,
          address: s.address,
          boardingLocation: s.boardingLocation || s.address,
          lat: s.latitude,
          lng: s.longitude,
          assignedBusId: s.assignedVehicle?.id || null,
          assignedBusNumber: s.assignedVehicle?.busNumber || '미배정',
          className: raw.반 || raw['반명'] || raw.className || '',
          birthDate: raw.생년월일 || raw.birthDate || '',
          gender: raw.성별 || '',
          parentName: s.parentUser?.name || raw['보호자 성함'] || raw.보호자명 || raw.parentName || '',
          parentPhone: s.parentUser?.phone || raw['보호자연락처'] || raw.보호자연락처 || raw.parentPhone || '',
          allergies: s.allergies || raw.알레르기 || raw.allergies || '없음',
          dropoffLocation: raw.하차지 || raw.dropoffLocation || s.address || '',
          isNotRiding: s.isNotRiding,
          boardStatus: s.boardStatus,
        };
      }),
      pickupPoints: pickupPoints.map(p => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    };
  }

  async getPaymentRequests(academyId?: number) {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.room', 'room')
      .leftJoinAndSelect('m.sender', 'sender')
      .where("m.type = 'PAYMENT_REQUEST'");

    if (academyId) {
      qb.andWhere('(room.academyId = :aId OR room.academyId IS NULL)', { aId: Number(academyId) });
    }

    const messages = await qb.orderBy('m.createdAt', 'DESC').getMany();

    return messages.map((m) => {
      const payload = m.payload || {};
      return {
        id: m.id,
        messageId: m.id,
        ...payload,
        senderName: m.sender?.name || m.sender?.email,
        senderEmail: m.sender?.email,
        createdAt: m.createdAt,
      };
    });
  }

  async createPaymentRequest(
    data: {
      roomId?: number;
      studentId?: number;
      studentName?: string;
      vehicleId?: number;
      rideType?: 'TODAY_ONLY' | 'REGULAR';
      boardingLocation: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      requestDate?: string;
      note?: string;
    },
    requesterEmail: string,
  ) {
    if (!requesterEmail) throw new BadRequestException('신청자 정보가 필요합니다.');
    const requester = await this.userRepo.findOne({ where: { email: requesterEmail } });
    if (!requester) throw new BadRequestException('신청자 계정을 찾을 수 없습니다.');

    // 학부모는 결재 신청 불가
    if (requester.role === UserRole.PARENT) {
      throw new ForbiddenException('학부모 계정은 결재 신청 기능을 이용할 수 없습니다.');
    }

    let vehicle: Vehicle | null = null;
    if (data.vehicleId) {
      vehicle = await this.vehicleRepo.findOne({
        where: { id: Number(data.vehicleId) },
        relations: { teacherUser: true, driverUser: true, academy: true },
      });
    }

    if (!vehicle) {
      throw new BadRequestException('결재 신청을 위한 지정 차량을 찾을 수 없습니다.');
    }

    if (vehicle?.academy?.id && requester.academyId && vehicle.academy.id !== requester.academyId) {
      throw new ForbiddenException('다른 유치원의 차량에는 신청할 수 없습니다.');
    }

    const targetAcademyId = vehicle?.academy?.id || requester.academyId;

    let studentName = data.studentName;
    let studentObj: Student | null = null;
    let studentRaw: any = {};
    if (data.studentId) {
      studentObj = await this.studentRepo.findOne({
        where: { id: Number(data.studentId) },
        relations: { parentUser: true, assignedVehicle: true },
      });
    } else if (studentName && targetAcademyId) {
      const trimmedName = String(studentName).trim();
      const candidates = await this.studentRepo.find({
        where: { academy: { id: targetAcademyId } },
        relations: { parentUser: true, assignedVehicle: true },
      });
      studentObj =
        candidates.find(
          (c) =>
            c.name === trimmedName ||
            c.adminDisplayName === trimmedName ||
            (c.name && c.name.split('/')[0].trim() === trimmedName),
        ) || null;
    }

    if (studentObj) {
      studentName = studentObj.adminDisplayName || studentObj.name;
      if (typeof studentObj.raw === 'string') {
        try { studentRaw = JSON.parse(studentObj.raw); } catch (e) {}
      } else if (typeof studentObj.raw === 'object' && studentObj.raw) {
        studentRaw = studentObj.raw;
      }
    }

    const resolvedStudentId = data.studentId ? Number(data.studentId) : studentObj?.id;
    if (resolvedStudentId) {
      // Check if an active payment request already exists for this student (중복 신청 방지 원아 락)
      const recentRequests = await this.messageRepo.find({
        where: { type: 'PAYMENT_REQUEST' },
        order: { id: 'DESC' },
        take: 200,
      });
      const existingPending = recentRequests.find((m) => {
        let p: any = m.payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { p = null; }
        }
        return (
          p &&
          String(p.studentId) === String(resolvedStudentId) &&
          ['PENDING', 'RE_REQUESTED'].includes(p.status)
        );
      });

      if (existingPending) {
        let p: any = existingPending.payload;
        if (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { p = {}; }
        }
        const reqName = p?.requesterName || '다른 교직원';
        const reqStatus = p?.status === 'RE_REQUESTED' ? '새 위치 제안 검토 중' : '승인 대기 중';
        throw new BadRequestException(
          `이미 해당 원아(${studentName})에 대한 결제/탑승 승인 요청이 진행 중입니다. (신청자: ${reqName}, 상태: ${reqStatus})`
        );
      }
    }
    studentName = studentName || '신규 원생';

    // 결재를 진행할 1:1 또는 그룹 대화방 찾기
    let targetRoom: ChatRoom | null = null;
    if (data.roomId) {
      targetRoom = await this.roomRepo.findOne({
        where: { id: Number(data.roomId) },
        relations: { members: { user: true } },
      });
    }

    if (!targetRoom && vehicle?.teacherUser?.id) {
      targetRoom = (await this.createRoomByEmail(
        undefined,
        'DIRECT',
        [requester.id, vehicle.teacherUser.id],
        requester.email,
      )) as ChatRoom;
    }

    if (!targetRoom) {
      const adminUser = await this.userRepo.findOne({
        where: {
          academyId: targetAcademyId || requester.academyId,
          role: In([UserRole.ACADEMY_ADMIN, UserRole.SUPER_ADMIN]),
        },
      });
      if (adminUser && adminUser.id !== requester.id) {
        targetRoom = (await this.createRoomByEmail(
          undefined,
          'DIRECT',
          [requester.id, adminUser.id],
          requester.email,
        )) as ChatRoom;
      }
    }

    if (!targetRoom) {
      throw new BadRequestException('결재를 진행할 1:1 또는 그룹 대화방을 찾을 수 없습니다.');
    }

    const rideType = data.rideType || 'TODAY_ONLY'; // 'TODAY_ONLY' | 'REGULAR'

    const payload = {
      studentId: data.studentId ? Number(data.studentId) : (studentObj?.id || null),
      studentName,
      className: studentRaw['반명'] || studentRaw.반 || studentRaw.className || '',
      parentName: studentObj?.parentUser?.name || studentRaw['보호자 성함'] || studentRaw.보호자명 || '',
      parentPhone: studentObj?.parentUser?.phone || studentRaw['보호자연락처'] || '',
      allergies: studentObj?.allergies || studentRaw.알레르기 || '',
      vehicleId: vehicle.id,
      busNumber: vehicle.busNumber,
      teacherName: vehicle.teacherUser?.name || vehicle.teacherName || '담당 차량선생님',
      teacherEmail: vehicle.teacherUser?.email || null,
      driverName: vehicle.driverUser?.name || vehicle.driverName || '기사님',
      isPublicContest: false,
      requestType: 'ONE_ON_ONE',
      targetTeacherId: vehicle.teacherUser?.id || null,
      targetTeacherEmail: vehicle.teacherUser?.email || null,
      targetTeacherName: vehicle.teacherUser?.name || vehicle.teacherName || '담당 차량선생님',
      requesterId: requester.id,
      requesterEmail: requester.email,
      requesterName: requester.name || requester.email,
      requesterRole: requester.role,
      boardingLocation: data.boardingLocation || '지정 탑승지',
      address: data.address || data.boardingLocation || '',
      latitude: data.latitude ? Number(data.latitude) : (studentObj?.latitude || vehicle?.academy?.latitude || 37.842),
      longitude: data.longitude ? Number(data.longitude) : (studentObj?.longitude || vehicle?.academy?.longitude || 127.123),
      locationType: (data as any).locationType || 'PIN',
      rideType,
      requestDate: data.requestDate || new Date().toISOString().split('T')[0],
      note: data.note || (rideType === 'TODAY_ONLY' ? '오늘 하루 하원 셔틀 탑승 희망 (익일 자동 픽업 원복)' : '정규 셔틀 탑승 및 구역 편입 희망'),
      status: 'PENDING',
    };

    const requestMsgText = rideType === 'TODAY_ONLY'
      ? `[당일 1회 탑승 신청] ${studentName} 원아 - ${vehicle.busNumber} 하원 탑승 요청 (내일 자동 원복)`
      : `[정규 셔틀 신청] ${studentName} 원아 - ${vehicle.busNumber} 정규 노선 편입 요청`;

    const message = this.messageRepo.create({
      room: targetRoom,
      sender: requester,
      text: requestMsgText,
      type: 'PAYMENT_REQUEST',
      payload,
      readBy: [requester.id],
    });

    const saved = await this.messageRepo.save(message);
    await this.roomRepo.update(targetRoom.id, { updatedAt: new Date() });

    // 학생 학부모에게 결재 신청 안내 발송
    if (studentObj?.parentUser) {
      const parentMsg = this.parentMessageRepo.create({
        student: studentObj,
        receiverUser: studentObj.parentUser,
        targetRoles: ['PARENT'],
        message: `[통학 셔틀 결재 신청 접수] ${studentName} 원아의 [${payload.busNumber}] ${rideType === 'TODAY_ONLY' ? '당일 탑승' : '정규 탑승'} 결재 신청이 접수되어 차량선생님 승인 대기 중입니다. (탑승 희망지: ${payload.boardingLocation})`,
      });
      await this.parentMessageRepo.save(parentMsg).catch(() => {});
    }

    // 결재 신청 알림: 공지사항 채널이 아니라 결재자(해당 차량 지도교사 + 기관 관리자)에게만 개인 알림
    try {
      const approverIds = new Set<number>();
      if (payload.vehicleId) {
        const targetVehicle = await this.vehicleRepo.findOne({
          where: { id: Number(payload.vehicleId) },
          relations: { teacherUser: true },
        });
        if (targetVehicle?.teacherUser?.id) approverIds.add(targetVehicle.teacherUser.id);
      }
      (await this.getAcademyAdminIds(targetAcademyId || null)).forEach(id => approverIds.add(id));
      approverIds.delete(requester.id);
      await this.sendSystemNotificationToUsers(
        Array.from(approverIds),
        '신규 결재 신청',
        `[신규 결재 신청] ${requester.name || requester.email}님이 ${studentName} 원아의 [${payload.busNumber}] 탑승 결재를 신청하였습니다. (탑승지: ${payload.boardingLocation})`,
        {
          type: 'change_request',
          metadata: { type: 'change_request', messageId: saved.id, roomId: targetRoom.id },
        },
      );
    } catch (notiErr) {
      console.error('[ChatService] 결재 신청 개인 알림 오류:', notiErr);
    }

    const fullMessage = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });

    if (fullMessage) {
      await this.broadcastToRoom(targetRoom.id, fullMessage);
    }

    return fullMessage;
  }

  async decidePaymentRequest(
    messageId: number,
    decision: 'APPROVED' | 'REJECTED',
    decidedByEmail: string,
    vehicleId?: number,
  ) {
    if (!decidedByEmail) throw new BadRequestException('승인자 정보가 필요합니다.');
    const decider = await this.userRepo.findOne({ where: { email: decidedByEmail } });
    if (!decider) throw new BadRequestException('승인자 계정을 찾을 수 없습니다.');

    // 학부모는 승인 또는 거절 권한 없음
    if (decider.role === UserRole.PARENT) {
      throw new ForbiddenException('학부모 계정은 결재 승인/거절 권한이 없습니다.');
    }

    const message = await this.messageRepo.findOne({
      where: { id: Number(messageId) },
      relations: { room: true, sender: true },
    });
    if (!message || message.type !== 'PAYMENT_REQUEST') {
      throw new BadRequestException('결재 신청 메시지를 찾을 수 없습니다.');
    }

    if (decider.role !== UserRole.SUPER_ADMIN && message.room?.academyId && decider.academyId && message.room.academyId !== decider.academyId) {
      throw new ForbiddenException('다른 유치원의 결재 신청을 처리할 수 없습니다.');
    }

    const payload = message.payload || {};

    // 1. 이미 결재 완료된 건 추가 결재 차단
    if (payload.status && payload.status !== 'PENDING' && payload.status !== 'RE_REQUESTED') {
      const alreadyDecidedBy = payload.decidedBy || '다른 담당자';
      const alreadyDecidedBus = payload.busNumber || '';
      throw new BadRequestException(
        `이미 ${alreadyDecidedBy} 차량선생님에 의해 결재가 완료되었습니다. (${alreadyDecidedBus}) 추가 결재가 불가능합니다.`
      );
    }

    // 2. 자가 승인 금지: 신청자 본인은 자신이 올린 결재 건을 결재할 수 없음
    const isRequester =
      (message.sender && message.sender.id === decider.id) ||
      (payload.requesterEmail && payload.requesterEmail.toLowerCase() === decider.email.toLowerCase()) ||
      (payload.requesterId && Number(payload.requesterId) === decider.id);

    if (isRequester) {
      throw new ForbiddenException(
        '본인이 직접 신청한 결재 건은 본인이 결재할 수 없습니다. 상대방(담당 차량선생님 또는 원장님)만 결재 가능합니다.'
      );
    }

    // 3. 1:1 결재 시 상대방(지정된 차량선생님 또는 관리자)만 결재 가능
    const isAdmin = decider.role === UserRole.ACADEMY_ADMIN || decider.role === UserRole.SUPER_ADMIN;
    const isDesignatedTeacher =
      (payload.targetTeacherId && Number(payload.targetTeacherId) === decider.id) ||
      (payload.targetTeacherEmail && payload.targetTeacherEmail.toLowerCase() === decider.email.toLowerCase()) ||
      (payload.teacherEmail && payload.teacherEmail.toLowerCase() === decider.email.toLowerCase());

    if (!isDesignatedTeacher && !isAdmin) {
      throw new ForbiddenException('해당 1:1 결재 건은 지정된 담당 차량선생님 또는 원장님만 결재할 수 있습니다.');
    }

    if (decision === 'APPROVED') {
      // 4. 차량 결정 및 배정
      let vehicle: Vehicle | null = null;
      if (vehicleId) {
        vehicle = await this.vehicleRepo.findOne({
          where: { id: Number(vehicleId) },
          relations: { academy: true, teacherUser: true, driverUser: true },
        });
      } else if (payload.vehicleId) {
        vehicle = await this.vehicleRepo.findOne({
          where: { id: Number(payload.vehicleId) },
          relations: { academy: true, teacherUser: true, driverUser: true },
        });
      }

      if (!vehicle) {
        throw new BadRequestException('배정할 통학 차량을 찾을 수 없습니다. 배정 차량을 지정해주세요.');
      }

      let student: Student | null = null;
      if (payload.studentId) {
        student = await this.studentRepo.findOne({
          where: { id: Number(payload.studentId) },
          relations: { academy: true },
        });
      }

      const academy = vehicle.academy || (await this.academyRepo.findOne({ where: { id: decider.academyId } }));

      if (!student && payload.studentName && academy?.id) {
        const trimmedName = String(payload.studentName).trim();
        const candidates = await this.studentRepo.find({
          where: { academy: { id: academy.id } },
          relations: { academy: true },
        });
        student =
          candidates.find(
            (c) =>
              c.name === trimmedName ||
              c.adminDisplayName === trimmedName ||
              (c.name && c.name.split('/')[0].trim() === trimmedName),
          ) || null;
      }

      const finalLocation = payload.counterProposal?.suggestedLocation || payload;
      const finalLat = Number(finalLocation.latitude || payload.latitude);
      const finalLng = Number(finalLocation.longitude || payload.longitude);
      const finalBoardingLocation = finalLocation.boardingLocation || payload.boardingLocation;
      const finalAddress = finalLocation.address || payload.address || finalBoardingLocation;

      if (!student) {
        student = this.studentRepo.create({
          name: payload.studentName,
          adminDisplayName: payload.studentName,
          address: finalAddress,
          boardingLocation: finalBoardingLocation,
          latitude: finalLat,
          longitude: finalLng,
          academy: academy || undefined,
          approvalStatus: 'APPROVED',
        });
      }

      const isTodayOnly = (payload.rideType || 'TODAY_ONLY') === 'TODAY_ONLY';
      const todayStr = new Date().toISOString().split('T')[0];

      let rawObj = student.raw;
      if (typeof rawObj === 'string') {
        try { rawObj = JSON.parse(rawObj); } catch(e) { rawObj = {}; }
      }
      if (!rawObj || typeof rawObj !== 'object') rawObj = {};

      if (isTodayOnly) {
        // Backup original state before temporary ride
        rawObj.isTemporaryRide = true;
        rawObj.temporaryRideDate = todayStr;
        if (rawObj.originalIsNotRiding === undefined) {
          rawObj.originalIsNotRiding = student.isNotRiding;
        }
        if (rawObj.originalBoardingLocation === undefined) {
          rawObj.originalBoardingLocation = student.boardingLocation || null;
        }
        rawObj['하차지'] = finalBoardingLocation;
      } else {
        // Regular ride: clear temporary ride flags
        rawObj.isTemporaryRide = false;
        delete rawObj.temporaryRideDate;
        delete rawObj.originalIsNotRiding;
        delete rawObj.originalBoardingLocation;
      }
      student.raw = rawObj;

      student.assignedVehicle = vehicle;
      student.boardingLocation = finalBoardingLocation;
      student.address = finalAddress;
      if (finalLat) student.latitude = finalLat;
      if (finalLng) student.longitude = finalLng;
      student.approvalStatus = 'APPROVED';
      student.isNotRiding = false;
      student.boardStatus = 'WAITING';
      const savedStudent = await this.studentRepo.save(student);

      // Sync student_schedules
      await this.studentRepo.query(
        `UPDATE student_schedules SET "assignedVehicleId" = $1 WHERE "studentId" = $2`,
        [vehicle.id, savedStudent.id],
      ).catch(() => {});

      // 2. Expand Vehicle Zone Polygon (정규 셔틀 등록인 경우에만 구역 영구 확장)
      if (!isTodayOnly) {
        try {
          const busStudents = await this.studentRepo.find({
            where: { assignedVehicle: { id: vehicle.id } },
          });
          const points: [number, number][] = [];
          for (const bs of busStudents) {
            if (bs.latitude && bs.longitude) {
              points.push([Number(bs.latitude), Number(bs.longitude)]);
            }
          }
          if (payload.latitude && payload.longitude) {
            points.push([Number(payload.latitude), Number(payload.longitude)]);
          }

          const expandedPolygon = this.routingService.generateZonePolygon(points);
          if (expandedPolygon && expandedPolygon.length >= 3) {
            vehicle.polygonCoordinates = JSON.stringify(expandedPolygon);
            await this.vehicleRepo.save(vehicle);
          }
        } catch (err) {
          console.error('Zone polygon expansion error:', err);
        }
      }

      // 3. Notify Route Updated (노선에 자동 반영)
      const targetAcadId = vehicle.academy?.id || student.academy?.id || decider.academyId;
      if (targetAcadId) {
        const updateTitle = isTodayOnly
          ? `[당일 임시 탑승 승인] ${payload.studentName} 원아가 오늘 하루 ${vehicle.busNumber} 노선에 추가되었습니다. (내일 자동 원복)`
          : `[정규 셔틀 탑승 승인] ${payload.studentName} 원아가 ${vehicle.busNumber} 정규 노선에 등록되었습니다.`;
        this.routingService.notifyRouteUpdated(targetAcadId, updateTitle);
      }

      // 4. Update Message Payload
      payload.status = 'APPROVED';
      payload.decidedBy = decider.name || decider.email;
      payload.decidedAt = new Date().toISOString();
      payload.vehicleId = vehicle.id;
      payload.busNumber = vehicle.busNumber;
      payload.teacherName = formatTeacherName(decider.name || vehicle.teacherUser?.name) || '차량선생님';
      payload.teacherEmail = decider.email;
      payload.driverName = vehicle.driverUser?.name || vehicle.driverName || '기사님';

      message.payload = payload;
      await this.messageRepo.save(message);

      // 5. Send automated confirmation chat message in the room
      const isCounterApproved = Boolean(payload.counterProposal);
      let confText = '';
      if (isCounterApproved) {
        confText = `✓ [재결재 수락 완료] 차량선생님 제안 탑승지(${finalBoardingLocation})로 최종 승인되었습니다. (${payload.studentName} 원아 -> ${payload.busNumber}, ${isTodayOnly ? '오늘 하루 탑승' : '정규 등록'})`;
      } else {
        confText = isTodayOnly
          ? `✓ [당일 탑승 수락 완료] 오늘 하루만 ${payload.studentName} 원아가 ${payload.busNumber}에 임시 탑승합니다. (익일 자정 픽업으로 자동 원복, 담당: ${decider.name || '선생님'})`
          : `✓ [정규 셔틀 등록 완료] ${payload.studentName} 원아가 ${payload.busNumber} 정규 운행 구역 및 노선에 편입되었습니다. (담당: ${decider.name || '선생님'})`;
      }

      const confirmationMsg = this.messageRepo.create({
        room: message.room,
        sender: decider,
        text: confText,
        type: 'TEXT',
        readBy: [decider.id],
      });
      const savedConf = await this.messageRepo.save(confirmationMsg);

      await this.broadcastToRoom(message.room.id, message);
      await this.broadcastToRoom(message.room.id, savedConf);

      const notifyTitle = '결재 승인 완료 알림';
      const notifyText = `[결재 승인 완료] ${payload.studentName} 원아의 [${vehicle.busNumber}] ${isTodayOnly ? '당일 임시' : '정규'} 탑승 결재가 ${formatTeacherName(decider.name)} 차량선생님에 의해 최종 승인 완료되었습니다. (탑승지: ${finalBoardingLocation})`;

      // 결재 결과: 공지사항 채널이 아니라 신청자에게만 개인 알림 (학부모에게는 아래 pushParentNotification 이 따로 안내)
      if (message.sender?.id && message.sender.id !== decider.id) {
        await this.sendSystemNotificationToUser(message.sender.id, notifyTitle, notifyText, {
          type: 'change_request',
          metadata: { type: 'change_request', messageId: message.id, roomId: message.room.id },
        }).catch(() => {});
      }

      // 6. Automatically push notification to parent
      try {
        await this.pushParentNotification(message.id, decider.email);
      } catch (err) {
        console.error('Auto push parent notification error:', err);
      }
    } else {
      // REJECTED
      payload.status = 'REJECTED';
      payload.decidedBy = decider.name || decider.email;
      payload.decidedAt = new Date().toISOString();
      message.payload = payload;
      await this.messageRepo.save(message);

      const rejectMsg = this.messageRepo.create({
        room: message.room,
        sender: decider,
        text: `✕ [결재 반려] ${payload.studentName} 원아의 탑승 요청이 반려되었습니다. (처리: ${formatTeacherName(decider.name)})`,
        type: 'TEXT',
        readBy: [decider.id],
      });
      const savedReject = await this.messageRepo.save(rejectMsg);

      await this.broadcastToRoom(message.room.id, message);
      await this.broadcastToRoom(message.room.id, savedReject);

      const targetAcadId = payload.vehicleId ? (await this.vehicleRepo.findOne({ where: { id: payload.vehicleId } }))?.academy?.id : decider.academyId;
      // 결재 결과: 공지사항 채널이 아니라 신청자와 그 원아의 학부모에게만 개인 알림
      const rejectText = `[결재 반려] ${payload.studentName} 원아의 탑승 요청이 ${formatTeacherName(decider.name)} 차량선생님에 의해 반려되었습니다.`;
      const rejectTargets = new Set<number>();
      if (message.sender?.id && message.sender.id !== decider.id) rejectTargets.add(message.sender.id);
      if (payload.studentId) {
        (await this.getStudentRelatedUserIds(Number(payload.studentId), ['PARENT'])).forEach(id => rejectTargets.add(id));
      }
      await this.sendSystemNotificationToUsers(Array.from(rejectTargets), '결재 반려 알림', rejectText, {
        type: 'change_request',
        metadata: { type: 'change_request', messageId: message.id, roomId: message.room.id },
      }).catch(() => {});
    }

    return message;
  }

  async reRequestPayment(
    messageId: number,
    data: {
      suggestedLocation: {
        boardingLocation: string;
        address?: string;
        latitude: number;
        longitude: number;
      };
      note: string;
    },
    proposerEmail: string,
  ) {
    if (!proposerEmail) throw new BadRequestException('제안자 정보가 필요합니다.');
    const proposer = await this.userRepo.findOne({ where: { email: proposerEmail } });
    if (!proposer) throw new BadRequestException('제안자 계정을 찾을 수 없습니다.');

    if (proposer.role === UserRole.PARENT) {
      throw new ForbiddenException('학부모 계정은 재결재 요청 권한이 없습니다.');
    }

    const message = await this.messageRepo.findOne({
      where: { id: Number(messageId) },
      relations: { room: true, sender: true },
    });
    if (!message || message.type !== 'PAYMENT_REQUEST') {
      throw new BadRequestException('결재 신청 메시지를 찾을 수 없습니다.');
    }

    if (message.payload?.status && message.payload.status === 'APPROVED') {
      throw new BadRequestException('이미 승인 완료된 결제 건은 위치를 변경할 수 없습니다.');
    }

    const payload = message.payload || {};
    const originalLocation = {
      boardingLocation: payload.boardingLocation || '원장 지정 탑승지',
      address: payload.address || payload.boardingLocation || '',
      latitude: Number(payload.latitude) || 37.842,
      longitude: Number(payload.longitude) || 127.123,
    };

    const suggested = data.suggestedLocation || {};
    const newLat = Number(suggested.latitude) || originalLocation.latitude;
    const newLng = Number(suggested.longitude) || originalLocation.longitude;
    const newBoardingLocation = suggested.boardingLocation || '차량선생님 제안 탑승지';
    const newAddress = suggested.address || newBoardingLocation;

    payload.status = 'RE_REQUESTED';
    payload.counterProposal = {
      originalLocation,
      suggestedLocation: {
        boardingLocation: newBoardingLocation,
        address: newAddress,
        latitude: newLat,
        longitude: newLng,
      },
      note: data.note || '운행 편의 및 안전을 위해 탑승 위치 변경을 제안합니다.',
      proposedBy: proposer.name || proposer.email,
      proposedAt: new Date().toISOString(),
    };

    // Update target coordinates to suggested ones
    payload.boardingLocation = newBoardingLocation;
    payload.address = newAddress;
    payload.latitude = newLat;
    payload.longitude = newLng;
    payload.counterNote = data.note;
    payload.counterProposedBy = proposer.name || proposer.email;

    message.payload = payload;
    message.text = `[탑승지 변경 재결재 요청] ${payload.studentName} 원아 - ${payload.busNumber} 탑승 위치 수정 제안`;
    await this.messageRepo.save(message);

    // Send notification chat message in the room
    const notifyMsg = this.messageRepo.create({
      room: message.room,
      sender: proposer,
      text: `🔄 [탑승지 변경 재결재 요청] ${payload.studentName} 원아 탑승지를 ${proposer.name} 차량선생님이 수정 제안하였습니다.\n(사유: ${data.note || '위치 변경'})`,
      type: 'TEXT',
      readBy: [proposer.id],
    });
    const savedNotify = await this.messageRepo.save(notifyMsg);

    await this.broadcastToRoom(message.room.id, message);
    await this.broadcastToRoom(message.room.id, savedNotify);

    return { success: true, message };
  }

  async pushParentNotification(messageId: number, senderEmail?: string) {
    const message = await this.messageRepo.findOne({
      where: { id: Number(messageId) },
      relations: { room: true },
    });
    if (!message || message.type !== 'PAYMENT_REQUEST') {
      throw new BadRequestException('결재 신청 메시지를 찾을 수 없습니다.');
    }

    const payload = message.payload || {};
    const studentId = payload.studentId;
    if (!studentId) {
      throw new BadRequestException('연결된 원아 정보가 없습니다.');
    }

    const student = await this.studentRepo.findOne({
      where: { id: Number(studentId) },
      relations: { parentUser: true, assignedVehicle: true },
    });
    if (!student) {
      throw new BadRequestException('원아를 찾을 수 없습니다.');
    }

    const finalLocation = payload.counterProposal?.suggestedLocation?.boardingLocation || payload.boardingLocation || student.boardingLocation || '지정 하차지';
    const busName = payload.busNumber || student.assignedVehicle?.busNumber || '셔틀 차량';
    const teacherName = payload.teacherName || '담당 차량선생님';
    const isTodayOnly = (payload.rideType || 'TODAY_ONLY') === 'TODAY_ONLY';

    let notiText = '';
    if (payload.status === 'RE_REQUESTED' || payload.counterProposal) {
      const reason = payload.counterProposal?.note || '안전 승하차 위치 조정';
      notiText = `[통학 셔틀 하차지 안내] 오늘 ${student.adminDisplayName || student.name} 원아는 [${busName}]을(를) 이용하여 [${finalLocation}]에서 하차합니다. (사유: ${reason}, 차량선생님: ${teacherName})`;
    } else {
      notiText = isTodayOnly
        ? `[오늘 하원 셔틀 안내] 오늘 ${student.adminDisplayName || student.name} 원아가 [${busName}]에 임시 탑승하여 [${finalLocation}]에서 하차할 예정입니다. (차량선생님: ${teacherName})`
        : `[정규 셔틀 탑승 안내] ${student.adminDisplayName || student.name} 원아가 [${busName}] 정규 셔틀을 이용하며 [${finalLocation}]에서 하차 예정입니다. (차량선생님: ${teacherName})`;
    }

    // 1. Create ParentMessage
    if (student.parentUser) {
      const parentMsg = this.parentMessageRepo.create({
        student,
        receiverUser: student.parentUser,
        targetRoles: ['PARENT'],
        message: notiText,
      });
      await this.parentMessageRepo.save(parentMsg);
    }

    // 2. Create Vehicle Notification
    const vehicle = student.assignedVehicle || (payload.vehicleId ? await this.vehicleRepo.findOne({ where: { id: Number(payload.vehicleId) } }) : null);
    if (vehicle) {
      const vNoti = this.notificationRepo.create({
        vehicle,
        message: notiText,
      });
      await this.notificationRepo.save(vNoti);
    }

    // 3. Mark parentPushedAt on payment message
    payload.parentPushedAt = new Date().toISOString();
    payload.parentPushText = notiText;
    message.payload = payload;
    await this.messageRepo.save(message);

    // 4. Broadcast updated message
    if (message.room) {
      await this.broadcastToRoom(message.room.id, message);
    }

    return {
      success: true,
      message: '학부모 알림 푸시가 성공적으로 전송되었습니다.',
      pushedAt: payload.parentPushedAt,
      pushText: notiText,
      hasParentAccount: !!student.parentUser,
    };
  }

  async uploadChatMedia(data: { base64Data: string; filename?: string; mimeType?: string }, reqHost?: string) {
    if (!data.base64Data) {
      throw new BadRequestException('업로드할 이미지 데이터가 없습니다.');
    }

    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');

    let base64String = data.base64Data;
    let ext = '';
    let detectedMime = 'image/jpeg';

    if (base64String.includes(';base64,')) {
      const parts = base64String.split(';base64,');
      const mime = parts[0].replace('data:', '');
      detectedMime = mime;
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      base64String = parts[1];
    } else if (data.mimeType) {
      detectedMime = data.mimeType;
      if (data.mimeType.includes('png')) ext = 'png';
      else if (data.mimeType.includes('webp')) ext = 'webp';
      else if (data.mimeType.includes('gif')) ext = 'gif';
      else if (data.mimeType.includes('jpeg') || data.mimeType.includes('jpg')) ext = 'jpg';
    }

    if (!ext && data.filename) {
      const fileExt = path.extname(data.filename).toLowerCase().replace('.', '');
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt)) {
        ext = fileExt === 'jpeg' ? 'jpg' : fileExt;
        if (ext === 'png') detectedMime = 'image/png';
        else if (ext === 'webp') detectedMime = 'image/webp';
        else if (ext === 'gif') detectedMime = 'image/gif';
        else detectedMime = 'image/jpeg';
      }
    }

    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      ext = 'jpg';
    }

    const buffer = Buffer.from(base64String, 'base64');
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException('파일 크기는 15MB를 초과할 수 없습니다.');
    }

    const randomName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'uploads', 'chat');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, randomName);
    fs.writeFileSync(filePath, buffer);

    const host = reqHost || '52.63.245.203.sslip.io';
    const protocol = (host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':3000')) ? 'http' : 'https';
    const url = `${protocol}://${host}/uploads/chat/${randomName}`;

    return {
      success: true,
      url,
      filename: randomName,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
  }
}
