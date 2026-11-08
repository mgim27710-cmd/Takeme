import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('academies')
export class Academy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: 0 })
  vehicleCount: number;

  @Column({ nullable: true })
  roadAddress: string;

  @Column({ nullable: true })
  latitude: string;

  @Column({ nullable: true })
  longitude: string;

  @Column({ nullable: true })
  authCode: string; // Used for students to register and link to this academy

  @Column({ nullable: true })
  kakaoPlaceId: string;

  @Column({ nullable: true })
  businessNumber: string; // 사업자 등록번호 (예: 123-45-67890)

  @OneToOne(() => User)
  @JoinColumn()
  owner: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
