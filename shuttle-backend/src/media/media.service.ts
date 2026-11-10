import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaAsset } from '../entities/media-asset.entity';
import { RoutingService } from '../routing/routing.service';
import { LocationGateway } from '../teacher/location.gateway';
import { resolveMediaRef } from '../utils/s3.util';
import type { JwtPayload } from '../auth/auth-user.decorator';

export interface UploadMediaItemDto {
  base64Data: string;
  filename?: string;
  mimeType?: string;
  vehicleId?: number;
  className?: string;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaAsset)
    private readonly mediaRepo: Repository<MediaAsset>,
    private readonly routingService: RoutingService,
    private readonly locationGateway: LocationGateway,
  ) {}

  async uploadMedia(
    user: JwtPayload,
    dto: {
      base64Data?: string;
      filename?: string;
      mimeType?: string;
      photos?: UploadMediaItemDto[];
      vehicleId?: number;
      className?: string;
    },
    reqHost?: string,
  ) {
    if (!user.academyId) {
      throw new BadRequestException('소속 기관 정보가 필요합니다.');
    }

    const itemsToUpload: UploadMediaItemDto[] = [];
    if (Array.isArray(dto.photos) && dto.photos.length > 0) {
      itemsToUpload.push(...dto.photos);
    } else if (dto.base64Data) {
      itemsToUpload.push({
        base64Data: dto.base64Data,
        filename: dto.filename,
        mimeType: dto.mimeType,
        vehicleId: dto.vehicleId,
        className: dto.className,
      });
    } else {
      throw new BadRequestException('업로드할 사진 데이터(base64Data 또는 photos)가 없습니다.');
    }

    const createdAssets: Array<MediaAsset & { url: string | null }> = [];

    for (const item of itemsToUpload) {
      const uploadResult = await this.routingService.uploadMedia(
        {
          base64Data: item.base64Data,
          filename: item.filename,
          mimeType: item.mimeType,
        },
        reqHost,
      );

      const vehicleId = item.vehicleId !== undefined
        ? (item.vehicleId ? Number(item.vehicleId) : null)
        : (dto.vehicleId ? Number(dto.vehicleId) : null);
      const className = item.className || dto.className || null;

      const asset = this.mediaRepo.create({
        academyId: user.academyId,
        uploaderId: user.sub,
        uploaderRole: user.role,
        uploaderName: (user as any).name || (user as any).username || null,
        vehicleId,
        className,
        storageKey: uploadResult.ref,
        filename: uploadResult.filename,
        mimeType: item.mimeType || null,
        size: uploadResult.size || 0,
      });

      const saved = await this.mediaRepo.save(asset);
      const signedUrl = await resolveMediaRef(saved.storageKey);

      const assetWithUrl = { ...saved, url: signedUrl };
      createdAssets.push(assetWithUrl);

      // Realtime notification to academy room
      this.locationGateway.broadcastMediaUploaded(user.academyId, assetWithUrl);
    }

    return createdAssets.length === 1 ? createdAssets[0] : createdAssets;
  }

  async listMedia(
    user: JwtPayload,
    query: {
      from?: string;
      to?: string;
      vehicleId?: string | number;
      className?: string;
    },
  ) {
    if (!user.academyId) {
      throw new BadRequestException('소속 기관 정보가 필요합니다.');
    }

    const qb = this.mediaRepo.createQueryBuilder('asset')
      .where('asset.academyId = :academyId', { academyId: user.academyId });

    if (query.from) {
      const fromDate = new Date(query.from);
      if (!isNaN(fromDate.getTime())) {
        qb.andWhere('asset.createdAt >= :from', { from: fromDate });
      }
    }

    if (query.to) {
      const toDate = new Date(query.to);
      if (!isNaN(toDate.getTime())) {
        qb.andWhere('asset.createdAt <= :to', { to: toDate });
      }
    }

    if (query.vehicleId) {
      const vId = Number(query.vehicleId);
      if (!isNaN(vId)) {
        qb.andWhere('asset.vehicleId = :vId', { vId });
      }
    }

    if (query.className) {
      qb.andWhere('asset.className = :className', { className: query.className });
    }

    qb.orderBy('asset.createdAt', 'DESC');

    const assets = await qb.getMany();

    // Resolve S3 signed URL or local path for each asset
    const results = await Promise.all(
      assets.map(async (asset) => {
        const url = await resolveMediaRef(asset.storageKey);
        return {
          ...asset,
          url,
        };
      }),
    );

    return results;
  }

  async deleteMedia(user: JwtPayload, id: number) {
    if (!user.academyId) {
      throw new BadRequestException('소속 기관 정보가 필요합니다.');
    }

    const asset = await this.mediaRepo.findOne({ where: { id } });
    if (!asset || asset.academyId !== user.academyId) {
      throw new NotFoundException('해당 사진을 찾을 수 없습니다.');
    }

    // 올린 사람 또는 기관 관리자만 삭제 가능
    const isOwner = asset.uploaderId === user.sub;
    const isAdmin = user.role === 'ACADEMY_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('사진을 삭제할 권한이 없습니다.');
    }

    await this.mediaRepo.remove(asset);

    // Realtime notification to academy room
    this.locationGateway.broadcastMediaDeleted(user.academyId, id);

    return { success: true, id };
  }
}
