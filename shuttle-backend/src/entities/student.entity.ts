import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { Academy } from './academy.entity';
import { Vehicle } from './vehicle.entity';
import { User } from './user.entity';
import { StudentSchedule } from './student-schedule.entity';
import { encryptionTransformer } from '../utils/crypto.util';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  adminDisplayName: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  boardingLocation: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ type: 'float', nullable: true })
  latitude: number;

  @Column({ type: 'float', nullable: true })
  longitude: number;

  @ManyToOne(() => Academy, { onDelete: 'CASCADE' })
  academy: Academy;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  assignedVehicle: Vehicle | null; // 등원 차량

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  assignedDepartureVehicle: Vehicle | null; // 하원 차량

  @Column({ type: 'boolean', default: false })
  isNotRiding: boolean; // 미탑승 원아 여부 (도보/자차 등원)

  @Column({ nullable: true })
  dropoffLocation: string; // 하차지 (하원지)

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  raw: any;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  studentUser: User;

  @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  parentUser: User;

  @Column({ type: 'int', nullable: true, default: 1 })
  runNumber: number; // 1차, 2차 등 운행 회차

  @Column({ default: 'UNREGISTERED' })
  approvalStatus: string; // 'UNREGISTERED' | 'PENDING' | 'APPROVED'

  @Column({ default: 'WAITING' })
  boardStatus: string; // 'WAITING' | 'BOARDED' | 'ABSENT'

  @Column({ type: 'timestamp', nullable: true })
  actualBoardTime: Date;

  @Column({ type: 'text', nullable: true })
  teacherMemo: string;

  @OneToMany(() => StudentSchedule, schedule => schedule.student, { cascade: true })
  schedules: StudentSchedule[];
}
