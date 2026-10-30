import { Global, Module } from '@nestjs/common';
import { PhotosController } from '../photos/photos.controller';
import { StorageService } from '../photos/storage.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Global()
@Module({
  controllers: [ProfilesController, PhotosController],
  providers: [ProfilesService, StorageService],
  exports: [ProfilesService, StorageService],
})
export class ProfilesModule {}
