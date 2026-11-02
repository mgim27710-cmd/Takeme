import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  broadcastMessageToRoom(roomId: number, message: any) {
    if (this.server) {
      const room = `chat_${roomId}`;
      this.server.to(room).emit('receiveMessage', message);
      this.server.emit('roomUpdated', { roomId });
    }
  }

  @SubscribeMessage('joinChatRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (data && data.roomId) {
      const room = `chat_${data.roomId}`;
      client.join(room);
    }
  }

  @SubscribeMessage('leaveChatRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (data && data.roomId) {
      const room = `chat_${data.roomId}`;
      client.leave(room);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: number; senderEmail: string; text: string },
  ) {
    if (data && data.roomId && data.senderEmail && data.text) {
      return this.chatService.sendMessageAndBroadcast(data.roomId, data.senderEmail, data.text);
    }
  }
}
