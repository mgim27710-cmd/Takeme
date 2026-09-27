import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { Academy } from '../entities/academy.entity';
import { Student } from '../entities/student.entity';

import { Vehicle } from '../entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Academy, Student, Vehicle])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
