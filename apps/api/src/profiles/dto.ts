import {
  CreatedFor,
  ContactVisibility,
  Diet,
  FamilyType,
  FamilyValues,
  Gender,
  Habit,
  Manglik,
  MaritalStatus,
  PhotoVisibility,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Every editable profile field. Each wizard step sends the fields it owns. */
export class UpdateProfileDto {
  @IsOptional() @IsEnum(CreatedFor) createdFor?: CreatedFor;

  @IsOptional() @IsString() @Length(1, 50) firstName?: string;
  @IsOptional() @IsString() @Length(1, 50) lastName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(120) @Max(230) heightCm?: number;
  @IsOptional() @IsEnum(MaritalStatus) maritalStatus?: MaritalStatus;
  @IsOptional() @IsString() @MaxLength(60) religion?: string;
  @IsOptional() @IsString() @MaxLength(60) community?: string;
  @IsOptional() @IsString() @MaxLength(60) subCaste?: string;
  @IsOptional() @IsString() @MaxLength(60) motherTongue?: string;
  @IsOptional() @IsEnum(Manglik) manglik?: Manglik;

  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsString() @MaxLength(60) citizenship?: string;

  @IsOptional() @IsString() @MaxLength(80) education?: string;
  @IsOptional() @IsString() @MaxLength(120) college?: string;
  @IsOptional() @IsString() @MaxLength(80) profession?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsString() @MaxLength(40) annualIncome?: string;

  @IsOptional() @IsString() @MaxLength(80) fatherOccupation?: string;
  @IsOptional() @IsString() @MaxLength(80) motherOccupation?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(15) brothers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(15) sisters?: number;
  @IsOptional() @IsEnum(FamilyType) familyType?: FamilyType;
  @IsOptional() @IsEnum(FamilyValues) familyValues?: FamilyValues;
  @IsOptional() @IsString() @MaxLength(80) nativePlace?: string;

  @IsOptional() @IsEnum(Diet) diet?: Diet;
  @IsOptional() @IsEnum(Habit) smoking?: Habit;
  @IsOptional() @IsEnum(Habit) drinking?: Habit;

  @IsOptional() @IsString() @MaxLength(2000) aboutMe?: string;
}

export class PrivacyDto {
  @IsOptional() @IsEnum(PhotoVisibility) photoVisibility?: PhotoVisibility;
  @IsOptional() @IsEnum(ContactVisibility) contactVisibility?: ContactVisibility;
  @IsOptional() @IsBoolean() hidden?: boolean;
}

/** Fields each wizard step must have filled before moving on. */
export const STEP_REQUIREMENTS: Record<number, (keyof UpdateProfileDto)[]> = {
  1: ['createdFor', 'firstName', 'lastName', 'gender', 'dateOfBirth', 'heightCm', 'maritalStatus', 'religion', 'community', 'motherTongue'],
  2: ['country', 'state', 'city'],
  3: ['education', 'profession', 'annualIncome'],
  4: ['familyType', 'familyValues'],
  5: ['diet'],
  6: ['aboutMe'],
};

export const WIZARD_STEPS = 8; // 7 = photos, 8 = partner preferences
export const MIN_ABOUT_LENGTH = 50;
