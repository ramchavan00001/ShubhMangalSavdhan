import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Res } from '@nestjs/common';
import { User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, SESSION_COOKIE } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyDto, UpdateProfileDto, WIZARD_STEPS } from './dto';
import { PreferenceDto } from './preferences.dto';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.profiles.getOwn(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.id, dto);
  }

  @Patch('me/step/:step')
  saveStep(@CurrentUser() user: User, @Param('step', ParseIntPipe) step: number, @Body() dto: UpdateProfileDto) {
    return this.profiles.saveStep(user.id, step, dto);
  }

  @Post('me/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: User) {
    return this.profiles.submit(user.id);
  }

  @Put('me/privacy')
  privacy(@CurrentUser() user: User, @Body() dto: PrivacyDto) {
    return this.profiles.updatePrivacy(user.id, dto);
  }

  @Get('me/preferences')
  async getPreferences(@CurrentUser() user: User) {
    const me = await this.profiles.ownProfile(user.id);
    return (await this.prisma.partnerPreference.findUnique({ where: { profileId: me.id } })) ?? null;
  }

  @Put('me/preferences')
  async putPreferences(@CurrentUser() user: User, @Body() dto: PreferenceDto) {
    const me = await this.profiles.ownProfile(user.id);
    if (dto.ageMin != null && dto.ageMax != null && dto.ageMin > dto.ageMax) {
      throw new BadRequestException('Minimum age cannot be more than maximum age');
    }
    if (dto.heightMinCm != null && dto.heightMaxCm != null && dto.heightMinCm > dto.heightMaxCm) {
      throw new BadRequestException('Minimum height cannot be more than maximum height');
    }
    const pref = await this.prisma.partnerPreference.upsert({
      where: { profileId: me.id },
      create: { profileId: me.id, ...dto },
      update: dto,
    });
    // Preferences are the wizard's last step.
    if (me.onboardingStep < WIZARD_STEPS) {
      await this.prisma.profile.update({ where: { id: me.id }, data: { onboardingStep: WIZARD_STEPS } });
    }
    return pref;
  }

  @Delete('me')
  @HttpCode(200)
  async remove(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    await this.profiles.deleteAccount(user.id);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get(':code')
  view(@CurrentUser() user: User, @Param('code') code: string) {
    return this.profiles.getPublic(user.id, code);
  }
}
