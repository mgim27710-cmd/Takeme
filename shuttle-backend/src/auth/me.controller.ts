import { Controller, Get, Put, Post, Delete, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserDevice } from '../entities/user-device.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './auth-user.decorator';
import type { JwtPayload } from './auth-user.decorator';
import { getUserNotificationSettings } from '../utils/notification.util';
import { registerDeviceEndpoint, deleteDeviceEndpoint } from '../utils/sns.util';

@Controller(['me', 'api/me'])
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
  ) {}

  @Get('notification-settings')
  async getNotificationSettings(@AuthUser() authUser: JwtPayload) {
    if (!authUser?.sub) throw new BadRequestException('로그인이 필요합니다.');
    const user = await this.userRepository.findOne({ where: { id: authUser.sub } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');
    return getUserNotificationSettings(user);
  }

  @Put('notification-settings')
  async updateNotificationSettings(
    @AuthUser() authUser: JwtPayload,
    @Body() body: Record<string, boolean>,
  ) {
    if (!authUser?.sub) throw new BadRequestException('로그인이 필요합니다.');
    const user = await this.userRepository.findOne({ where: { id: authUser.sub } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const current = user.notificationSettings || {};
    const updated = { ...current, ...body };
    user.notificationSettings = updated;

    if (body.notifyShuttleOperation !== undefined) {
      user.notifyShuttleOperation = !!body.notifyShuttleOperation;
    }
    if (body.notifyBoardPost !== undefined) {
      user.notifyBoardPost = !!body.notifyBoardPost;
      if (body.notifyNotice === undefined) {
        user.notifyNotice = !!body.notifyBoardPost;
        updated.notifyNotice = !!body.notifyBoardPost;
        updated.notice = !!body.notifyBoardPost;
      }
      if (body.notifyPost === undefined) {
        user.notifyPost = !!body.notifyBoardPost;
        updated.notifyPost = !!body.notifyBoardPost;
        updated.post = !!body.notifyBoardPost;
      }
    }
    if (body.notifyNotice !== undefined) {
      user.notifyNotice = !!body.notifyNotice;
      updated.notice = !!body.notifyNotice;
    }
    if (body.notice !== undefined) {
      user.notifyNotice = !!body.notice;
      updated.notifyNotice = !!body.notice;
    }
    if (body.notifyPost !== undefined) {
      user.notifyPost = !!body.notifyPost;
      updated.post = !!body.notifyPost;
    }
    if (body.post !== undefined) {
      user.notifyPost = !!body.post;
      updated.notifyPost = !!body.post;
    }

    await this.userRepository.save(user);
    return {
      success: true,
      settings: getUserNotificationSettings(user),
    };
  }

  @Post('device-token')
  async registerDeviceToken(
    @AuthUser() authUser: JwtPayload,
    @Body() body: { deviceToken: string; platform?: string },
  ) {
    if (!authUser?.sub) throw new BadRequestException('로그인이 필요합니다.');
    if (!body?.deviceToken) throw new BadRequestException('deviceToken이 누락되었습니다.');

    const user = await this.userRepository.findOne({ where: { id: authUser.sub } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const platform = body.platform || 'android';
    const endpointArn = await registerDeviceEndpoint(body.deviceToken, `user_${user.id}`);

    // Update user_devices: 기존 동일 플랫폼 기기 및 이전 등록 기기 정리 후 최신 1건만 유지
    await this.userDeviceRepository.delete({ userId: user.id, platform });
    await this.userDeviceRepository.delete({ deviceToken: body.deviceToken });

    const dev = this.userDeviceRepository.create({
      userId: user.id,
      deviceToken: body.deviceToken,
      endpointArn,
      platform,
    });
    await this.userDeviceRepository.save(dev);

    // Update direct user fields
    user.deviceToken = body.deviceToken;
    user.snsEndpointArn = endpointArn;
    await this.userRepository.save(user);

    return {
      success: true,
      endpointArn,
    };
  }

  @Delete('device-token')
  async removeDeviceToken(
    @AuthUser() authUser: JwtPayload,
    @Body() body: { deviceToken?: string },
  ) {
    if (!authUser?.sub) throw new BadRequestException('로그인이 필요합니다.');

    const tokenToDelete = body?.deviceToken;
    if (tokenToDelete) {
      const dev = await this.userDeviceRepository.findOne({ where: { deviceToken: tokenToDelete } });
      if (dev) {
        await deleteDeviceEndpoint(dev.endpointArn);
        await this.userDeviceRepository.delete(dev.id);
      }
    } else {
      const devices = await this.userDeviceRepository.find({ where: { userId: authUser.sub } });
      for (const dev of devices) {
        await deleteDeviceEndpoint(dev.endpointArn);
      }
      await this.userDeviceRepository.delete({ userId: authUser.sub });
    }

    const user = await this.userRepository.findOne({ where: { id: authUser.sub } });
    if (user && (!tokenToDelete || user.deviceToken === tokenToDelete)) {
      user.deviceToken = null;
      user.snsEndpointArn = null;
      await this.userRepository.save(user);
    }

    return { success: true };
  }
}
