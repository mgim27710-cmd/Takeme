import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatRoom } from '../entities/chat-room.entity';
import { ChatRoomMember } from '../entities/chat-room-member.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { User } from '../entities/user.entity';
import { Student } from '../entities/student.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Academy } from '../entities/academy.entity';
import { PickupPoint } from '../entities/pickup-point.entity';
import { ParentMessage } from '../entities/parent-message.entity';
import { Notification } from '../entities/notification.entity';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      ChatRoomMember,
      ChatMessage,
      User,
      Student,
      Vehicle,
      Academy,
      PickupPoint,
      ParentMessage,
      Notification,
    ]),
    forwardRef(() => RoutingModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
