import { Diet, MaritalStatus } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Partner preferences. Leave a list empty (or a bound null) to mean "any". */
export class PreferenceDto {
  @IsOptional() @IsInt() @Min(18) @Max(80) ageMin?: number | null;
  @IsOptional() @IsInt() @Min(18) @Max(80) ageMax?: number | null;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightMinCm?: number | null;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightMaxCm?: number | null;

  @IsOptional() @IsArray() @IsEnum(MaritalStatus, { each: true }) maritalStatuses?: MaritalStatus[];
  @IsOptional() @IsArray() @IsEnum(Diet, { each: true }) diets?: Diet[];

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) religions?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(80, { each: true }) communities?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) motherTongues?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(80, { each: true }) states?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(80, { each: true }) cities?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(80, { each: true }) educations?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(80, { each: true }) professions?: string[];
}
