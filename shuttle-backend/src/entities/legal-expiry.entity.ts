import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';

@Entity('legal_expiries')
export class LegalExpiry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  vehicleId: number;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'int', nullable: true })
  academyId: number;

  @Column({ type: 'varchar', length: 50, default: '유치원' })
  educationLevel: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  insuranceExpiry: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 30, nullable: true })
  inspectionExpiry: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 30, nullable: true })
  driverEduExpiry: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 30, nullable: true })
  companionEduExpiry: string; // YYYY-MM-DD

  @UpdateDateColumn()
  updatedAt: Date;
}
