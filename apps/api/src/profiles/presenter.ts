import { Photo, Prisma, Profile } from '@prisma/client';
import { ageOn } from '../domain/age';
import { matchPercent, Preference, profileCode } from '../domain/matching';
import { PrismaService } from '../prisma/prisma.service';

/** Who is looking at profiles — decides which photos and badges they see. */
export interface Viewer {
  profileId: string;
  isPremium: boolean;
  preference: Preference | null;
}

export type ProfileWithPhotos = Profile & { photos: Photo[] };

export const approvedPhotos = {
  photos: { where: { status: 'APPROVED' as const }, orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }] },
} satisfies Prisma.ProfileInclude;

export function photoUrl(id: string) {
  return `/photos/${id}`;
}

export function canSeePhotos(target: Profile, viewer: Viewer, accepted: boolean): boolean {
  if (target.id === viewer.profileId) return true;
  switch (target.photoVisibility) {
    case 'ALL':
      return true;
    case 'PREMIUM':
      return viewer.isPremium || accepted;
    case 'ACCEPTED':
      return accepted;
  }
}

function photoLockReason(target: Profile): string {
  return target.photoVisibility === 'PREMIUM'
    ? 'Photos are visible to Premium members'
    : 'Photos are visible after this member accepts your interest';
}

/** Profile ids (from `ids`) that have an accepted interest with the viewer, in either direction. */
export async function acceptedConnections(prisma: PrismaService, viewerProfileId: string, ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await prisma.interest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: viewerProfileId, receiverId: { in: ids } },
        { receiverId: viewerProfileId, senderId: { in: ids } },
      ],
    },
    select: { senderId: true, receiverId: true },
  });
  return new Set(rows.map((r) => (r.senderId === viewerProfileId ? r.receiverId : r.senderId)));
}

/** Compact card used in match lists, search results and inboxes. */
export function toCard(p: ProfileWithPhotos, viewer: Viewer, accepted: boolean) {
  const showPhotos = canSeePhotos(p, viewer, accepted);
  const main = p.photos[0];
  return {
    id: p.id,
    code: profileCode(p.seq),
    firstName: p.firstName,
    lastInitial: p.lastName ? `${p.lastName[0]}.` : '',
    age: p.dateOfBirth ? ageOn(p.dateOfBirth) : null,
    heightCm: p.heightCm,
    city: p.city,
    state: p.state,
    religion: p.religion,
    community: p.community,
    motherTongue: p.motherTongue,
    education: p.education,
    profession: p.profession,
    maritalStatus: p.maritalStatus,
    photo: showPhotos && main ? photoUrl(main.id) : null,
    photoLocked: !showPhotos && p.photos.length > 0 ? photoLockReason(p) : null,
    matchPercent: matchPercent(viewer.preference, p),
    isNew: !!p.approvedAt && Date.now() - p.approvedAt.getTime() < 7 * 24 * 60 * 60 * 1000,
  };
}

/** Full profile page for another member. Contact details are never included here. */
export function toDetail(p: ProfileWithPhotos, viewer: Viewer, accepted: boolean) {
  const showPhotos = canSeePhotos(p, viewer, accepted);
  return {
    ...toCard(p, viewer, accepted),
    createdFor: p.createdFor,
    subCaste: p.subCaste,
    manglik: p.manglik,
    country: p.country,
    citizenship: p.citizenship,
    college: p.college,
    company: p.company,
    annualIncome: p.annualIncome,
    fatherOccupation: p.fatherOccupation,
    motherOccupation: p.motherOccupation,
    brothers: p.brothers,
    sisters: p.sisters,
    familyType: p.familyType,
    familyValues: p.familyValues,
    nativePlace: p.nativePlace,
    diet: p.diet,
    smoking: p.smoking,
    drinking: p.drinking,
    aboutMe: p.aboutMe,
    photos: showPhotos ? p.photos.map((ph) => ({ id: ph.id, url: photoUrl(ph.id), isMain: ph.isMain })) : [],
    contactVisibility: p.contactVisibility,
  };
}
