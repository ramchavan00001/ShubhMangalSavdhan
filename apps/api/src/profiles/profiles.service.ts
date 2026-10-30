import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Profile } from '@prisma/client';
import { ageOn, MIN_AGE } from '../domain/age';
import { parseProfileCode, Preference, profileCode, profileCompleteness } from '../domain/matching';
import { MembershipService } from '../membership/membership.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../photos/storage.service';
import { MIN_ABOUT_LENGTH, PrivacyDto, STEP_REQUIREMENTS, UpdateProfileDto, WIZARD_STEPS } from './dto';
import { acceptedConnections, approvedPhotos, toDetail, Viewer } from './presenter';

/** True if text contains something that looks like a phone number (10+ digits) or an email. */
export function containsContactDetails(text: string): boolean {
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return true;
  const runs = text.match(/\d[\d\s-]*\d/g) ?? [];
  return runs.some((r) => r.replace(/\D/g, '').length >= 10);
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly storage: StorageService,
  ) {}

  async ownProfile(userId: string): Promise<Profile> {
    const p = await this.prisma.profile.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('Profile not found');
    return p;
  }

  /** Own profile that has been submitted (needed to browse). */
  async browsingProfile(userId: string): Promise<Profile> {
    const p = await this.ownProfile(userId);
    if (p.status === 'DRAFT' || !p.gender) {
      throw new ForbiddenException('Please complete your profile first');
    }
    return p;
  }

  /** Own profile that is approved (needed to send interests or unlock contacts). */
  async approvedProfile(userId: string): Promise<Profile> {
    const p = await this.ownProfile(userId);
    if (p.status !== 'APPROVED') {
      throw new ForbiddenException('Your profile is still under review. You can do this once it is approved.');
    }
    return p;
  }

  async viewer(userId: string, profile?: Profile): Promise<Viewer> {
    const p = profile ?? (await this.ownProfile(userId));
    const [tier, preference] = await Promise.all([
      this.membership.tier(userId),
      this.prisma.partnerPreference.findUnique({ where: { profileId: p.id } }),
    ]);
    return { profileId: p.id, isPremium: tier === 'PREMIUM', preference: preference as Preference | null };
  }

  /** Profiles `me` is allowed to discover: approved, visible, opposite gender, no blocks either way. */
  discoverableWhere(me: Profile): Prisma.ProfileWhereInput {
    return {
      id: { not: me.id },
      status: 'APPROVED',
      hidden: false,
      gender: me.gender === 'MALE' ? 'FEMALE' : 'MALE',
      user: { status: 'ACTIVE' },
      marksMade: { none: { targetId: me.id, type: 'BLOCK' } },
      marksReceived: { none: { ownerId: me.id, type: 'BLOCK' } },
    };
  }

  async getOwn(userId: string) {
    const p = await this.prisma.profile.findUnique({
      where: { userId },
      include: { photos: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }] }, preference: true },
    });
    if (!p) throw new NotFoundException();
    return {
      ...p,
      code: profileCode(p.seq),
      completeness: profileCompleteness(p, p.photos.length, !!p.preference),
      photos: p.photos.map((ph) => ({ id: ph.id, url: `/photos/${ph.id}`, isMain: ph.isMain, status: ph.status })),
      wizardSteps: WIZARD_STEPS,
    };
  }

  private validate(current: Profile, dto: UpdateProfileDto) {
    const locked = current.status !== 'DRAFT' && current.status !== 'REJECTED';
    if (locked && dto.gender && dto.gender !== current.gender) {
      throw new BadRequestException('Gender cannot be changed after your profile is submitted. Please contact support.');
    }
    if (locked && dto.dateOfBirth && current.dateOfBirth && new Date(dto.dateOfBirth).getTime() !== current.dateOfBirth.getTime()) {
      throw new BadRequestException('Date of birth cannot be changed after your profile is submitted. Please contact support.');
    }
    const renamed = (dto.firstName && dto.firstName.trim() !== current.firstName) || (dto.lastName && dto.lastName.trim() !== current.lastName);
    if (current.idVerifiedAt && renamed) {
      throw new BadRequestException('Your name is verified against your ID and can’t be changed here. Please contact support.');
    }
    const gender = dto.gender ?? current.gender;
    const dob = dto.dateOfBirth ? new Date(dto.dateOfBirth) : current.dateOfBirth;
    if (gender && dob) {
      const age = ageOn(dob);
      if (age < MIN_AGE[gender]) {
        throw new BadRequestException(
          `The legal marriage age in India is ${MIN_AGE[gender]} for ${gender === 'MALE' ? 'men' : 'women'}.`,
        );
      }
      if (age > 80) throw new BadRequestException('Please check the date of birth.');
    }
    if (dto.aboutMe != null) {
      if (dto.aboutMe.trim().length < MIN_ABOUT_LENGTH) {
        throw new BadRequestException(`Please write at least ${MIN_ABOUT_LENGTH} characters about yourself.`);
      }
      if (containsContactDetails(dto.aboutMe)) {
        throw new BadRequestException('Please do not include phone numbers or email addresses in your description.');
      }
    }
  }

  private toData(dto: UpdateProfileDto): Prisma.ProfileUpdateInput {
    const data: Prisma.ProfileUpdateInput = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      (data as Record<string, unknown>)[k] = typeof v === 'string' ? v.trim() : v;
    }
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    return data;
  }

  /** Save one wizard step and move the user forward. */
  async saveStep(userId: string, step: number, dto: UpdateProfileDto) {
    if (!Number.isInteger(step) || step < 1 || step > WIZARD_STEPS) throw new BadRequestException('Unknown step');
    const current = await this.ownProfile(userId);
    this.validate(current, dto);
    const merged = { ...current, ...this.toData(dto) } as Record<string, unknown>;
    const missing = (STEP_REQUIREMENTS[step] ?? []).filter((f) => merged[f] == null || merged[f] === '');
    if (missing.length) throw new BadRequestException(`Please fill in: ${missing.join(', ')}`);

    await this.prisma.profile.update({
      where: { id: current.id },
      data: { ...this.toData(dto), onboardingStep: Math.max(current.onboardingStep, Math.min(step + 1, WIZARD_STEPS)) },
    });
    return this.getOwn(userId);
  }

  /** Finish the wizard and send the profile for review. */
  async submit(userId: string) {
    const current = await this.ownProfile(userId);
    const values = current as unknown as Record<string, unknown>;
    for (const fields of Object.values(STEP_REQUIREMENTS)) {
      const missing = fields.filter((f) => values[f] == null || values[f] === '');
      if (missing.length) throw new BadRequestException(`Please complete your profile: ${missing.join(', ')}`);
    }
    if (current.status === 'DRAFT' || current.status === 'REJECTED') {
      await this.prisma.profile.update({
        where: { id: current.id },
        data: { status: 'PENDING', rejectionReason: null, onboardingStep: WIZARD_STEPS },
      });
    }
    return this.getOwn(userId);
  }

  /** Edit fields after onboarding. */
  async update(userId: string, dto: UpdateProfileDto) {
    const current = await this.ownProfile(userId);
    this.validate(current, dto);
    await this.prisma.profile.update({ where: { id: current.id }, data: this.toData(dto) });
    return this.getOwn(userId);
  }

  async updatePrivacy(userId: string, dto: PrivacyDto) {
    const current = await this.ownProfile(userId);
    await this.prisma.profile.update({ where: { id: current.id }, data: dto });
    return this.getOwn(userId);
  }

  /** Permanently deletes the account and every piece of data tied to it. */
  async deleteAccount(userId: string) {
    const p = await this.prisma.profile.findUnique({ where: { userId }, include: { photos: true } });
    if (p) await Promise.all(p.photos.map((ph) => this.storage.remove(ph.fileKey)));
    await this.prisma.user.delete({ where: { id: userId } });
  }

  /** Another member's profile page. Records the view. */
  async getPublic(userId: string, code: string) {
    const seq = parseProfileCode(code);
    if (!seq) throw new NotFoundException('Profile not found');
    const me = await this.browsingProfile(userId);
    const target = await this.prisma.profile.findFirst({
      where: seq === me.seq ? { seq } : { AND: [{ seq }, this.discoverableWhere(me)] },
      include: approvedPhotos,
    });
    if (!target) throw new NotFoundException('Profile not found');

    const viewer = await this.viewer(userId, me);
    const isSelf = target.id === me.id;
    const accepted = (await acceptedConnections(this.prisma, me.id, [target.id])).has(target.id);

    if (!isSelf) {
      await this.prisma.profileView.upsert({
        where: { viewerId_viewedId: { viewerId: me.id, viewedId: target.id } },
        create: { viewerId: me.id, viewedId: target.id },
        update: { viewedAt: new Date() },
      });
    }

    const [sent, received, marks, unlock] = await Promise.all([
      this.prisma.interest.findUnique({ where: { senderId_receiverId: { senderId: me.id, receiverId: target.id } } }),
      this.prisma.interest.findUnique({ where: { senderId_receiverId: { senderId: target.id, receiverId: me.id } } }),
      this.prisma.profileMark.findMany({ where: { ownerId: me.id, targetId: target.id } }),
      this.prisma.contactUnlock.findUnique({ where: { ownerId_targetId: { ownerId: me.id, targetId: target.id } } }),
    ]);

    return {
      profile: toDetail(target, viewer, accepted),
      relationship: {
        isSelf,
        sentInterest: sent && { id: sent.id, status: sent.status },
        receivedInterest: received && { id: received.id, status: received.status },
        shortlisted: marks.some((m) => m.type === 'SHORTLIST'),
        ignored: marks.some((m) => m.type === 'IGNORE'),
        blocked: marks.some((m) => m.type === 'BLOCK'),
        contactUnlocked: !!unlock,
        accepted,
      },
    };
  }
}
