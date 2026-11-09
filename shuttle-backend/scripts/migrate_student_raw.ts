/**
 * 개발용 로컬 DB 전용: Student.raw 내 암호화/비구조화 데이터를
 * 신규 정규화 컬럼(gender, birthDate, className, phone)으로 이전하는 마이그레이션 스크립트
 *
 * 실행 방법:
 * $ cd shuttle-backend
 * $ npx ts-node -r dotenv/config scripts/migrate_student_raw.ts dotenv_config_path=.env.development
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Student } from '../src/entities/student.entity';
import { Academy } from '../src/entities/academy.entity';
import { Vehicle } from '../src/entities/vehicle.entity';
import { User } from '../src/entities/user.entity';
import { StudentSchedule } from '../src/entities/student-schedule.entity';
import { ScheduleOverride } from '../src/entities/schedule-override.entity';
import { Notification } from '../src/entities/notification.entity';
import { OperationLog } from '../src/entities/operation-log.entity';
import { ParentMessage } from '../src/entities/parent-message.entity';
import { AcademyHoliday } from '../src/entities/academy-holiday.entity';
import { PickupPoint } from '../src/entities/pickup-point.entity';
import { ChatRoom } from '../src/entities/chat-room.entity';
import { ChatRoomMember } from '../src/entities/chat-room-member.entity';
import { ChatMessage } from '../src/entities/chat-message.entity';
import { ApprovalRequest } from '../src/entities/approval-request.entity';
import { BoardPost } from '../src/entities/board-post.entity';
import { BoardComment } from '../src/entities/board-comment.entity';
import { AuditLog } from '../src/entities/audit-log.entity';
import { Attendance } from '../src/entities/attendance.entity';
import { AttendanceSubmission } from '../src/entities/attendance-submission.entity';

// 환경 변수 로드 (우선순위: .env.development -> .env)
dotenv.config({ path: path.resolve(__dirname, '../.env.development') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const database = process.env.DB_NAME || 'takeme_dev';

  console.log(`[마이그레이션] 대상 데이터베이스 연결: ${host}:${port}/${database}`);

  const dataSource = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: [
      Student,
      Academy,
      Vehicle,
      User,
      StudentSchedule,
      ScheduleOverride,
      Notification,
      OperationLog,
      ParentMessage,
      AcademyHoliday,
      PickupPoint,
      ChatRoom,
      ChatRoomMember,
      ChatMessage,
      ApprovalRequest,
      BoardPost,
      BoardComment,
      AuditLog,
      Attendance,
      AttendanceSubmission,
    ],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('[마이그레이션] DB 연결 성공');

  const studentRepo = dataSource.getRepository(Student);
  const students = await studentRepo.find();
  console.log(`[마이그레이션] 총 원아 수: ${students.length}`);

  let updatedCount = 0;
  for (const s of students) {
    let rawObj: any = s.raw;
    if (typeof rawObj === 'string') {
      try {
        rawObj = JSON.parse(rawObj);
      } catch {
        rawObj = {};
      }
    }
    if (!rawObj || typeof rawObj !== 'object') continue;

    let changed = false;

    // 성별 파싱
    if (!s.gender) {
      const rawGender = String(rawObj['성별'] ?? rawObj['gender'] ?? '').trim();
      if (rawGender) {
        s.gender = rawGender.includes('여') || rawGender.toUpperCase() === 'F' ? '여' : '남';
        changed = true;
      }
    }

    // 생년월일 파싱
    if (!s.birthDate) {
      const rawBirth = String(rawObj['생년월일'] ?? rawObj['생일'] ?? rawObj['birthDate'] ?? '').trim();
      if (rawBirth) {
        s.birthDate = rawBirth;
        changed = true;
      }
    }

    // 반명 파싱
    if (!s.className) {
      const rawClass = String(rawObj['반명'] ?? rawObj['반'] ?? rawObj['학급'] ?? rawObj['className'] ?? '').trim();
      if (rawClass) {
        s.className = rawClass;
        changed = true;
      }
    }

    // 연락처 파싱
    if (!s.phone) {
      const rawPhone = String(rawObj['학부모연락처'] ?? rawObj['연락처'] ?? rawObj['전화번호'] ?? rawObj['비상연락처'] ?? '').trim();
      if (rawPhone) {
        s.phone = rawPhone;
        changed = true;
      }
    }

    if (changed) {
      await studentRepo.save(s);
      updatedCount++;
    }
  }

  console.log(`[마이그레이션 완료] 정규화 필드 업데이트된 원아 수: ${updatedCount} / ${students.length}`);
  await dataSource.destroy();
}

run().catch(err => {
  console.error('[마이그레이션 실패]', err);
  process.exit(1);
});
