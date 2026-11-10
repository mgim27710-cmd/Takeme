import { Controller, Get, Post, Body, Query, Req, Param, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private extractEmail(req: any, fallbackEmail?: string): string | undefined {
    if (fallbackEmail) return fallbackEmail;
    if (req?.user?.email) return req.user.email;
    const authHeader = req?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const parts = authHeader.substring(7).split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload?.email) return payload.email;
        }
      } catch (e) {}
    }
    return undefined;
  }

  private extractUserId(req: any, fallbackUserId?: string | number): number | undefined {
    if (fallbackUserId && !isNaN(Number(fallbackUserId))) return Number(fallbackUserId);
    if (req?.user?.sub) return Number(req.user.sub);
    const authHeader = req?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const parts = authHeader.substring(7).split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload?.sub) return Number(payload.sub);
        }
      } catch (e) {}
    }
    return undefined;
  }

  private extractTokenPayload(req: any): any {
    if (req?.user) return req.user;
    const authHeader = req?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const parts = authHeader.substring(7).split('.');
        if (parts.length === 3) {
          return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        }
      } catch (e) {}
    }
    return undefined;
  }

  @Get('users')
  async getUsers(
    @Query('academyId') academyId?: string,
    @Query('email') email?: string,
    @Req() req?: any,
  ) {
    const payload = this.extractTokenPayload(req);
    const isSuper = payload?.role === 'SUPER_ADMIN';
    const userEmail = this.extractEmail(req, email);

    let aId: number | undefined;
    if (isSuper) {
      aId = academyId && !isNaN(Number(academyId)) ? Number(academyId) : (payload?.academyId || undefined);
    } else {
      aId = payload?.academyId ? Number(payload.academyId) : undefined;
    }
    return this.chatService.getAcademyUsers(aId, userEmail);
  }

  @Get('rooms')
  async getRooms(@Req() req: any, @Query('email') email?: string) {
    const targetEmail = this.extractEmail(req, email);
    if (!targetEmail) {
      throw new BadRequestException('이메일 또는 인증 정보가 필요합니다.');
    }
    return this.chatService.getRoomsByEmail(targetEmail);
  }

  @Get('messages')
  async getMessages(
    @Query('roomId') roomId: string,
    @Query('userId') userId?: string,
    @Req() req?: any,
  ) {
    const uid = this.extractUserId(req, userId);
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
    const email = this.extractEmail(req, creatorEmail);
    if (!email) {
      throw new BadRequestException('생성자 이메일 정보가 필요합니다.');
    }
    return this.chatService.createRoomByEmail(name, type, userIds, email);
  }

  @Post('messages')
  async sendMessage(
    @Body('roomId') roomId: number,
    @Body('text') text: string,
    @Body('senderEmail') senderEmail: string,
    @Req() req: any,
  ) {
    const email = this.extractEmail(req, senderEmail);
    if (!email) {
      throw new BadRequestException('발신자 이메일 정보가 필요합니다.');
    }
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
    const payload = this.extractTokenPayload(req);
    const isSuper = payload?.role === 'SUPER_ADMIN';
    const userEmail = this.extractEmail(req, email);

    let aId: number | undefined;
    if (isSuper) {
      aId = academyId && !isNaN(Number(academyId)) ? Number(academyId) : (payload?.academyId || undefined);
    } else {
      aId = payload?.academyId ? Number(payload.academyId) : undefined;
    }
    return this.chatService.getPaymentContext(aId, userEmail);
  }

  @Get('payment/requests')
  async getPaymentRequests(
    @Query('academyId') academyId?: string,
    @Req() req?: any,
  ) {
    const payload = this.extractTokenPayload(req);
    const aId = academyId ? Number(academyId) : (payload?.academyId ? Number(payload.academyId) : undefined);
    return this.chatService.getPaymentRequests(aId);
  }

  @Post('payment-request')
  async createPaymentRequest(
    @Body() body: any,
    @Req() req?: any,
  ) {
    const requesterEmail = this.extractEmail(req, body?.requesterEmail);
    if (!requesterEmail) {
      throw new BadRequestException('신청자 이메일 정보가 필요합니다.');
    }
    return this.chatService.createPaymentRequest(body, requesterEmail);
  }

  @Post('payment-request/:id/decision')
  async decidePaymentRequest(
    @Param('id') id: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED' | 'APPROVE' | 'REJECT',
    @Body('decidedByEmail') decidedByEmail?: string,
    @Body('vehicleId') vehicleId?: number,
    @Req() req?: any,
  ) {
    const email = this.extractEmail(req, decidedByEmail);
    if (!email) {
      throw new BadRequestException('승인자 이메일 정보가 필요합니다.');
    }
    const normalizedDecision: 'APPROVED' | 'REJECTED' = (decision === 'APPROVE' || decision === 'APPROVED') ? 'APPROVED' : 'REJECTED';
    return this.chatService.decidePaymentRequest(Number(id), normalizedDecision, email, vehicleId ? Number(vehicleId) : undefined);
  }

  @Post('payment-request/:id/re-request')
  async reRequestPayment(
    @Param('id') id: string,
    @Body() body: {
      suggestedLocation: { boardingLocation: string; address?: string; latitude: number; longitude: number };
      note: string;
      proposerEmail?: string;
    },
    @Req() req?: any,
  ) {
    const email = this.extractEmail(req, body?.proposerEmail);
    if (!email) {
      throw new BadRequestException('신청자/제안자 이메일 정보가 필요합니다.');
    }
    return this.chatService.reRequestPayment(Number(id), body, email);
  }

  @Post('payment-request/:id/push-parent')
  async pushParentNotification(
    @Param('id') id: string,
    @Body('senderEmail') senderEmail: string,
    @Req() req?: any,
  ) {
    const email = this.extractEmail(req, senderEmail);
    return this.chatService.pushParentNotification(Number(id), email);
  }
}
