import { Controller, Get, Post, Body, Query, BadRequestException, Param } from '@nestjs/common';
import { TeacherService } from './teacher.service';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('students')
  async getStudents(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.getStudents(email);
  }

  @Get('my-vehicle')
  async getMyVehicle(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.getMyVehicle(email);
  }

  @Get('route')
  async getRoute(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.getRoute(email);
  }

  @Get('inbox')
  async getInbox(@Query('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.getInbox(email);
  }

  @Get('operation-logs')
  async getOperationLogs(@Query('email') email: string, @Query('month') month: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.getOperationLogs(email, month);
  }

  @Post('board')
  async boardStudent(@Body() body: { email: string; studentId: number; reason?: string }) {
    return this.teacherService.boardStudent(body.email, body.studentId, body.reason);
  }

  @Post('skip-student')
  async skipStudent(@Body() body: { email: string; studentId: number }) {
    return this.teacherService.skipStudent(body.email, body.studentId);
  }

  @Post('start-operation')
  async startOperation(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.startOperation(body.email);
  }

  @Post('end-operation')
  async endOperation(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.endOperation(body.email);
  }

  @Post('student/:id/memo')
  async updateMemo(
    @Param('id') studentId: number, 
    @Body() body: { email: string; memo: string }
  ) {
    return this.teacherService.updateMemo(body.email, studentId, body.memo);
  }

  @Post('student-board')
  async studentBoardByQR(
    @Body('studentEmail') studentEmail: string,
    @Body('teacherEmail') teacherEmail: string
  ) {
    if (!studentEmail || !teacherEmail) throw new BadRequestException('필수 정보 누락');
    return this.teacherService.studentBoardByQR(studentEmail, teacherEmail);
  }

  @Get('staff')
  async getStaffList() {
    return this.teacherService.getStaffList();
  }

  @Post('send-message')
  async sendMessage(
    @Body('email') email: string, 
    @Body('message') message: string, 
    @Body('studentIds') studentIds: number[],
    @Body('parentIds') parentIds: number[] = [],
    @Body('staffUserIds') staffUserIds: number[] = []
  ) {
    return this.teacherService.sendMessage(email, message, studentIds, parentIds, staffUserIds);
  }

  @Post('reply-message')
  async replyMessage(
    @Body('email') email: string,
    @Body('messageId') messageId: number,
    @Body('action') action: 'WAIT' | 'GO_AHEAD'
  ) {
    if (!email || !messageId || !action) throw new BadRequestException('필수 정보 누락');
    return this.teacherService.replyMessage(email, messageId, action);
  }

  @Post('read-message')
  async readMessage(
    @Body('email') email: string,
    @Body('messageId') messageId: number
  ) {
    if (!email || !messageId) throw new BadRequestException('필수 정보 누락');
    return this.teacherService.readMessage(email, messageId);
  }

  @Post('emergency')
  async triggerEmergency(@Body('email') email: string) {
    if (!email) throw new BadRequestException('이메일이 필요합니다.');
    return this.teacherService.triggerEmergency(email);
  }
}
