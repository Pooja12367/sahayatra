import { Module, forwardRef } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { AmbulanceModule } from '../ambulance/ambulance.module';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmergencyRequest,
  EmergencyRequestSchema,
} from '../emergency-request/entities/emergency-request.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmergencyRequest.name, schema: EmergencyRequestSchema },
    ]),
    forwardRef(() => AmbulanceModule),
    AuthModule,
    RoleProfilesModule,
  ],
  providers: [TrackingGateway],
  exports: [TrackingGateway],
})
export class GatewayModule {}
