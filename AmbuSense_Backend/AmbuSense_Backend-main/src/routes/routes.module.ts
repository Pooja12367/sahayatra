import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Ambulance,
  AmbulanceSchema,
} from '../ambulance/entities/ambulance.entity';
import {
  EmergencyRequest,
  EmergencyRequestSchema,
} from '../emergency-request/entities/emergency-request.entity';
import { Hospital, HospitalSchema } from '../hospital/entities/hospital.entity';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Ambulance.name, schema: AmbulanceSchema },
      { name: EmergencyRequest.name, schema: EmergencyRequestSchema },
      { name: Hospital.name, schema: HospitalSchema },
    ]),
    AuthModule,
    RoleProfilesModule,
  ],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
