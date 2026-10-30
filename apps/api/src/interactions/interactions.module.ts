import { Module } from '@nestjs/common';
import { MatchesController } from '../matches/matches.controller';
import { ContactsController } from './contacts.controller';
import { InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';
import { MarksController, ReportsController } from './marks.controller';

@Module({
  controllers: [MatchesController, InterestsController, ContactsController, MarksController, ReportsController],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InteractionsModule {}
