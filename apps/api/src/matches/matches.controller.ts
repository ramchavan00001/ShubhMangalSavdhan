import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Diet, MaritalStatus, Prisma, Profile, User } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../common/auth';
import { dobRangeForAges } from '../domain/age';
import { parseProfileCode } from '../domain/matching';
import { PrismaService } from '../prisma/prisma.service';
import { acceptedConnections, approvedPhotos, toCard, Viewer } from '../profiles/presenter';
import { ProfilesService } from '../profiles/profiles.service';
import { fitsPreferenceWhere, iFitTheirPreferenceWhere } from './match-filters';

const PAGE_SIZE = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value;

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) page?: number;
}

class MatchesQuery extends PageQuery {
  @IsOptional() @IsIn(['all', 'new', 'near', 'recent', 'viewed-me', 'shortlisted']) tab?: string;
}

class SearchQuery extends PageQuery {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(80) ageMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(18) @Max(80) ageMax?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(120) @Max(230) heightMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(120) @Max(230) heightMax?: number;
  @IsOptional() @Transform(csv) religion?: string[];
  @IsOptional() @Transform(csv) community?: string[];
  @IsOptional() @Transform(csv) motherTongue?: string[];
  @IsOptional() @Transform(csv) state?: string[];
  @IsOptional() @Transform(csv) city?: string[];
  @IsOptional() @Transform(csv) education?: string[];
  @IsOptional() @Transform(csv) profession?: string[];
  @IsOptional() @Transform(csv) maritalStatus?: string[];
  @IsOptional() @Transform(csv) diet?: string[];
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() withPhoto?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() verifiedOnly?: boolean;
  @IsOptional() @IsIn(['newest', 'active']) sort?: string;
}

@Controller()
export class MatchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfilesService,
  ) {}

  private async page(
    me: Profile,
    viewer: Viewer,
    where: Prisma.ProfileWhereInput,
    page: number,
    orderBy: Prisma.ProfileOrderByWithRelationInput[],
  ) {
    const [total, rows] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        include: approvedPhotos,
        // Tie-break on seq so pages are stable when timestamps are equal.
        orderBy: [...orderBy, { seq: 'desc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    const accepted = await acceptedConnections(this.prisma, me.id, rows.map((r) => r.id));
    return {
      items: rows.map((r) => toCard(r, viewer, accepted.has(r.id))),
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: page * PAGE_SIZE < total,
    };
  }

  /** "My Matches" and its tabs. Matches are mutual: they fit me and I fit them. */
  @Get('matches')
  async matches(@CurrentUser() user: User, @Query() q: MatchesQuery) {
    const me = await this.profiles.browsingProfile(user.id);
    const viewer = await this.profiles.viewer(user.id, me);
    const pref = await this.prisma.partnerPreference.findUnique({ where: { profileId: me.id } });
    const tab = q.tab ?? 'all';
    const page = q.page ?? 1;

    const base: Prisma.ProfileWhereInput = {
      AND: [
        this.profiles.discoverableWhere(me),
        { marksReceived: { none: { ownerId: me.id, type: 'IGNORE' } } },
      ],
    };
    const mutual: Prisma.ProfileWhereInput = { AND: [base, fitsPreferenceWhere(pref), iFitTheirPreferenceWhere(me)] };

    switch (tab) {
      case 'new':
        return this.page(me, viewer, { AND: [mutual, { approvedAt: { gte: new Date(Date.now() - WEEK_MS) } }] }, page, [
          { approvedAt: 'desc' },
        ]);
      case 'near':
        if (!me.city) return this.page(me, viewer, { id: '__none__' }, page, []);
        return this.page(me, viewer, { AND: [mutual, { city: me.city }] }, page, [{ approvedAt: 'desc' }]);
      case 'recent':
        return this.page(me, viewer, { AND: [mutual, { user: { lastActiveAt: { gte: new Date(Date.now() - WEEK_MS) } } }] }, page, [
          { user: { lastActiveAt: 'desc' } },
        ]);
      case 'shortlisted':
        return this.page(me, viewer, { AND: [base, { marksReceived: { some: { ownerId: me.id, type: 'SHORTLIST' } } }] }, page, [
          { updatedAt: 'desc' },
        ]);
      case 'viewed-me': {
        if (!viewer.isPremium) {
          const total = await this.prisma.profileView.count({ where: { viewedId: me.id } });
          return { items: [], page, pageSize: PAGE_SIZE, total, hasMore: false, premiumRequired: true };
        }
        return this.page(me, viewer, { AND: [base, { viewsMade: { some: { viewedId: me.id } } }] }, page, [{ updatedAt: 'desc' }]);
      }
      default:
        return this.page(me, viewer, mutual, page, [{ approvedAt: 'desc' }]);
    }
  }

  /** Search with filters. Unlike matches, this is one-way: it ignores the other person's preferences. */
  @Get('search')
  async search(@CurrentUser() user: User, @Query() q: SearchQuery) {
    const me = await this.profiles.browsingProfile(user.id);
    const viewer = await this.profiles.viewer(user.id, me);
    const and: Prisma.ProfileWhereInput[] = [this.profiles.discoverableWhere(me)];

    if (q.code) {
      const seq = parseProfileCode(q.code);
      if (!seq) throw new BadRequestException('Profile IDs look like SMS1000123');
      and.push({ seq });
    }
    if (q.ageMin != null || q.ageMax != null) and.push({ dateOfBirth: dobRangeForAges(q.ageMin, q.ageMax) });
    if (q.heightMin != null) and.push({ heightCm: { gte: q.heightMin } });
    if (q.heightMax != null) and.push({ heightCm: { lte: q.heightMax } });
    if (q.religion?.length) and.push({ religion: { in: q.religion } });
    if (q.community?.length) and.push({ community: { in: q.community } });
    if (q.motherTongue?.length) and.push({ motherTongue: { in: q.motherTongue } });
    if (q.state?.length) and.push({ state: { in: q.state } });
    if (q.city?.length) and.push({ city: { in: q.city, mode: 'insensitive' } });
    if (q.education?.length) and.push({ education: { in: q.education } });
    if (q.profession?.length) and.push({ profession: { in: q.profession } });
    if (q.maritalStatus?.length) {
      const valid = q.maritalStatus.filter((m): m is MaritalStatus => m in MaritalStatus);
      and.push({ maritalStatus: { in: valid } });
    }
    if (q.diet?.length) {
      const valid = q.diet.filter((d): d is Diet => d in Diet);
      and.push({ diet: { in: valid } });
    }
    if (q.withPhoto) and.push({ photos: { some: { status: 'APPROVED' } } });
    if (q.verifiedOnly) and.push({ idVerifiedAt: { not: null }, selfieVerifiedAt: { not: null } });

    const orderBy: Prisma.ProfileOrderByWithRelationInput[] =
      q.sort === 'active' ? [{ user: { lastActiveAt: 'desc' } }] : [{ approvedAt: 'desc' }];
    return this.page(me, viewer, { AND: and }, q.page ?? 1, orderBy);
  }
}
