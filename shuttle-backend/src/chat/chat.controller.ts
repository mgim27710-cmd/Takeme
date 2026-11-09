import { Controller, Get, Post, Body, Query, Req, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApprovalService } from '../approval/approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtPayload } from '../auth/auth-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly approvalService: ApprovalService,
  ) {}

  @Get('users')
  async getUsers(
    @AuthUser() user: JwtPayload,
    @Query('academyId') academyId?: string,
  ) {
    const aId = academyId && !isNaN(Number(academyId)) ? Number(academyId) : (user?.academyId || undefined);
    return this.chatService.getAcademyUsers(user.sub, aId);
  }

  @Get('rooms')
  async getRooms(@AuthUser() user: JwtPayload) {
    return this.chatService.getRoomsByUser(user.sub);
  }

  @Get('messages')
  async getMessages(
    @AuthUser() user: JwtPayload,
    @Query('roomId') roomId: string,
  ) {
    return this.chatService.getMessages(parseInt(roomId, 10), user.sub);
  }

  @Post('rooms')
  async createRoom(
    @AuthUser() user: JwtPayload,
    @Body('name') name?: string,
    @Body('type') type?: string,
    @Body('userIds') userIds?: number[],
  ) {
    return this.chatService.createRoom(user.sub, userIds || [], name, type);
  }

  @Post('messages')
  async sendMessage(
    @AuthUser() user: JwtPayload,
    @Body('roomId') roomId: number,
    @Body('text') text: string,
  ) {
    return this.chatService.sendMessage(Number(roomId), user.sub, text);
  }

  @Post('rooms/:id/read')
  async markAsRead(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.chatService.markRoomAsRead(parseInt(id, 10), user.sub);
  }

  /**
   * 메신저 결재 요청 생성 브리지 (웹 MessagePanel.jsx / TeacherDashboard.jsx 호환)
   */
  @Post('payment-request')
  async createPaymentRequest(@Req() req: any, @Body() body: any) {
    const user = req.dbUser;
    return this.approvalService.createPaymentRequestFromChat(user, body);
  }

  /**
   * 메신저 결재 결정 브리지
   */
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
  @Post('payment-request/:id/re-request')
  async reRequestPaymentRequest(@Req() req: any, @Body() body: any) {
    const user = req.dbUser;
    return this.approvalService.createPaymentRequestFromChat(user, body);
  }
}
