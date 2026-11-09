import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalStatus } from '../entities/approval-request.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarEventType } from '../entities/academy-holiday.entity';

@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /**
   * 통학 변경 신청 생성 (학부모, 담임교사, 데스크 직원)
   */
  @UseGuards(JwtAuthGuard)
  @Post('request')
  async createRequest(@Req() req: any, @Body() data: any) {
    const user = req.dbUser;
    return this.approvalService.createRequest(user, data);
  }

  /**
   * 내가 신청한 변경 요청 목록 (학부모/담임/본인)
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyRequests(@Req() req: any) {
    const user = req.dbUser;
    return this.approvalService.getMyRequests(user);
  }

  /**
   * 담임교사용: 자기 반 오늘 통학 변경 현황
   */
  @UseGuards(JwtAuthGuard)
  @Get('class-today')
  async getClassTodayRequests(@Req() req: any) {
    const user = req.dbUser;
    return this.approvalService.getClassTodayRequests(user);
  }

  /**
   * 관리자 신청함 목록 (대기 우선, 정원 초과 시 대체 후보 포함)
   */
  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async getAdminRequests(
    @Req() req: any,
    @Query('status') status?: ApprovalStatus,
  ) {
    const user = req.dbUser;
    return this.approvalService.getAdminRequests(user, status);
  }

  /**
   * 승인 / 반려 처리 (기관 관리자, 데스크)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/decision')
  async decideRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body('decision') decision: ApprovalStatus,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const user = req.dbUser;
    const reqId = parseInt(id, 10);
    if (isNaN(reqId)) throw new BadRequestException('유효한 신청 ID가 아닙니다.');
    return this.approvalService.decideRequest(user, reqId, decision, rejectionReason);
  }

  /**
   * 기존 호환용 엔드포인트
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/decide')
  async decideRequestCompat(
    @Req() req: any,
    @Param('id') id: string,
    @Body('decision') decision: ApprovalStatus,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    const user = req.dbUser;
    const reqId = parseInt(id, 10);
    if (isNaN(reqId)) throw new BadRequestException('유효한 신청 ID가 아닙니다.');
    return this.approvalService.decideRequest(user, reqId, decision, rejectionReason);
  }

  /**
   * 기존 호환용 대기 목록
   */
  @UseGuards(JwtAuthGuard)
  @Get('pending')
  async getPending(@Req() req: any) {
    const user = req.dbUser;
    return this.approvalService.getAdminRequests(user, ApprovalStatus.PENDING);
  }

  /**
   * 통합 캘린더 일정 조회 (휴업·방학·행사 + 승인된 통학 변경)
   */
  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  async getCalendar(
    @Req() req: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
    @Query('className') className?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('studentId') studentId?: string,
  ) {
    const user = req.dbUser;
    return this.approvalService.getCalendar(user, {
      year,
      month,
      date,
      className,
      vehicleId,
      studentId,
    });
  }

  /**
   * 캘린더 일정/휴업 추가 (기관 관리자, 데스크)
   */
  @UseGuards(JwtAuthGuard)
  @Post('calendar/event')
  async createCalendarEvent(
    @Req() req: any,
    @Body() body: {
      type: CalendarEventType;
      title: string;
      startDate: string;
      endDate: string;
      targetClass?: string;
      reason?: string;
    },
  ) {
    const user = req.dbUser;
    return this.approvalService.createCalendarEvent(user, body);
  }

  /**
   * 캘린더 일정/휴업 삭제 (기관 관리자, 데스크)
   */
  @UseGuards(JwtAuthGuard)
  @Delete('calendar/event/:id')
  async deleteCalendarEvent(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const user = req.dbUser;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) throw new BadRequestException('유효한 일정 ID가 아닙니다.');
    return this.approvalService.deleteCalendarEvent(user, eventId);
  }

  /**
   * 여유 차량 후보 목록 조회
   */
  @UseGuards(JwtAuthGuard)
  @Get('vehicles/capacity-candidates')
  async getCapacityCandidates(
    @Req() req: any,
    @Query('targetDate') targetDate: string,
    @Query('excludeVehicleId') excludeVehicleId?: string,
  ) {
    const user = req.dbUser;
    const academyId = user.academyId;
    if (!academyId) throw new BadRequestException('기관 정보가 필요합니다.');
    const excludeId = excludeVehicleId ? parseInt(excludeVehicleId, 10) : undefined;
    return this.approvalService.getVehicleCapacityCandidates(academyId, targetDate, excludeId);
  }
}
