import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAsset } from '../entities/media-asset.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { RoutingModule } from '../routing/routing.module';
import { TeacherModule } from '../teacher/teacher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaAsset]),
    RoutingModule,
    TeacherModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}

