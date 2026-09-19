import { Module } from '@nestjs/common';
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
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmergencyRequest.name, schema: EmergencyRequestSchema },
      { name: Ambulance.name, schema: AmbulanceSchema },
      { name: Hospital.name, schema: HospitalSchema },
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
