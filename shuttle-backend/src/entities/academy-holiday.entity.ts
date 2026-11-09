import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Academy } from './academy.entity';

export enum CalendarEventType {
  ACADEMY_HOLIDAY = 'ACADEMY_HOLIDAY', // 기관 전체 휴업
  CLASS_HOLIDAY = 'CLASS_HOLIDAY',     // 반별 휴업
  VACATION = 'VACATION',               // 방학
  EVENT = 'EVENT',                     // 유치원/학원 행사
}

@Entity('academy_holidays')
export class AcademyHoliday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: CalendarEventType.ACADEMY_HOLIDAY })
  type: CalendarEventType;

  @Column({ type: 'varchar', nullable: true })
  title: string; // 일정/행사 제목

  @Column({ type: 'date' })
  startDate: string; // YYYY-MM-DD

  @Column({ type: 'date' })
  endDate: string; // YYYY-MM-DD

  @Column({ type: 'varchar', nullable: true })
  targetClass: string; // null이면 기관 전체 대상, 값이 있으면 특정 반 대상

  @Column({ type: 'text', nullable: true })
  reason: string; // 사유 또는 상세 설명

  @ManyToOne(() => Academy, { nullable: true, onDelete: 'CASCADE' })
  academy: Academy;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
