import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Academy } from './academy.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

@Entity('media_assets')
@Index(['academyId', 'createdAt'])
export class MediaAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  academyId: number;

  @ManyToOne(() => Academy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academyId' })
  academy: Academy;

  @Column()
  @Index()
  uploaderId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  @Column({ length: 50 })
  uploaderRole: string;

  @Column({ length: 100, nullable: true })
  uploaderName: string;

  @Column({ type: 'int', nullable: true })
  vehicleId: number | null;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle?: Vehicle | null;

  @Column({ length: 100, nullable: true })
  className: string | null;

  @Column({ length: 500 })
  storageKey: string;

  @Column({ length: 255, nullable: true })
  filename: string | null;

  @Column({ length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', default: 0 })
  size: number;

  @CreateDateColumn()
  createdAt: Date;
}
