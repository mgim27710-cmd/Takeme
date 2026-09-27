import { Controller, Post, Get, Body, Query, BadRequestException } from '@nestjs/common';
import { ParentService } from './parent.service';
import { OverrideType } from '../entities/schedule-override.entity';

@Controller('parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post('override')
  async createOverride(
    @Body('email') email: string, 
    @Body('targetDate') targetDate: string,
    @Body('overrideType') overrideType: string,
    @Body('reason') reason: string
  ) {
    if (!email || !targetDate || !overrideType) {
      throw new BadRequestException('필수 정보가 누락되었습니다.');
    }
    
    const type = overrideType as OverrideType;
    if (![OverrideType.ABSENCE, OverrideType.CHANGE_LOCATION].includes(type)) {
      throw new BadRequestException('잘못된 신청 유형입니다.');
    }

    return this.parentService.createOverride(email, targetDate, type, reason);
  }

  @Post('register-info')
  async registerInfo(
    @Body('email') email: string,
    @Body() payload: any
  ) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.parentService.registerInfo(email, payload);
  }

  @Get('notifications')
  async getNotifications(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.parentService.getNotifications(email);
  }

  @Get('route')
  async getRoute(@Query('email') email: string) {
    if (!email) throw new BadRequestException('Email is required');
    return this.parentService.getRoute(email);
  }

  @Post('message')
  async createMessage(
    @Body('email') email: string,
    @Body('targetRoles') targetRoles: string[],
    @Body('message') message: string
  ) {
    if (!email) throw new BadRequestException('Email is required');
    return this.parentService.createMessage(email, targetRoles, message);
  }

  @Post('read-message')
  async readMessage(
    @Body('email') email: string,
    @Body('messageId') messageId: number
  ) {
    if (!email || !messageId) throw new BadRequestException('Email and messageId required');
    return this.parentService.readMessage(messageId, email);
  }

  @Get('today-schedule')
  async getTodaySchedule(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.parentService.getTodaySchedule(email);
  }
}
