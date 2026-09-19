import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule, MediaModule, RoleProfilesModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
