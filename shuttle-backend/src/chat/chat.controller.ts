import { Controller, Get, Post, Body, Query, Req, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApprovalService } from '../approval/approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly approvalService: ApprovalService,
  ) {}

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

  /**
   * 메신저 결재 요청 생성 브리지 (웹 MessagePanel.jsx / TeacherDashboard.jsx 호환)
   */
  @UseGuards(JwtAuthGuard)
  @Post('payment-request')
  async createPaymentRequest(@Req() req: any, @Body() body: any) {
    const user = req.dbUser;
    return this.approvalService.createPaymentRequestFromChat(user, body);
  }

  /**
   * 메신저 결재 결정 브리지
   */
  @UseGuards(JwtAuthGuard)
  @Post('payment-request/:id/decision')
  async decidePaymentRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVE' | 'REJECT',
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const user = req.dbUser;
    return this.approvalService.decidePaymentRequestFromChat(
      user,
      parseInt(id, 10),
      decision,
      rejectionReason,
    );
  }

  /**
   * 메신저 재결재 요청 브리지
   */
  @UseGuards(JwtAuthGuard)
  @Post('payment-request/:id/re-request')
  async reRequestPaymentRequest(@Req() req: any, @Body() body: any) {
    const user = req.dbUser;
    return this.approvalService.createPaymentRequestFromChat(user, body);
  }
}
