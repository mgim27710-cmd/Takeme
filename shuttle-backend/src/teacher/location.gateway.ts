import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutingService } from '../routing/routing.service';
import { Vehicle } from '../entities/vehicle.entity';
import { Student } from '../entities/student.entity';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../auth/auth-user.decorator';

const SUPER_ADMIN_ROOM = 'super_admin';
const ADMIN_ROLES = new Set(['ACADEMY_ADMIN', 'DESK_STAFF']);
const STAFF_ROLES = new Set(['DRIVER', 'TEACHER', 'HOMEROOM_TEACHER', 'SHUTTLE_TEACHER']);
/** 원장·데스크 방: 신청 접수, 결재 결과 같은 관리 알림 */
const academyAdminRoom = (academyId: number) => `academy_admin_${academyId}`;
/** 교직원 방(원장·데스크·기사·교사): 노선 변경, 운행 상태, 출석 제출 */
const academyStaffRoom = (academyId: number) => `academy_staff_${academyId}`;

@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track active operating vehicles in memory: vehicleId -> isOperating
  public operatingVehicles: Map<number, boolean> = new Map();

  constructor(
    private readonly routingService: RoutingService,
    private readonly jwtService: JwtService,
    @InjectRepository(Vehicle) private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Student) private readonly studentRepository: Repository<Student>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    this.routingService.registerRouteUpdateNotifier((academyId, message) => {
      if (message) {
        this.broadcastTeacherPush(message, academyId);
      }
      this.broadcastRouteUpdated(academyId);
    });
  }

  afterInit(_server: Server) {
    // 노선 변경 알림은 생성자에서 등록한 notifier(교직원 방에만 전송)를 그대로 쓴다.
    // 예전에는 여기서 한 번 더 등록해(앞의 것을 덮어씀) 원아 이름이 담긴 메시지를 기관 전체(학부모 포함)로 보냈다.
  }

  /** 역할별 소켓 방에 넣는다. 원아 이름이 담긴 알림은 기관 전체 방이 아니라 이 방들로만 보낸다. */
  private joinRoleRooms(client: Socket, user?: JwtPayload | null) {
    if (!user) return;
    const role = String(user.role || '');
    if (role === 'SUPER_ADMIN') client.join(SUPER_ADMIN_ROOM);
    const academyId = user.academyId ? Number(user.academyId) : null;
    if (!academyId) return;
    if (ADMIN_ROLES.has(role)) client.join(academyAdminRoom(academyId));
    if (ADMIN_ROLES.has(role) || STAFF_ROLES.has(role)) client.join(academyStaffRoom(academyId));
  }

  /** 차량에 배정된 기사·지도교사 개인 방으로 보낸다(차량 방에는 학부모도 들어오므로 원아 정보는 보내지 않는다). */
  private async emitToVehicleStaff(vehicleId: number, event: string, payload: any) {
    if (!this.server || !vehicleId) return;
    const v = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
      relations: { driverUser: true, teacherUser: true },
    });
    const ids = [v?.driverUser?.id, v?.teacherUser?.id].filter(Boolean) as number[];
    for (const uid of new Set(ids)) {
      this.server.to(`user_${uid}`).emit(event, payload);
    }
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query?.token as string | undefined);
    client.data.allowedSend = new Set<number>();
    client.data.allowedJoin = new Set<number>();
    if (token) {
      try {
        client.data.user = await this.jwtService.verifyAsync<JwtPayload>(token);
        if (client.data.user?.sub) {
          client.join(`user_${client.data.user.sub}`);
        }
        if (client.data.user?.academyId) {
          client.join(`academy_${client.data.user.academyId}`);
        }
        this.joinRoleRooms(client, client.data.user);
      } catch {
        // Allow unauthenticated connection fallback so telemetry is not blocked
      }
    }
    console.log(`Client connected: ${client.id} (${client.data.user?.email ?? 'anonymous/manager'})`);

    // Send current operation status to the newly connected client
    const statusObj: Record<number, boolean> = {};
    this.operatingVehicles.forEach((val, key) => {
      statusObj[key] = val;
    });
    client.emit('allVehicleOperatingStatus', statusObj);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast operation status to vehicle room and academy room
   * (server.emit 전체 전송 금지 - 유치원 방 또는 차량 방에만 전송)
   */
  async broadcastOperationStatus(vehicleId: number, isOperating: boolean, busNumber?: string, targetAcademyId?: number) {
    this.operatingVehicles.set(vehicleId, isOperating);
    const room = `vehicle_${vehicleId}`;
    const payload = {
      vehicleId,
      busNumber,
      isOperating,
      timestamp: new Date().toISOString(),
    };
    if (this.server) {
      this.server.to(room).emit('vehicleOperatingStatus', payload);
      this.server.to(room).emit('notificationReceived', { type: 'SHUTTLE', payload });

      let academyId = targetAcademyId;
      if (!academyId) {
        const v = await this.vehicleRepository.findOne({ where: { id: vehicleId }, relations: { academy: true } });
        academyId = v?.academy?.id;
      }
      if (academyId) {
        // 기관 관제 화면(원장·교직원)용. 학부모는 자기 아이 차량 방으로만 받는다.
        this.server.to(academyStaffRoom(academyId)).emit('vehicleOperatingStatus', payload);
      }
    }
  }

  /**
   * Broadcast attendance submission ONLY to academy room: academy_{id}
   * (server.emit 전체 전송 금지)
   */
  broadcastAttendanceSubmitted(academyId: number, data: any) {
    if (!this.server || !academyId) return;
    this.server.to(academyStaffRoom(academyId)).emit('attendanceSubmitted', data);
  }

  /**
   * Broadcast change request creation to academy room: academy_{id}
   * (server.emit 전체 전송 금지)
   */
  broadcastChangeRequestCreated(academyId: number, data: any) {
    if (!this.server || !academyId) return;
    // 신청 처리 화면(원장·데스크)에만 보낸다. 담임·차량 관계자는 채팅 개인 알림으로 따로 받는다.
    this.server.to(academyAdminRoom(academyId)).emit('changeRequestCreated', data);

    const alertPayload = {
      id: data.id,
      category: data.type === 'ABSENCE' ? 'ABSENT' : data.type === 'ONE_TIME_BOARDING' ? 'SHUTTLE_REQUEST' : data.type === 'PICKUP' || data.type === 'INDIVIDUAL_DISMISSAL' ? 'PICKUP' : 'GENERAL',
      title: `[신청 접수] ${data.studentName} ${data.typeKr} 신청`,
      message: `${data.studentName} 원아의 ${data.typeKr} 신청이 접수되었습니다. (적용일: ${data.targetDate})`,
      timestamp: new Date().toISOString(),
      data,
    };
    this.server.to(academyAdminRoom(academyId)).emit('directorAlert', alertPayload);
    this.server.to(SUPER_ADMIN_ROOM).emit('globalDirectorAlert', alertPayload);
  }

  /**
   * Broadcast change request decision:
   * - to academy room: academy_{id}
   * - to vehicle room: vehicle_{vehicleId} (if vehicle involved)
   * - to user room: user_{parentUserId}
   * (server.emit 전체 전송 금지)
   */
  broadcastChangeRequestDecided(data: {
    academyId: number;
    vehicleId?: number;
    parentUserId?: number;
    request: any;
  }) {
    if (!this.server) return;
    if (data.academyId) {
      this.server.to(academyAdminRoom(data.academyId)).emit('changeRequestDecided', data.request);

      const studentName = data.request?.student?.adminDisplayName || data.request?.student?.name || '원아';
      const decisionKr = data.request?.decision === 'APPROVED' ? '승인' : '반려';
      const alertPayload = {
        id: data.request?.id,
        category: 'PAYMENT_DECISION',
        title: `[결재 ${decisionKr}] ${studentName} 신청 ${decisionKr}`,
        message: `${studentName} 원아의 통학 신청이 최종 ${decisionKr}되었습니다.`,
        timestamp: new Date().toISOString(),
        data: data.request,
      };
      this.server.to(academyAdminRoom(data.academyId)).emit('directorAlert', alertPayload);
      this.server.to(SUPER_ADMIN_ROOM).emit('globalDirectorAlert', alertPayload);
    }
    if (data.vehicleId) {
      // 경로 새로고침 신호(원아 정보 없음)만 차량 방에, 원아 이름이 담긴 내용은 그 차량 기사·지도교사에게만
      this.server.to(`vehicle_${data.vehicleId}`).emit('routeNeedsRefresh', { vehicleId: data.vehicleId });
      this.server.to(`vehicle_${data.vehicleId}`).emit('routeUpdated', { vehicleId: data.vehicleId });
      void this.emitToVehicleStaff(data.vehicleId, 'changeRequestDecided', data.request);
      void this.emitToVehicleStaff(data.vehicleId, 'notificationReceived', { type: 'SCHEDULE_CHANGE', request: data.request });
    }
    if (data.parentUserId) {
      this.server.to(`user_${data.parentUserId}`).emit('changeRequestDecided', data.request);
      this.server.to(`user_${data.parentUserId}`).emit('notificationReceived', { type: 'APPROVAL_RESULT', request: data.request });
    }
  }

  /**
   * 새 사진 업로드 알림 (기관 소켓 방 academy_{id})
   */
  broadcastMediaUploaded(academyId: number, mediaAsset: any) {
    if (!this.server || !academyId) return;
    this.server.to(`academy_${academyId}`).emit('mediaUploaded', mediaAsset);
  }

  /**
   * 사진 삭제 알림 (기관 소켓 방 academy_{id})
   */
  broadcastMediaDeleted(academyId: number, mediaId: number) {
    if (!this.server || !academyId) return;
    this.server.to(`academy_${academyId}`).emit('mediaDeleted', { id: mediaId });
  }

  /** 경로/탑승지/유치원 변경 알림 (해당 기관 방에만 전송) */
  broadcastRouteUpdated(academyId?: number) {
    if (this.server && academyId) {
      this.server.to(academyStaffRoom(academyId)).emit('routeUpdated', {
        academyId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** 원장 웹에서 탑승지 추가/삭제 시 지도교사에게 푸시 알림 전송 (해당 기관 방에만 전송) */
  broadcastTeacherPush(message: string, academyId?: number) {
    if (this.server && academyId) {
      this.server.to(academyStaffRoom(academyId)).emit('teacherPush', {
        message,
        academyId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /** 지도교사가 탑승 완료 후 기사 앱에 "출발하셔도 됩니다" 신호 전송 (해당 차량 방에만 전송) */
  broadcastDepartSignal(vehicleId: number, stopName?: string) {
    const room = `vehicle_${vehicleId}`;
    const payload = {
      vehicleId,
      stopName: stopName ?? null,
      message: '출발하셔도 됩니다',
      timestamp: new Date().toISOString(),
    };
    if (this.server) {
      this.server.to(room).emit('driverDepartSignal', payload);
    }
  }

  /** 원아 탑승/하차/결석 실시간 상태 브로드캐스트 (학부모 개인 방 + 차량 방에만 전송) */
  async broadcastChildBoardStatus(data: {
    parentUserId?: number;
    studentUserId?: number;
    studentId: number;
    studentName: string;
    boardStatus: string;
    vehicleId?: number;
    timestamp?: string;
  }) {
    if (!this.server) return;
    const payload = {
      studentId: data.studentId,
      studentName: data.studentName,
      boardStatus: data.boardStatus,
      vehicleId: data.vehicleId,
      timestamp: data.timestamp || new Date().toISOString(),
    };
    // 차량 방에는 같은 차를 타는 다른 학부모도 들어오므로 보내지 않는다. 그 원아의 학부모와 학생 본인에게만.
    let studentUserId = data.studentUserId;
    if (!studentUserId) {
      const st = await this.studentRepository.findOne({ where: { id: data.studentId }, relations: { studentUser: true } });
      studentUserId = st?.studentUser?.id;
    }
    for (const uid of new Set([data.parentUserId, studentUserId].filter(Boolean) as number[])) {
      this.server.to(`user_${uid}`).emit('childBoardStatusChanged', payload);
    }
  }

  @SubscribeMessage('joinVehicleRoom')
  async handleJoinVehicleRoom(
    @MessageBody() data: { vehicleId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const vehicleId = Number(data?.vehicleId);
    if (!vehicleId) return;

    const room = `vehicle_${vehicleId}`;
    client.join(room);
    console.log(`Client ${client.id} joined room ${room}`);

    // If vehicle is currently operating, inform client immediately
    const isOp = this.operatingVehicles.get(vehicleId) || false;
    client.emit('vehicleOperatingStatus', {
      vehicleId,
      isOperating: isOp,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leaveVehicleRoom')
  handleLeaveVehicleRoom(
    @MessageBody() data: { vehicleId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.vehicleId) client.leave(`vehicle_${data.vehicleId}`);
  }

  @SubscribeMessage('joinAcademyRoom')
  async handleJoinAcademyRoom(
    @MessageBody() data: { academyId?: number; token?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const token =
      data?.token ||
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query?.token as string | undefined);

    let user = client.data.user;
    if (!user && token) {
      try {
        user = await this.jwtService.verifyAsync<JwtPayload>(token);
        client.data.user = user;
      } catch (_) {}
    }

    if (!user) {
      console.warn(`[joinAcademyRoom] Unauthorized join attempt: ${client.id}`);
      return { success: false, message: '인증 토큰이 필요합니다.' };
    }

    let academyId: number | undefined;
    if (user.academyId) {
      academyId = Number(user.academyId);
    } else if (user.email) {
      const dbUser = await this.userRepository.findOne({
        where: { email: user.email },
        relations: { academy: true }
      });
      if (dbUser?.academyId || dbUser?.academy?.id) {
        academyId = Number(dbUser.academyId || dbUser.academy.id);
      }
    }

    if (!academyId) {
      console.warn(`[joinAcademyRoom] Academy not found for client: ${client.id}`);
      return { success: false, message: '유효한 유치원 정보가 없습니다.' };
    }

    const room = `academy_${academyId}`;
    client.join(room);
    if (user?.sub) {
      client.join(`user_${user.sub}`);
    }
    this.joinRoleRooms(client, { ...user, academyId });
    console.log(`Client ${client.id} joined academy room: ${room}`);
    return { success: true, room, academyId };
  }

  @SubscribeMessage('leaveAcademyRoom')
  handleLeaveAcademyRoom(
    @MessageBody() data: { academyId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.academyId) client.leave(`academy_${data.academyId}`);
  }

  @SubscribeMessage('driverOperationStatus')
  handleDriverOperationStatus(
    @MessageBody() data: { vehicleId: number; isOperating: boolean },
  ) {
    const vehicleId = Number(data?.vehicleId);
    if (!vehicleId) return;
    this.broadcastOperationStatus(vehicleId, !!data.isOperating);
  }

  @SubscribeMessage('teacherReadyToDepart')
  handleTeacherReadyToDepart(
    @MessageBody() data: { vehicleId: number; stopName?: string },
  ) {
    const vehicleId = Number(data?.vehicleId);
    if (!vehicleId) return;
    this.broadcastDepartSignal(vehicleId, data?.stopName);
  }

  // 기사 앱이 위치 + 실제 도로 기준 남은 시간(ETA)을 보내면 차량 방 및 대시보드·학부모에게 실시간 전송
  @SubscribeMessage('driverLocationUpdate')
  async handleDriverLocationUpdate(
    @MessageBody()
    data: {
      vehicleId: number;
      lat: number;
      lng: number;
      remainingSeconds?: number;
      remainingMeters?: number;
      nextStopName?: string;
      nextStopEtaSeconds?: number;
      speedKmh?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const vehicleId = Number(data?.vehicleId);
    const lat = Number(data?.lat);
    const lng = Number(data?.lng);
    if (!vehicleId || isNaN(lat) || isNaN(lng)) return;

    // Mark vehicle as operating
    this.operatingVehicles.set(vehicleId, true);

    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId },
      relations: { academy: true }
    });
    const academyId = vehicle?.academy?.id;

    const room = `vehicle_${vehicleId}`;
    const payload = {
      vehicleId,
      lat,
      lng,
      remainingSeconds: data?.remainingSeconds ?? null,
      remainingMeters: data?.remainingMeters ?? null,
      nextStopName: data?.nextStopName ?? null,
      nextStopEtaSeconds: data?.nextStopEtaSeconds ?? null,
      speedKmh: data?.speedKmh ?? null,
      timestamp: new Date().toISOString(),
    };

    // 차량 방(그 차를 타는 원아의 학부모·기사·교사)과 기관 교직원 방에만 보낸다. 다른 차량 학부모에게는 가지 않는다.
    this.server.to(room).emit('locationUpdated', payload);
    if (academyId) {
      this.server.to(academyStaffRoom(academyId)).emit('locationUpdated', payload);
      this.server.to(academyStaffRoom(academyId)).emit('vehicleOperatingStatus', {
        vehicleId,
        isOperating: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 도착 5분 전 알림 체크 로직
    try {
      const notificationsToEmit = await this.routingService.checkArrivalAndNotify(vehicleId, lat, lng);
      // 원아 이름이 담긴 접근 알림은 그 원아의 학부모 개인 방에만 보낸다(예전에는 차량 방·기관 방에 학부모 이메일까지 보냈다).
      for (const noti of notificationsToEmit) {
        const { parentUserId, ...rest } = noti as any;
        if (parentUserId) this.server.to(`user_${parentUserId}`).emit('busArriving', rest);
      }
    } catch (e) {
      console.error('Error during checkArrivalAndNotify:', e);
    }
  }
}
