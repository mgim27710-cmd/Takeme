import { Controller, Get, Post, Body, Query, Req, Param, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtPayload } from '../auth/auth-user.decorator';

/**
 * 메신저 API
 * - 모든 요청은 로그인 토큰 필수 (JwtAuthGuard)
 * - 사용자·기관은 토큰에서만 꺼낸다. 요청의 email / userId / academyId 값으로 사용자를 정하지 않는다.
 *   (통합 관리자만 academyId 쿼리로 대상 기관을 지정할 수 있다)
 */
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** 기관 결정: 통합 관리자는 쿼리로 지정 가능, 그 외에는 토큰의 기관만 */
  private resolveAcademyId(user: JwtPayload, academyIdQuery?: string): number | undefined {
    if (user.role === 'SUPER_ADMIN' && academyIdQuery && !isNaN(Number(academyIdQuery))) {
      return Number(academyIdQuery);
    }
    return user.academyId ? Number(user.academyId) : undefined;
  }

  @Get('users')
  async getUsers(
    @AuthUser() user: JwtPayload,
    @Query('academyId') academyId?: string,
    @Query('educationLevel') educationLevel?: string,
  ) {
    return this.chatService.getAcademyUsers(this.resolveAcademyId(user, academyId), user.email, educationLevel);
  }

  @Get('rooms')
  async getRooms(
    @AuthUser() user: JwtPayload,
    @Query('educationLevel') educationLevel?: string,
  ) {
    return this.chatService.getRoomsByEmail(user.email, educationLevel);
  }

  @Get('messages')
  async getMessages(
    @AuthUser() user: JwtPayload,
    @Query('roomId') roomId: string,
  ) {
    return this.chatService.getMessages(parseInt(roomId, 10), user.sub);
  }

  @Post('rooms/:roomId/read')
  async markRoomRead(
    @AuthUser() user: JwtPayload,
    @Param('roomId') roomId: string,
    @Body('userId') bodyUserId?: number,
  ) {
    const uid = user?.sub || bodyUserId;
    if (!uid) return { success: false, message: '유저 정보를 확인할 수 없습니다.' };
    return this.chatService.markRoomMessagesRead(parseInt(roomId, 10), uid);
  }

  @Get('rooms/:roomId/messages')
  async getRoomMessagesAlias(
    @AuthUser() user: JwtPayload,
    @Param('roomId') roomId: string,
    @Query('userId') userId?: string,
  ) {
    const uid = user?.sub || (userId ? parseInt(userId, 10) : undefined);
    return this.chatService.getMessages(parseInt(roomId, 10), uid);
  }

  @Post('rooms')
  async createRoom(
    @AuthUser() user: JwtPayload,
    @Body('name') name?: string,
    @Body('type') type?: string,
    @Body('userIds') userIds?: number[],
  ) {
    return this.chatService.createRoomByEmail(name, type, userIds || [], user.email);
  }

  @Post('messages')
  async sendMessage(
    @AuthUser() user: JwtPayload,
    @Body('roomId') roomId: number,
    @Body('text') text: string,
    @Body('senderEmail') senderEmail?: string,
    @Body('type') type?: string,
    @Body('payload') payload?: any,
  ) {
    const email = user?.email || senderEmail;
    if (!email) {
      throw new BadRequestException('발신자 이메일 정보가 필요합니다.');
    }
    return this.chatService.sendMessageAndBroadcast(Number(roomId), email, text, type, payload);
  }

  @Post('upload')
  async uploadMedia(
    @Body() body: { base64Data: string; filename?: string; mimeType?: string },
    @Headers('host') host: string,
  ) {
    return this.chatService.uploadChatMedia(body, host);
  }

  /** 공지사항 읽음 현황 (원장·데스크) */
  @Get('rooms/:id/notice-read-status')
  async getNoticeReadStatus(@AuthUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.getNoticeReadStatus(Number(id), user);
  }

  /** 공지를 안 읽은 사람에게만 다시 알림 (원장·데스크) */
  @Post('messages/:id/remind-unread')
  async remindUnread(@AuthUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.remindUnreadNotice(Number(id), user);
  }

  /** 내 목록에서 대화방 맨 위 고정/해제 */
  @Post('rooms/:id/pin')
  async pinRoom(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('pinned') pinned: boolean,
  ) {
    return this.chatService.setRoomPinned(Number(id), user.sub, pinned !== false);
  }

  /** 내 목록에서 대화방 삭제 */
  @Post('rooms/:id/hide')
  async hideRoom(@AuthUser() user: JwtPayload, @Param('id') id: string) {
    return this.chatService.hideRoom(Number(id), user.sub);
  }

  @Post('rooms/:id/read')
  async markAsRead(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.chatService.markRoomMessagesRead(parseInt(id, 10), user.sub);
  }

  // ============================================================
  // 결재 및 탑승 신청
  // ============================================================

  @Get('payment-context')
  async getPaymentContext(
    @AuthUser() user: JwtPayload,
    @Query('academyId') academyId?: string,
  ) {
    return this.chatService.getPaymentContext(this.resolveAcademyId(user, academyId), user.email);
  }

  @Get('payment/requests')
  async getPaymentRequests(
    @AuthUser() user: JwtPayload,
    @Query('academyId') academyId?: string,
  ) {
    return this.chatService.getPaymentRequests(this.resolveAcademyId(user, academyId));
  }

  @Post('payment-request')
  async createPaymentRequest(
    @AuthUser() user: JwtPayload,
    @Body() body: any,
  ) {
    return this.chatService.createPaymentRequest(body, user.email);
  }

  @Post('payment-request/:id/decision')
  async decidePaymentRequest(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED' | 'APPROVE' | 'REJECT',
    @Body('vehicleId') vehicleId?: number,
  ) {
    const normalizedDecision: 'APPROVED' | 'REJECTED' = (decision === 'APPROVE' || decision === 'APPROVED') ? 'APPROVED' : 'REJECTED';
    return this.chatService.decidePaymentRequest(Number(id), normalizedDecision, user.email, vehicleId ? Number(vehicleId) : undefined);
  }

  @Post('payment-request/:id/re-request')
  async reRequestPayment(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: {
      suggestedLocation: { boardingLocation: string; address?: string; latitude: number; longitude: number };
      note: string;
    },
  ) {
    return this.chatService.reRequestPayment(Number(id), body, user.email);
  }

  @Post('payment-request/:id/push-parent')
  async pushParentNotification(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.chatService.pushParentNotification(Number(id), user.email);
  }

  @Post('leave-request')
  async createLeaveRequest(
    @AuthUser() user: JwtPayload,
    @Body() body: {
      roomId: number;
      applicantName: string;
      applicantRole: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      needSubstitute: boolean;
      reason: string;
    },
  ) {
    return this.chatService.createLeaveRequest(body, user.email);
  }

  @Post('leave-request/:id/decision')
  async decideLeaveRequest(
    @AuthUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED' | 'APPROVE' | 'REJECT',
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const normalizedDecision: 'APPROVED' | 'REJECTED' = (decision === 'APPROVE' || decision === 'APPROVED') ? 'APPROVED' : 'REJECTED';
    return this.chatService.decideLeaveRequest(Number(id), normalizedDecision, user.email, rejectionReason);
  }
}
