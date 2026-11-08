import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Academy } from './academy.entity';

@Entity('yearly_zone_mappings')
export class YearlyZoneMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Academy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academyId' })
  academy: Academy;

  @Column({ default: '전년도' })
  academicYear: string; // e.g. '2025학년도', '2026학년도' or '전년도'

  @Column({ default: '전년도 구역 매핑 이력' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Snapshot of vehicle zones, polygon coordinates, driver/teacher names, student counts
  @Column({ type: 'simple-json' })
  vehicleMappings: {
    vehicleId: number;
    busNumber: string;
    plateNumber?: string;
    driverName?: string;
    driverUserId?: number;
    teacherName?: string;
    teacherUserId?: number;
    capacity?: number;
    colorHex?: string;
    polygonCoordinates: [number, number][];
    studentCount?: number;
    studentsSummary?: { id: number; name: string; address?: string; boardingLocation?: string }[];
  }[];

  @Column({ type: 'int', default: 0 })
  totalStudents: number;

  @Column({ type: 'int', default: 0 })
  totalVehicles: number;

  @CreateDateColumn()
  archivedAt: Date;
}
