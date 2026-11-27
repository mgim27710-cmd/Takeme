import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * 학부모가 자녀의 학생 계정을 만들 때 발급하는 초대 코드.
 * 학생이 이 코드로 가입하면 그 원아와 학생 계정이 연결된다. (한 번만, 24시간 안에)
 */
@Entity('student_invites')
export class StudentInvite {
  @PrimaryGeneratedColumn()
  id: number;

  /** 학생 계정을 연결할 원아 */
  @Column({ type: 'int' })
  @Index()
  studentId: number;

  /** 코드를 발급한 학부모 계정 */
  @Column({ type: 'int' })
  parentUserId: number;

  @Column({ type: 'varchar', length: 12, unique: true })
  code: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** 학부모가 (만 14세 미만 자녀의 가입에) 동의한 시각 */
  @Column({ type: 'timestamp', nullable: true })
  consentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  usedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
