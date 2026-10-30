import { Body, Controller, Get, Global, HttpCode, Logger, Module, OnModuleInit, Post, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser, Public } from '../common/auth';
import { ageOn } from '../domain/age';
import { containsContactDetails, ProfilesService } from '../profiles/profiles.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService } from './ai.service';

class BioAnswers {
  @IsString() @MaxLength(400) personality: string;
  @IsString() @MaxLength(400) interests: string;
  @IsString() @MaxLength(400) family: string;
  @IsString() @MaxLength(400) career: string;
  @IsString() @MaxLength(400) partner: string;
}

class BioDto {
  @IsIn(['en', 'hi', 'mr']) language: 'en' | 'hi' | 'mr';
  @ValidateNested() @Type(() => BioAnswers) answers: BioAnswers;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly profiles: ProfilesService,
  ) {}

  @Public()
  @Get('status')
  status() {
    return { enabled: this.ai.enabled };
  }

  /** "Help me write": drafts About me + Partner expectations. The member reviews before saving. */
  @Post('bio')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  async bio(@CurrentUser() user: User, @Body() dto: BioDto) {
    if (!this.ai.enabled) throw new ServiceUnavailableException('The writing assistant isn’t switched on yet.');
    const p = await this.profiles.ownProfile(user.id);
    // Only general facts go to the AI — no surname, contact details or exact address.
    const facts = [
      p.firstName && `First name: ${p.firstName}`,
      p.gender && `Gender: ${p.gender.toLowerCase()}`,
      p.dateOfBirth && `Age: ${ageOn(p.dateOfBirth)}`,
      p.city && `Lives in: ${p.city}`,
      p.education && `Education: ${p.education}`,
      p.profession && `Profession: ${p.profession}`,
      p.motherTongue && `Mother tongue: ${p.motherTongue}`,
      p.familyType && `Family: ${p.familyType.toLowerCase()} family, ${p.familyValues?.toLowerCase() ?? ''} values`,
      p.diet && `Diet: ${p.diet.toLowerCase().replace('_', '-')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const draft = await this.ai.writeBio({ language: dto.language, writtenFor: p.createdFor === 'SELF' ? 'self' : 'family', facts, answers: dto.answers });
    if (!draft) throw new UnprocessableEntityException('Couldn’t write a draft right now. Please try again, or write your own.');
    if (containsContactDetails(draft.aboutMe) || containsContactDetails(draft.partnerExpectations)) {
      throw new UnprocessableEntityException('The draft included contact details. Please remove them from your answers and try again.');
    }
    return { aboutMe: draft.aboutMe.trim().slice(0, 2000), partnerExpectations: draft.partnerExpectations.trim().slice(0, 1000) };
  }
}

@Global()
@Module({
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule implements OnModuleInit {
  private readonly log = new Logger('AI');

  constructor(
    private readonly ai: AiService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    if (!this.ai.enabled) {
      this.log.log('ANTHROPIC_API_KEY not set — AI features are off');
      return;
    }
    this.whatsapp.setIntentFallback((text) => this.ai.classifyReply(text));
  }
}
