import { Controller, Get, Post, Body, Query, Param, Req } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('users')
  async getUsers(
    @Query('academyId') academyId?: string,
    @Query('email') email?: string,
    @Req() req?: any,
  ) {
    const aId = academyId && !isNaN(Number(academyId)) ? Number(academyId) : (req?.user?.academyId || undefined);
    const userEmail = req?.user?.email || email;
    return this.chatService.getAcademyUsers(aId, userEmail);
  }

  @Get('rooms')
  async getRooms(@Req() req: any, @Query('email') email?: string) {
    const targetEmail = req?.user?.email || email;
    return this.chatService.getRoomsByEmail(targetEmail);
  }

  @Get('messages')
  async getMessages(
    @Query('roomId') roomId: string,
    @Query('userId') userId?: string,
    @Req() req?: any,
  ) {
    const uid = req?.user?.sub ? Number(req.user.sub) : (userId ? Number(userId) : undefined);
    return this.chatService.getMessages(parseInt(roomId, 10), uid);
  }

  @Post('rooms')
  async createRoom(
    @Body('name') name: string,
    @Body('type') type: string,
    @Body('userIds') userIds: number[],
    @Body('creatorEmail') creatorEmail: string,
    @Req() req: any,
  ) {
    const email = req?.user?.email || creatorEmail;
    return this.chatService.createRoomByEmail(name, type, userIds, email);
  }

  @Post('messages')
  async sendMessage(
    @Body('roomId') roomId: number,
    @Body('text') text: string,
    @Body('senderEmail') senderEmail: string,
    @Req() req: any,
  ) {
    const email = req?.user?.email || senderEmail;
    return this.chatService.sendMessageAndBroadcast(Number(roomId), email, text);
  }

  // ============================================================
  // 결제 및 탑승 신청 엔드포인트
  // ============================================================

  @Get('payment-context')
  async getPaymentContext(
    @Query('academyId') academyId?: string,
    @Query('email') email?: string,
    @Req() req?: any,
  ) {
    const aId = academyId && !isNaN(Number(academyId)) ? Number(academyId) : (req?.user?.academyId || undefined);
    const userEmail = req?.user?.email || email;
    return this.chatService.getPaymentContext(aId, userEmail);
  }

  @Post('payment-request')
  async createPaymentRequest(
    @Body() body: any,
    @Req() req?: any,
  ) {
    const requesterEmail = req?.user?.email || body?.requesterEmail;
    return this.chatService.createPaymentRequest(body, requesterEmail);
  }

  @Post('payment-request/:id/decision')
  async decidePaymentRequest(
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED',
    @Body('decidedByEmail') decidedByEmail: string,
    @Req() req?: any,
  ) {
    const email = req?.user?.email || decidedByEmail;
    return this.chatService.decidePaymentRequest(Number(id), decision, email);
  }
}
