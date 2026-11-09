import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Student } from './student.entity';
import { ApprovalRequest } from './approval-request.entity';

export enum OverrideType {
  ABSENCE = 'ABSENCE',
  CHANGE_LOCATION = 'CHANGE_LOCATION',
  LATENESS = 'LATENESS',
  INDIVIDUAL_DISMISSAL = 'INDIVIDUAL_DISMISSAL',
  PICKUP = 'PICKUP',
  NO_SHUTTLE = 'NO_SHUTTLE',
  ONE_TIME_BOARDING = 'ONE_TIME_BOARDING',
}

@Entity('schedule_overrides')
export class ScheduleOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  student: Student;

  @ManyToOne(() => ApprovalRequest, { nullable: true, onDelete: 'SET NULL' })
  approvalRequest: ApprovalRequest; // 승인된 변경 신청과의 연결

  @Column({ type: 'date' })
  startDate: string; // YYYY-MM-DD

  @Column({ type: 'date' })
  endDate: string; // YYYY-MM-DD

  @Column({ type: 'varchar' })
  overrideType: OverrideType;

  @Column({ type: 'varchar', nullable: true, default: 'ALL' })
  direction: string; // MORNING | AFTERNOON | ALL

  @Column({ type: 'varchar', nullable: true })
  targetTime: string; // HH:mm

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', nullable: true })
  newAddress: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @Column({ type: 'int', nullable: true })
  newVehicleId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
