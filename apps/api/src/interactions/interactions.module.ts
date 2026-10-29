import { Module } from '@nestjs/common';
import { MatchesController } from '../matches/matches.controller';
import { ContactsController } from './contacts.controller';
import { InterestsController } from './interests.controller';
import { MarksController, ReportsController } from './marks.controller';

@Module({
  controllers: [MatchesController, InterestsController, ContactsController, MarksController, ReportsController],
})
export class InteractionsModule {}
