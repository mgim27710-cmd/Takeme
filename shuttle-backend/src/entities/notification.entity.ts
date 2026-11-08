import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { User } from './user.entity';
import { ApprovalRequest } from './approval-request.entity';
import { Academy } from './academy.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  recipient: User; // 특정 수신 대상 사용자

  @Column({ type: 'varchar', nullable: true })
  recipientRole: string; // 수신자 역할 (PARENT, HOMEROOM_TEACHER, DRIVER, ACADEMY_ADMIN 등)

  @Column({ type: 'varchar', default: 'NOTICE' })
  type: string; // APPROVAL_REQUEST, APPROVAL_RESULT, SCHEDULE_CHANGE, VEHICLE_ALERT, ATTENDANCE, NOTICE

  @ManyToOne(() => ApprovalRequest, { nullable: true, onDelete: 'SET NULL' })
  approvalRequest: ApprovalRequest; // 관련 신청 (있는 경우)

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'CASCADE' })
  vehicle: Vehicle; // 차량 관련 알림인 경우 연결

  @ManyToOne(() => Academy, { nullable: true, onDelete: 'CASCADE' })
  academy: Academy; // 유치원/학원

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean; // 읽음 여부

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
