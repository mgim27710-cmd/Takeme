import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Academy } from './academy.entity';

@Entity('cloud_documents')
export class CloudDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: true })
  academyId: number;

  @ManyToOne(() => Academy, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academyId' })
  academy: Academy;

  @Column({ type: 'varchar', length: 50, default: '유치원' })
  educationLevel: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 100, default: 'etc' })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'int', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', length: 100, default: 'application/octet-stream' })
  fileType: string;

  @Column({ type: 'text' })
  fileUrl: string;

  @Column({ type: 'varchar', length: 100, default: '관리자' })
  uploadedBy: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
