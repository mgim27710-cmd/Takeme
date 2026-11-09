import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectionsController } from './directions.controller';
import { DirectionsService } from './directions.service';
import { User } from '../entities/user.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([User])],
  controllers: [DirectionsController],
  providers: [DirectionsService],
})
export class DirectionsModule {}
