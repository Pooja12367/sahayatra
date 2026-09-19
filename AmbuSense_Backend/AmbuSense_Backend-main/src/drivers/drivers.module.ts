import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { DriversController } from './drivers.controller';

@Module({
  imports: [AuthModule, RoleProfilesModule],
  controllers: [DriversController],
})
export class DriversModule {}
