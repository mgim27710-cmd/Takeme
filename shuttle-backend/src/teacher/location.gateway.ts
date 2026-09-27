import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoutingService } from '../routing/routing.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly routingService: RoutingService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // 부모님이나 원장님이 특정 차량의 방에 입장
  @SubscribeMessage('joinVehicleRoom')
  handleJoinVehicleRoom(
    @MessageBody() data: { vehicleId: number },
    @ConnectedSocket() client: Socket
  ) {
    if (data.vehicleId) {
      const room = `vehicle_${data.vehicleId}`;
      client.join(room);
      console.log(`Client ${client.id} joined room ${room}`);
    }
  }

  // 부모님이나 원장님이 특정 차량의 방에서 퇴장
  @SubscribeMessage('leaveVehicleRoom')
  handleLeaveVehicleRoom(
    @MessageBody() data: { vehicleId: number },
    @ConnectedSocket() client: Socket
  ) {
    if (data.vehicleId) {
      const room = `vehicle_${data.vehicleId}`;
      client.leave(room);
      console.log(`Client ${client.id} left room ${room}`);
    }
  }

  // 기사님 앱에서 실시간 위치를 쏘면 같은 방에 있는 사람들에게 브로드캐스트
  @SubscribeMessage('driverLocationUpdate')
  async handleDriverLocationUpdate(
    @MessageBody() data: { vehicleId: number; lat: number; lng: number }
  ) {
    if (data.vehicleId) {
      const room = `vehicle_${data.vehicleId}`;
      // 해당 방에 있는 클라이언트들에게만 위치 전송
      this.server.to(room).emit('locationUpdated', {
        vehicleId: data.vehicleId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date().toISOString()
      });

      // 도착 5분 전 알림 체크 로직
      try {
        const notificationsToEmit = await this.routingService.checkArrivalAndNotify(data.vehicleId, data.lat, data.lng);
        for (const noti of notificationsToEmit) {
          // 해당 차량 방 전체에 방송하되, 클라이언트 단에서 본인 이메일인지 필터링하도록 전송
          this.server.to(room).emit('busArriving', noti);
        }
      } catch (e) {
        console.error('Error during checkArrivalAndNotify:', e);
      }
    }
  }
}
