export type Tier = 'FREE' | 'PREMIUM';
export type ProfileStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Me {
  id: string;
  phone: string;
  email: string | null;
  role: 'USER' | 'ADMIN';
  plan: { tier: Tier; name: string; endsAt: string | null };
  unreadNotifications: number;
  unreadMessages: number;
  profile: {
    id: string;
    code: string;
    firstName: string | null;
    gender: 'MALE' | 'FEMALE' | null;
    status: ProfileStatus;
    rejectionReason: string | null;
    onboardingStep: number;
    hidden: boolean;
    completeness: number;
  } | null;
}

export interface ProfileCard {
  id: string;
  code: string;
  firstName: string | null;
  lastInitial: string;
  age: number | null;
  heightCm: number | null;
  city: string | null;
  state: string | null;
  religion: string | null;
  community: string | null;
  motherTongue: string | null;
  education: string | null;
  profession: string | null;
  maritalStatus: string | null;
  photo: string | null;
  photoLocked: string | null;
  matchPercent: number;
  isNew: boolean;
}

export interface ProfileDetail extends ProfileCard {
  createdFor: string;
  subCaste: string | null;
  manglik: string | null;
  country: string | null;
  citizenship: string | null;
  college: string | null;
  company: string | null;
  annualIncome: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  brothers: number | null;
  sisters: number | null;
  familyType: string | null;
  familyValues: string | null;
  nativePlace: string | null;
  diet: string | null;
  smoking: string | null;
  drinking: string | null;
  aboutMe: string | null;
  photos: { id: string; url: string; isMain: boolean }[];
  contactVisibility: 'ALLOW_UNLOCK' | 'AFTER_ACCEPT';
}

export interface Relationship {
  isSelf: boolean;
  sentInterest: { id: string; status: string } | null;
  receivedInterest: { id: string; status: string } | null;
  shortlisted: boolean;
  ignored: boolean;
  blocked: boolean;
  contactUnlocked: boolean;
  accepted: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  premiumRequired?: boolean;
}

export interface Quota {
  tier: Tier;
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
  resetsAt: string;
}

export interface Contact {
  name: string;
  phone: string;
  email: string | null;
  createdFor: string;
}

export interface OwnProfile {
  id: string;
  code: string;
  status: ProfileStatus;
  rejectionReason: string | null;
  onboardingStep: number;
  wizardSteps: number;
  completeness: number;
  hidden: boolean;
  photoVisibility: 'ALL' | 'PREMIUM' | 'ACCEPTED';
  contactVisibility: 'ALLOW_UNLOCK' | 'AFTER_ACCEPT';
  photos: { id: string; url: string; isMain: boolean; status: 'PENDING' | 'APPROVED' | 'REJECTED' }[];
  preference: Preference | null;
  [field: string]: unknown;
}

export interface Preference {
  ageMin: number | null;
  ageMax: number | null;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  maritalStatuses: string[];
  religions: string[];
  communities: string[];
  motherTongues: string[];
  states: string[];
  cities: string[];
  educations: string[];
  professions: string[];
  diets: string[];
}

export type Masters = Record<
  'RELIGION' | 'COMMUNITY' | 'MOTHER_TONGUE' | 'EDUCATION' | 'PROFESSION' | 'INCOME' | 'STATE',
  { value: string; parent: string | null }[]
>;

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
