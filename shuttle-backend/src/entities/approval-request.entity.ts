import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Student } from './student.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { Academy } from './academy.entity';

export enum ApprovalDirection {
  PARENT_TO_TEACHER = 'PARENT_TO_TEACHER',
  TEACHER_TO_PARENT = 'TEACHER_TO_PARENT',
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  ALL = 'ALL',
}

export enum RequestDirection {
  MORNING = 'MORNING',     // 등원
  AFTERNOON = 'AFTERNOON', // 하원
  ALL = 'ALL',             // 종일 / 등하원 전체
}

export enum ChangeRequestType {
  ABSENCE = 'ABSENCE',                         // 결석
  LATENESS = 'LATENESS',                       // 지각
  INDIVIDUAL_DISMISSAL = 'INDIVIDUAL_DISMISSAL', // 개별하원 (셔틀 미탑승)
  PICKUP = 'PICKUP',                           // 학부모 직접 픽업
  NO_SHUTTLE = 'NO_SHUTTLE',                   // 셔틀 미이용
  ONE_TIME_BOARDING = 'ONE_TIME_BOARDING',     // 타 차량/임시 일회성 탑승
  CHANGE_LOCATION = 'CHANGE_LOCATION',         // 등하원 위치/정류장 변경
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('approval_requests')
export class ApprovalRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: ChangeRequestType.CHANGE_LOCATION })
  type: ChangeRequestType;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  requester: User;

  @Column({ type: 'varchar', nullable: true })
  requesterRole: string; // PARENT, HOMEROOM_TEACHER, DESK_STAFF, ACADEMY_ADMIN

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  student: Student;

  @Column({ type: 'date', nullable: true })
  targetDate: string; // YYYY-MM-DD (KST)

  @Column({ type: 'varchar', nullable: true })
  targetTime: string; // HH:mm (KST)

  @Column({ type: 'varchar', default: RequestDirection.ALL })
  direction: string; // MORNING | AFTERNOON | ALL | PARENT_TO_TEACHER | TEACHER_TO_PARENT

  @Column({ type: 'text', nullable: true })
  reason: string; // 사유

  // 기존 호환용 위치/주소 필드
  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({ type: 'varchar', nullable: true })
  zipCode: string;

  @Column({ type: 'varchar', nullable: true })
  time: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'date', nullable: true })
  startDate: string; // YYYY-MM-DD

  @Column({ type: 'date', nullable: true })
  endDate: string; // YYYY-MM-DD

  // 신규 정류장/위치 변경 상세
  @Column({ type: 'float', nullable: true })
  newLatitude: number;

  @Column({ type: 'float', nullable: true })
  newLongitude: number;

  @Column({ type: 'varchar', nullable: true })
  newAddress: string;

  // 일회성 탑승 또는 변경 대상 차량
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  targetVehicle: Vehicle;

  @Column({ default: false })
  isCapacityExceeded: boolean; // 신청 시점 차량 정원 초과 여부

  @Column({ type: 'varchar', default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  // 처리 정보 (기관 관리자)
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  processedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string; // 반려 시 필수 사유

  @ManyToOne(() => Academy, { nullable: true, onDelete: 'CASCADE' })
  academy: Academy;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
