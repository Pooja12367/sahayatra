import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Ambulance,
  AmbulanceSchema,
} from '../ambulance/entities/ambulance.entity';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { Admin, AdminSchema } from './entities/admin.entity';
import { Dispatcher, DispatcherSchema } from './entities/dispatcher.entity';
import { Driver, DriverSchema } from './entities/driver.entity';
import { Patient, PatientSchema } from './entities/patient.entity';
import { RoleProfilesService } from './role-profiles.service';

@Module({
  imports: [
    MediaModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Dispatcher.name, schema: DispatcherSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Patient.name, schema: PatientSchema },
      { name: Ambulance.name, schema: AmbulanceSchema },
    ]),
  ],
  providers: [RoleProfilesService],
  exports: [RoleProfilesService],
})
export class RoleProfilesModule {}
