import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ACADEMY_ADMIN = 'ACADEMY_ADMIN',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  DRIVER = 'DRIVER',
  TEACHER = 'TEACHER',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.STUDENT })
  role: UserRole;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  otpSecret: string; // Google OTP secret

  @Column({ default: false })
  isOtpEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
