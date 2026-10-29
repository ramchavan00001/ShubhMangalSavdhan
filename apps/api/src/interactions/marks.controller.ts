import { Body, Controller, Delete, HttpCode, NotFoundException, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { MarkType, User } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';

class MarkDto {
  @IsString() profileId: string;
  @IsEnum(MarkType) type: MarkType;
}

export const REPORT_REASONS = [
  'FAKE_PROFILE',
  'ASKING_FOR_MONEY',
  'ABUSIVE_BEHAVIOUR',
  'ALREADY_MARRIED',
  'INAPPROPRIATE_PHOTOS',
  'OTHER',
] as const;

class ReportDto {
  @IsString() profileId: string;
  @IsIn(REPORT_REASONS) reason: (typeof REPORT_REASONS)[number];
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

/** Shortlist, ignore and block. */
@Controller('marks')
export class MarksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  @Post()
  @HttpCode(200)
  async add(@CurrentUser() user: User, @Body() dto: MarkDto) {
    const me = await this.profiles.browsingProfile(user.id);
    if (dto.profileId === me.id) throw new NotFoundException();
    const target = await this.prisma.profile.findUnique({ where: { id: dto.profileId } });
    if (!target) throw new NotFoundException();
    await this.prisma.profileMark.upsert({
      where: { ownerId_targetId_type: { ownerId: me.id, targetId: target.id, type: dto.type } },
      create: { ownerId: me.id, targetId: target.id, type: dto.type },
      update: {},
    });
    if (dto.type === 'BLOCK') {
      // Blocking cancels any pending interests between the two members.
      await this.prisma.interest.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { senderId: me.id, receiverId: target.id },
            { senderId: target.id, receiverId: me.id },
          ],
        },
        data: { status: 'WITHDRAWN' },
      });
    }
    return { ok: true };
  }

  @Delete(':profileId/:type')
  @HttpCode(200)
  async remove(
    @CurrentUser() user: User,
    @Param('profileId') profileId: string,
    @Param('type', new ParseEnumPipe(MarkType)) type: MarkType,
  ) {
    const me = await this.profiles.ownProfile(user.id);
    await this.prisma.profileMark.deleteMany({ where: { ownerId: me.id, targetId: profileId, type } });
    return { ok: true };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: ReportDto) {
    const me = await this.profiles.ownProfile(user.id);
    if (dto.profileId === me.id) throw new NotFoundException();
    const target = await this.prisma.profile.findUnique({ where: { id: dto.profileId } });
    if (!target) throw new NotFoundException();
    const report = await this.prisma.report.create({
      data: { reporterId: me.id, targetId: target.id, reason: dto.reason, details: dto.details },
    });
    return { id: report.id, message: 'Thank you. Our team will review this report.' };
  }
}
