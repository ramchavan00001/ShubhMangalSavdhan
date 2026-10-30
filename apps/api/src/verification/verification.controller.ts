import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Profile, User, Verification, VerificationStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser, Roles } from '../common/auth';
import { APP_CONFIG, AppConfig } from '../config';
import { ID_DOCS, IdDocType, isValidDocNumber, namesMatch, normaliseDocNumber } from '../domain/id-docs';
import { profileCode } from '../domain/matching';
import { NotificationsService } from '../notifications/notifications';
import { sniffImage, StorageService } from '../photos/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';

class IdDto {
  @IsIn(Object.keys(ID_DOCS)) docType: IdDocType;
  @IsString() @Length(6, 24) number: string;
  @IsString() @Length(2, 100) nameOnDoc: string;
}

class ReviewQuery {
  @IsOptional() @IsEnum(VerificationStatus) status?: VerificationStatus;
}

class RejectDto {
  @IsString() @MaxLength(300) reason: string;
}

const MAX_ATTEMPTS_PER_DAY = 5;

function view(v: Verification | null) {
  return v && { id: v.id, status: v.status, docType: v.docType, docLast4: v.docLast4, reason: v.reason, createdAt: v.createdAt };
}

@Controller('verification')
export class VerificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private latest(profileId: string, type: 'ID' | 'SELFIE') {
    return this.prisma.verification.findFirst({ where: { profileId, type }, orderBy: { createdAt: 'desc' } });
  }

  private async guard(me: Profile, type: 'ID' | 'SELFIE') {
    const today = await this.prisma.verification.count({
      where: { profileId: me.id, type, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (today >= MAX_ATTEMPTS_PER_DAY) throw new HttpException('Too many attempts today. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    const pending = await this.prisma.verification.findFirst({ where: { profileId: me.id, type, status: 'PENDING' } });
    if (pending) throw new BadRequestException('Your earlier submission is still being reviewed.');
  }

  @Get()
  async status(@CurrentUser() user: User) {
    const me = await this.profiles.ownProfile(user.id);
    return {
      verified: !!(me.idVerifiedAt && me.selfieVerifiedAt),
      idVerified: !!me.idVerifiedAt,
      selfieVerified: !!me.selfieVerifiedAt,
      id: view(await this.latest(me.id, 'ID')),
      selfie: view(await this.latest(me.id, 'SELFIE')),
      docTypes: Object.entries(ID_DOCS).map(([value, d]) => ({ value, label: d.label, example: d.example })),
      testMode: this.config.kycProvider === 'mock',
    };
  }

  /** The full document number is checked here and then discarded; only the last 4 characters are kept. */
  @Post('id')
  async submitId(@CurrentUser() user: User, @Body() dto: IdDto) {
    const me = await this.profiles.browsingProfile(user.id);
    if (me.idVerifiedAt) throw new BadRequestException('Your ID is already verified.');
    await this.guard(me, 'ID');
    if (!isValidDocNumber(dto.docType, dto.number)) {
      throw new BadRequestException(`That doesn’t look like a valid ${ID_DOCS[dto.docType].label} number (e.g. ${ID_DOCS[dto.docType].example}).`);
    }
    const number = normaliseDocNumber(dto.number);
    const nameOk = namesMatch(me.firstName, me.lastName, dto.nameOnDoc);
    const autoApprove = this.config.kycProvider === 'mock' && nameOk;

    const v = await this.prisma.verification.create({
      data: {
        profileId: me.id,
        type: 'ID',
        provider: this.config.kycProvider,
        docType: dto.docType,
        docLast4: number.slice(-4),
        nameOnDoc: dto.nameOnDoc.trim(),
        status: autoApprove ? 'APPROVED' : 'PENDING',
        reason: nameOk ? null : 'Name on the document differs from the profile name',
        reviewedAt: autoApprove ? new Date() : null,
      },
    });
    if (autoApprove) await this.prisma.profile.update({ where: { id: me.id }, data: { idVerifiedAt: new Date() } });
    return view(v);
  }

  @Post('selfie')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async submitSelfie(@CurrentUser() user: User, @UploadedFile() file?: Express.Multer.File) {
    const me = await this.profiles.browsingProfile(user.id);
    if (me.selfieVerifiedAt) throw new BadRequestException('Your selfie is already verified.');
    if (!file) throw new BadRequestException('Please take or choose a selfie');
    const type = sniffImage(file.buffer);
    if (!type) throw new BadRequestException('Only JPG, PNG or WebP images are allowed');
    const approvedPhotos = await this.prisma.photo.count({ where: { profileId: me.id, status: 'APPROVED' } });
    if (!approvedPhotos) throw new BadRequestException('Add a profile photo first, so we can compare your selfie with it.');
    await this.guard(me, 'SELFIE');

    const fileKey = await this.storage.save(file.buffer, type.ext);
    // Until a face-matching service is connected, a moderator compares the selfie with the photos.
    const v = await this.prisma.verification.create({
      data: { profileId: me.id, type: 'SELFIE', provider: 'manual', fileKey, status: 'PENDING' },
    });
    return view(v);
  }
}

@Roles('ADMIN')
@Controller('admin/verifications')
export class VerificationAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async list(@Query() q: ReviewQuery) {
    const rows = await this.prisma.verification.findMany({
      where: { status: q.status ?? 'PENDING' },
      include: {
        profile: {
          select: {
            id: true, seq: true, userId: true, firstName: true, lastName: true, dateOfBirth: true, city: true,
            photos: { where: { status: 'APPROVED' }, orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }], take: 4, select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((v) => ({
      id: v.id,
      type: v.type,
      status: v.status,
      docType: v.docType,
      docLast4: v.docLast4,
      nameOnDoc: v.nameOnDoc,
      reason: v.reason,
      createdAt: v.createdAt,
      selfieUrl: v.fileKey ? `/admin/verifications/${v.id}/selfie` : null,
      profile: {
        id: v.profile.id,
        userId: v.profile.userId,
        code: profileCode(v.profile.seq),
        name: [v.profile.firstName, v.profile.lastName].filter(Boolean).join(' '),
        dateOfBirth: v.profile.dateOfBirth,
        city: v.profile.city,
        photos: v.profile.photos.map((p) => `/photos/${p.id}`),
      },
    }));
  }

  @Get(':id/selfie')
  async selfie(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const v = await this.prisma.verification.findUnique({ where: { id } });
    if (!v?.fileKey) throw new NotFoundException();
    const ext = v.fileKey.split('.').pop();
    res.set({ 'Content-Type': ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'private, no-store' });
    return new StreamableFile(this.storage.read(v.fileKey));
  }

  @Post(':id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string) {
    const v = await this.prisma.verification.findUnique({ where: { id }, include: { profile: true } });
    if (!v) throw new NotFoundException();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.verification.update({ where: { id }, data: { status: 'APPROVED', reviewedAt: now } }),
      this.prisma.profile.update({ where: { id: v.profileId }, data: v.type === 'ID' ? { idVerifiedAt: now } : { selfieVerifiedAt: now } }),
    ]);
    const p = await this.prisma.profile.findUniqueOrThrow({ where: { id: v.profileId } });
    const both = p.idVerifiedAt && p.selfieVerifiedAt;
    await this.notifications.notify({
      userId: v.profile.userId,
      type: 'VERIFICATION_APPROVED',
      title: both ? 'You’re verified ✓' : `${v.type === 'ID' ? 'ID' : 'Selfie'} verified`,
      body: both ? 'Your profile now shows the Verified badge.' : `Your ${v.type === 'ID' ? 'ID' : 'selfie'} is verified. Complete the other step to get the Verified badge.`,
      link: '/verify',
    });
    return { ok: true };
  }

  @Post(':id/reject')
  @HttpCode(200)
  async reject(@Param('id') id: string, @Body() dto: RejectDto) {
    const v = await this.prisma.verification.findUnique({ where: { id }, include: { profile: true } });
    if (!v) throw new NotFoundException();
    await this.prisma.verification.update({ where: { id }, data: { status: 'REJECTED', reason: dto.reason, reviewedAt: new Date() } });
    await this.notifications.notify({
      userId: v.profile.userId,
      type: 'VERIFICATION_REJECTED',
      title: `${v.type === 'ID' ? 'ID' : 'Selfie'} verification not approved`,
      body: dto.reason,
      link: '/verify',
    });
    return { ok: true };
  }
}

@Module({ controllers: [VerificationController, VerificationAdminController] })
export class VerificationModule {}
