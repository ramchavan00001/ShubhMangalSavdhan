import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AiService } from '../ai/ai.service';
import { CurrentUser } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { acceptedConnections, canSeePhotos } from '../profiles/presenter';
import { ProfilesService } from '../profiles/profiles.service';
import { sniffImage, StorageService } from './storage.service';

export const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;

@Controller('photos')
export class PhotosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly profiles: ProfilesService,
    private readonly ai: AiService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please choose a photo (JPG, PNG or WebP, up to 5 MB)');
    const type = sniffImage(file.buffer);
    if (!type) throw new BadRequestException('Only JPG, PNG or WebP photos are allowed');

    const me = await this.profiles.ownProfile(user.id);
    const count = await this.prisma.photo.count({ where: { profileId: me.id } });
    if (count >= MAX_PHOTOS) throw new BadRequestException(`You can upload up to ${MAX_PHOTOS} photos`);

    const fileKey = await this.storage.save(file.buffer, type.ext);
    const photo = await this.prisma.photo.create({
      data: { profileId: me.id, fileKey, mimeType: type.mime, isMain: count === 0, sortOrder: count },
    });
    this.ai.screenInBackground(photo.id, file.buffer, type.mime as 'image/jpeg' | 'image/png' | 'image/webp');
    return { id: photo.id, url: `/photos/${photo.id}`, isMain: photo.isMain, status: photo.status };
  }

  @Post(':id/main')
  @HttpCode(200)
  async setMain(@CurrentUser() user: User, @Param('id') id: string) {
    const me = await this.profiles.ownProfile(user.id);
    const photo = await this.prisma.photo.findFirst({ where: { id, profileId: me.id } });
    if (!photo) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.photo.updateMany({ where: { profileId: me.id }, data: { isMain: false } }),
      this.prisma.photo.update({ where: { id }, data: { isMain: true } }),
    ]);
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    const me = await this.profiles.ownProfile(user.id);
    const photo = await this.prisma.photo.findFirst({ where: { id, profileId: me.id } });
    if (!photo) throw new NotFoundException();
    await this.prisma.photo.delete({ where: { id } });
    await this.storage.remove(photo.fileKey);
    if (photo.isMain) {
      const next = await this.prisma.photo.findFirst({ where: { profileId: me.id }, orderBy: { sortOrder: 'asc' } });
      if (next) await this.prisma.photo.update({ where: { id: next.id }, data: { isMain: true } });
    }
    return { ok: true };
  }

  /** Serves a photo only to people allowed to see it. */
  @Get(':id')
  async serve(@CurrentUser() user: User, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const photo = await this.prisma.photo.findUnique({ where: { id }, include: { profile: true } });
    if (!photo) throw new NotFoundException();

    const isOwner = photo.profile.userId === user.id;
    if (!isOwner && user.role !== 'ADMIN') {
      if (photo.status !== 'APPROVED' || photo.profile.status !== 'APPROVED' || photo.profile.hidden) {
        throw new NotFoundException();
      }
      const me = await this.profiles.browsingProfile(user.id);
      const blocked = await this.prisma.profileMark.findFirst({
        where: {
          type: 'BLOCK',
          OR: [
            { ownerId: me.id, targetId: photo.profileId },
            { ownerId: photo.profileId, targetId: me.id },
          ],
        },
      });
      if (blocked) throw new NotFoundException();
      const viewer = await this.profiles.viewer(user.id, me);
      const accepted = (await acceptedConnections(this.prisma, me.id, [photo.profileId])).has(photo.profileId);
      if (!canSeePhotos(photo.profile, viewer, accepted)) throw new NotFoundException();
    }

    res.set({ 'Content-Type': photo.mimeType, 'Cache-Control': 'private, max-age=300' });
    return new StreamableFile(this.storage.read(photo.fileKey));
  }
}
