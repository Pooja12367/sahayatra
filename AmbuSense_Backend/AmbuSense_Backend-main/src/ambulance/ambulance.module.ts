import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AmbulanceController } from './ambulance.controller';
import { AmbulanceService } from './ambulance.service';
import { Ambulance, AmbulanceSchema } from './entities/ambulance.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { AuthModule } from '../auth/auth.module';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { EmergencyRequestModule } from '../emergency-request/emergency-request.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ambulance.name, schema: AmbulanceSchema },
    ]),
    AuthModule,
    RoleProfilesModule,
    forwardRef(() => GatewayModule),
    forwardRef(() => EmergencyRequestModule),
  ],
  controllers: [AmbulanceController],
  providers: [AmbulanceService],
  exports: [AmbulanceService],
})
export class AmbulanceModule {}
