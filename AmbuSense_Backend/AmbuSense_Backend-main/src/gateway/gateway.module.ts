import { Module, forwardRef } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { AmbulanceModule } from '../ambulance/ambulance.module';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';

@Module({
  imports: [forwardRef(() => AmbulanceModule), AuthModule, RoleProfilesModule],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class GatewayModule {}
