import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../entities/user.entity';
import { Academy } from '../entities/academy.entity';
import { Student } from '../entities/student.entity';
import { Vehicle } from '../entities/vehicle.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Academy, Student, Vehicle]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'TakemeJwtSecretKey2026!@#$%^';
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') || process.env.JWT_EXPIRES_IN || '60m') as any;
        return { secret, signOptions: { expiresIn } };
      },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, TypeOrmModule],
})
export class AuthModule {}
