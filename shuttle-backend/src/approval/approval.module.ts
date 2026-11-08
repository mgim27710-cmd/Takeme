import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { ApprovalRequest } from '../entities/approval-request.entity';
import { Student } from '../entities/student.entity';
import { ScheduleOverride } from '../entities/schedule-override.entity';
import { PickupPoint } from '../entities/pickup-point.entity';
import { User } from '../entities/user.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Academy } from '../entities/academy.entity';
import { Notification } from '../entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRequest,
      Student,
      ScheduleOverride,
      PickupPoint,
      User,
      Vehicle,
      Academy,
      Notification,
    ]),
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService, TypeOrmModule],
})
export class ApprovalModule {}
