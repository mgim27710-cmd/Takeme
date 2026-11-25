import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { Vehicle } from '../entities/vehicle.entity';
import { Student } from '../entities/student.entity';
import { Academy } from '../entities/academy.entity';
import { User } from '../entities/user.entity';
import { OperationLog } from '../entities/operation-log.entity';
import { ParentMessage } from '../entities/parent-message.entity';
import { StudentSchedule } from '../entities/student-schedule.entity';
import { ScheduleOverride } from '../entities/schedule-override.entity';
import { AcademyHoliday } from '../entities/academy-holiday.entity';
import { Notification } from '../entities/notification.entity';
import { PickupPoint } from '../entities/pickup-point.entity';
import { BoardPost } from '../entities/board-post.entity';
import { BoardComment } from '../entities/board-comment.entity';
import { BoardPostRead } from '../entities/board-post-read.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { YearlyZoneMapping } from '../entities/yearly-zone-mapping.entity';
import { Attendance } from '../entities/attendance.entity';
import { AttendanceSubmission } from '../entities/attendance-submission.entity';
import { CloudDocument } from '../entities/cloud-document.entity';
import { LegalExpiry } from '../entities/legal-expiry.entity';
import { MediaAsset } from '../entities/media-asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle, Student, StudentSchedule, Academy, User,
      OperationLog, ParentMessage, ScheduleOverride,
      AcademyHoliday, Notification, PickupPoint,
      BoardPost, BoardComment, BoardPostRead, AuditLog, YearlyZoneMapping,
      Attendance, AttendanceSubmission,
      CloudDocument, LegalExpiry, MediaAsset,
    ]),
    HttpModule
  ],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService]
})
export class RoutingModule {}
