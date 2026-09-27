import { Controller, Post, Body, Get, Param, Query, Res, Delete } from '@nestjs/common';
import type { Response } from 'express';
import { RoutingService } from './routing.service';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('initial-state')
  async getInitialState() {
    return this.routingService.getInitialState();
  }

  @Get('export-excel')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.routingService.generateExcelBuffer();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="students.xlsx"',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('daily-logs')
  async getDailyLogs(
    @Query('date') date: string,
    @Query('vehicleId') vehicleId: string,
  ) {
    return this.routingService.getDailyLogs(date, Number(vehicleId));
  }

  @Post('generate-auth-code')
  async generateAuthCode() {
    return this.routingService.generateAuthCode();
  }

  @Post('approve-student')
  async approveStudent(@Body() body: { studentId: number }) {
    return this.routingService.approveStudent(body.studentId);
  }

  @Post('revoke-student')
  async revokeStudent(@Body() body: { studentId: number }) {
    return this.routingService.revokeStudent(body.studentId);
  }

  @Post('approve-staff')
  async approveStaff(@Body() body: { vehicleId: number, role: 'DRIVER' | 'TEACHER' }) {
    return this.routingService.approveStaff(body.vehicleId, body.role);
  }

  @Post('revoke-staff')
  async revokeStaff(@Body() body: { vehicleId: number, role: 'DRIVER' | 'TEACHER' }) {
    return this.routingService.revokeStaff(body.vehicleId, body.role);
  }

  @Post('setup-academy')
  async setupAcademy(@Body() body: { name: string, address: string, lat: number, lng: number }) {
    return this.routingService.setupAcademy(body);
  }

  @Post('absence')
  async createAbsence(@Body() body: { studentId: number, startDate: string, endDate: string }) {
    return this.routingService.createAbsence(body);
  }

  @Get('absences')
  async getAbsences(@Query('vehicleId') vehicleId?: string) {
    return this.routingService.getAbsences(vehicleId ? Number(vehicleId) : undefined);
  }

  @Delete('absence/:id')
  async deleteAbsence(@Param('id') id: string) {
    return this.routingService.deleteAbsence(Number(id));
  }

  @Post('holiday')
  async createHoliday(@Body() body: { startDate: string, endDate: string, reason?: string }) {
    return this.routingService.createHoliday(body);
  }

  @Get('holidays')
  async getHolidays() {
    return this.routingService.getHolidays();
  }

  @Post('delete-academy')
  async deleteAcademy() {
    return this.routingService.deleteAcademy();
  }

  @Post('init-zones')
  async initZones(@Body() body: { vehicles: any[], parsedData: any[] }) {
    return this.routingService.initializeZones(body.vehicles, body.parsedData);
  }

  @Post('vehicle/:id/zone')
  async updateVehicleZone(
    @Param('id') id: string, 
    @Body() body: { email: string, polygonCoordinates: any[] }
  ) {
    return this.routingService.updateVehicleZone(Number(id), body.email, body.polygonCoordinates);
  }

  @Post('save-students')
  async saveStudents(@Body() body: any[]) {
    return this.routingService.saveStudents(body);
  }

  @Post('pickup-point')
  async createPickupPoint(@Body() body: { name: string, latitude: number, longitude: number }) {
    return this.routingService.createPickupPoint(body);
  }

  @Get('pickup-points')
  async getPickupPoints() {
    return this.routingService.getPickupPoints();
  }

  @Delete('pickup-point/:id')
  async deletePickupPoint(@Param('id') id: string) {
    return this.routingService.deletePickupPoint(Number(id));
  }

  @Post('geocode-bulk')
  async geocodeBulk(@Body() body: { addresses: string[] }) {
    return this.routingService.geocodeBulk(body.addresses);
  }

  @Post('vehicle/:id')
  async updateVehicle(@Body() body: any, @Param('id') id: string) {
    return this.routingService.updateVehicle(Number(id), body);
  }

  @Get('admin-messages')
  async getAdminMessages() {
    return this.routingService.getAdminMessages();
  }

  @Post('admin-messages/send')
  async sendAdminMessage(@Body() body: { targetRoles: string[], vehicleId: number | null, studentIds: number[], message: string }) {
    return this.routingService.sendAdminMessage(body);
  }
}
