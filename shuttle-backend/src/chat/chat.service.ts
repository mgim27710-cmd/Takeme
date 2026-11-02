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
import { ChatGateway } from './chat.gateway';
import { RoutingService } from '../routing/routing.service';

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
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @Inject(forwardRef(() => RoutingService))
    private readonly routingService: RoutingService,
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
        const sub = u.assignedClass ? `${u.assignedClass} 담임` : teacherVehicleMap.get(u.id) || '유치원 교사';
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

    // 1. Ensure '결제 시스템 방' exists for the user's academy
    const targetAcademyId = user.academyId || null;
    let paymentSystemRoom = await this.roomRepo.findOne({
      where: {
        type: ChatRoomType.PAYMENT_SYSTEM,
        ...(targetAcademyId ? { academyId: targetAcademyId } : {}),
      },
      relations: { members: { user: true } },
    });

    if (!paymentSystemRoom) {
      paymentSystemRoom = this.roomRepo.create({
        name: '결제 시스템 방',
        type: ChatRoomType.PAYMENT_SYSTEM,
        academyId: targetAcademyId,
      });
      paymentSystemRoom = await this.roomRepo.save(paymentSystemRoom);
    }

    // Ensure user is member of paymentSystemRoom
    const isMember = (paymentSystemRoom.members || []).some(m => m.user?.id === userId);
    if (!isMember) {
      const member = this.memberRepo.create({
        room: paymentSystemRoom,
        user: { id: userId },
      });
      await this.memberRepo.save(member);
    }

    // 2. Fetch all rooms the user is a member of
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

    // 최신 메시지 또는 갱신 시간 기준 정렬 (단, 결제 시스템 방은 항상 최상단)
    rooms.sort((a: any, b: any) => {
      if (a.type === ChatRoomType.PAYMENT_SYSTEM) return -1;
      if (b.type === ChatRoomType.PAYMENT_SYSTEM) return 1;
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
    const roomType = isDirect ? ChatRoomType.DIRECT : ((type as any) || ChatRoomType.GROUP);

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
        if (r.members && r.members.length === 2 && r.type !== ChatRoomType.PAYMENT_SYSTEM) {
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
      type: roomType,
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
      type: 'TEXT',
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

  // ============================================================
  // 결제 및 탑승 신청 관련 메서드
  // ============================================================

  async getPaymentContext(academyId?: number, userEmail?: string) {
    let aId = academyId;
    if (!aId && userEmail) {
      const u = await this.userRepo.findOne({ where: { email: userEmail } });
      if (u?.academyId) aId = u.academyId;
    }

    const vehicleWhere = aId ? { academy: { id: aId } } : {};
    const vehicles = await this.vehicleRepo.find({
      where: vehicleWhere,
      relations: { driverUser: true, teacherUser: true },
    });

    const studentWhere = aId ? { academy: { id: aId } } : {};
    const students = await this.studentRepo.find({
      where: studentWhere,
      relations: { assignedVehicle: true },
    });

    const pickupWhere = aId ? { academy: { id: aId } } : {};
    const pickupPoints = await this.pickupPointRepo.find({
      where: pickupWhere,
    });

    return {
      vehicles: vehicles.map(v => ({
        id: v.id,
        busNumber: v.busNumber,
        driverName: v.driverUser?.name || v.driverName || '기사님',
        driverPhone: v.driverPhone,
        teacherName: v.teacherUser?.name || v.teacherName || '지도교사',
        teacherPhone: v.teacherPhone,
        colorHex: v.colorHex || '#3b82f6',
      })),
      students: students.map(s => ({
        id: s.id,
        name: s.adminDisplayName || s.name,
        address: s.address,
        boardingLocation: s.boardingLocation || s.address,
        lat: s.latitude,
        lng: s.longitude,
        assignedBusId: s.assignedVehicle?.id || null,
        assignedBusNumber: s.assignedVehicle?.busNumber || '미배정',
      })),
      pickupPoints: pickupPoints.map(p => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
    };
  }

  async createPaymentRequest(
    data: {
      studentId?: number;
      studentName?: string;
      vehicleId: number;
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

    // 학부모는 결제 신청 불가
    if (requester.role === UserRole.PARENT) {
      throw new ForbiddenException('학부모 계정은 결제 신청 기능을 이용할 수 없습니다.');
    }

    const vehicle = await this.vehicleRepo.findOne({
      where: { id: Number(data.vehicleId) },
      relations: { teacherUser: true, driverUser: true, academy: true },
    });
    if (!vehicle) throw new BadRequestException('지정된 차량을 찾을 수 없습니다.');

    let studentName = data.studentName;
    let studentObj: Student | null = null;
    if (data.studentId) {
      studentObj = await this.studentRepo.findOne({ where: { id: Number(data.studentId) } });
      if (studentObj) {
        studentName = studentObj.adminDisplayName || studentObj.name;
      }
    }
    studentName = studentName || '신규 원생';

    const targetAcademyId = vehicle.academy?.id || requester.academyId;

    // 결제 시스템 방 찾기 또는 생성
    let sysRoom = await this.roomRepo.findOne({
      where: {
        type: ChatRoomType.PAYMENT_SYSTEM,
        ...(targetAcademyId ? { academyId: targetAcademyId } : {}),
      },
      relations: { members: { user: true } },
    });

    if (!sysRoom) {
      sysRoom = this.roomRepo.create({
        name: '결제 시스템 방',
        type: ChatRoomType.PAYMENT_SYSTEM,
        academyId: targetAcademyId || null,
      });
      sysRoom = await this.roomRepo.save(sysRoom);
    }

    const payload = {
      studentId: data.studentId ? Number(data.studentId) : (studentObj?.id || null),
      studentName,
      vehicleId: vehicle.id,
      busNumber: vehicle.busNumber,
      teacherName: vehicle.teacherUser?.name || vehicle.teacherName || '담당 지도교사',
      teacherEmail: vehicle.teacherUser?.email || null,
      driverName: vehicle.driverUser?.name || vehicle.driverName || '기사님',
      boardingLocation: data.boardingLocation || '지정 탑승지',
      address: data.address || data.boardingLocation || '',
      latitude: data.latitude ? Number(data.latitude) : (studentObj?.latitude || vehicle.academy?.latitude || 37.842),
      longitude: data.longitude ? Number(data.longitude) : (studentObj?.longitude || vehicle.academy?.longitude || 127.123),
      requestDate: data.requestDate || new Date().toISOString().split('T')[0],
      note: data.note || '이 학생이 탑승을 하고 싶어 하는데 기존에 있던 곳에서 탑승하게 할까요',
      status: 'PENDING',
      requesterName: requester.name || requester.email,
      requesterRole: requester.role,
    };

    const message = this.messageRepo.create({
      room: sysRoom,
      sender: requester,
      text: `[신규 탑승 및 결제 신청] ${studentName} 원아 - ${vehicle.busNumber} 탑승 요청`,
      type: 'PAYMENT_REQUEST',
      payload,
      readBy: [requester.id],
    });

    const saved = await this.messageRepo.save(message);
    await this.roomRepo.update(sysRoom.id, { updatedAt: new Date() });

    const fullMessage = await this.messageRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });

    if (fullMessage) {
      this.chatGateway.broadcastMessageToRoom(sysRoom.id, fullMessage);
    }

    return fullMessage;
  }

  async decidePaymentRequest(
    messageId: number,
    decision: 'APPROVED' | 'REJECTED',
    decidedByEmail: string,
  ) {
    if (!decidedByEmail) throw new BadRequestException('승인자 정보가 필요합니다.');
    const decider = await this.userRepo.findOne({ where: { email: decidedByEmail } });
    if (!decider) throw new BadRequestException('승인자 계정을 찾을 수 없습니다.');

    // 학부모는 승인 또는 거절 권한 없음
    if (decider.role === UserRole.PARENT) {
      throw new ForbiddenException('학부모 계정은 결제 수락/거절 권한이 없습니다.');
    }

    const message = await this.messageRepo.findOne({
      where: { id: Number(messageId) },
      relations: { room: true, sender: true },
    });
    if (!message || message.type !== 'PAYMENT_REQUEST') {
      throw new BadRequestException('결제 신청 메시지를 찾을 수 없습니다.');
    }

    if (message.payload?.status && message.payload.status !== 'PENDING') {
      throw new BadRequestException('이미 처리가 완료된 결제 신청 건입니다.');
    }

    const payload = message.payload || {};

    if (decision === 'APPROVED') {
      // 1. Assign student to vehicle
      const vehicle = await this.vehicleRepo.findOne({
        where: { id: Number(payload.vehicleId) },
        relations: { academy: true },
      });
      if (!vehicle) throw new BadRequestException('지정된 차량을 찾을 수 없습니다.');

      let student: Student | null = null;
      if (payload.studentId) {
        student = await this.studentRepo.findOne({
          where: { id: Number(payload.studentId) },
          relations: { academy: true },
        });
      }

      if (!student) {
        const academy = vehicle.academy || (await this.academyRepo.findOne({ where: { id: decider.academyId } }));
        student = this.studentRepo.create({
          name: payload.studentName,
          adminDisplayName: payload.studentName,
          address: payload.address || payload.boardingLocation,
          boardingLocation: payload.boardingLocation,
          latitude: Number(payload.latitude),
          longitude: Number(payload.longitude),
          academy,
          approvalStatus: 'APPROVED',
        });
      }

      student.assignedVehicle = vehicle;
      student.boardingLocation = payload.boardingLocation;
      if (payload.latitude) student.latitude = Number(payload.latitude);
      if (payload.longitude) student.longitude = Number(payload.longitude);
      student.approvalStatus = 'APPROVED';
      const savedStudent = await this.studentRepo.save(student);

      // Sync student_schedules
      await this.studentRepo.query(
        `UPDATE student_schedules SET "assignedVehicleId" = $1 WHERE "studentId" = $2`,
        [vehicle.id, savedStudent.id],
      ).catch(() => {});

      // 2. Expand Vehicle Zone Polygon (해당 구역에 자동 포함)
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

      // 3. Notify Route Updated (노선에 자동 반영)
      const targetAcadId = vehicle.academy?.id || student.academy?.id || decider.academyId;
      if (targetAcadId) {
        this.routingService.notifyRouteUpdated(targetAcadId, `[탑승 승인] ${payload.studentName} 원아가 ${vehicle.busNumber} 노선에 추가되었습니다.`);
      }

      // 4. Update Message Payload
      payload.status = 'APPROVED';
      payload.decidedBy = decider.name || decider.email;
      payload.decidedAt = new Date().toISOString();
      message.payload = payload;
      await this.messageRepo.save(message);

      // 5. Send automated confirmation chat message in the room
      const confirmationMsg = this.messageRepo.create({
        room: message.room,
        sender: decider,
        text: `✓ [결제 수락 완료] ${payload.studentName} 원아가 ${payload.busNumber} 운행 구역 및 노선에 자동 배정되었습니다. (담당: ${decider.name || '선생님'})`,
        type: 'TEXT',
        readBy: [decider.id],
      });
      const savedConf = await this.messageRepo.save(confirmationMsg);

      this.chatGateway.broadcastMessageToRoom(message.room.id, message);
      this.chatGateway.broadcastMessageToRoom(message.room.id, savedConf);
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
        text: `✕ [결제 거절] ${payload.studentName} 원아의 탑승 요청이 반려되었습니다. (처리: ${decider.name || '선생님'})`,
        type: 'TEXT',
        readBy: [decider.id],
      });
      const savedReject = await this.messageRepo.save(rejectMsg);

      this.chatGateway.broadcastMessageToRoom(message.room.id, message);
      this.chatGateway.broadcastMessageToRoom(message.room.id, savedReject);
    }

    return { success: true, message };
  }
}
