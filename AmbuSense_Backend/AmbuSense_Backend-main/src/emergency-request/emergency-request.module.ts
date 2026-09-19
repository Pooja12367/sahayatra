import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmergencyRequest,
  EmergencyRequestSchema,
} from './entities/emergency-request.entity';
import { EmergencyRequestController } from './emergency-request.controller';
import { EmergencyRequestService } from './emergency-request.service';
import {
  Ambulance,
  AmbulanceSchema,
} from '../ambulance/entities/ambulance.entity';
import { Hospital, HospitalSchema } from '../hospital/entities/hospital.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { MyRequestsController } from './my-requests.controller';
import { DriverTripsController } from './driver-trips.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: EmergencyRequest.name,
        schema: EmergencyRequestSchema,
      },
      {
        name: Ambulance.name,
        schema: AmbulanceSchema,
      },
      {
        name: Hospital.name,
        schema: HospitalSchema,
      },
    ]),
    AuthModule,
    RoleProfilesModule,
    GatewayModule,
  ],
  controllers: [
    EmergencyRequestController,
    MyRequestsController,
    DriverTripsController,
  ],
  providers: [EmergencyRequestService],
  exports: [EmergencyRequestService],
})
export class EmergencyRequestModule {}
