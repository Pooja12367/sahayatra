import * as path from 'path';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AmbulanceModule } from './ambulance/ambulance.module';
import { HospitalModule } from './hospital/hospital.module';
import { EmergencyRequestModule } from './emergency-request/emergency-request.module';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GatewayModule } from './gateway/gateway.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RoutesModule } from './routes/routes.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { DriversModule } from './drivers/drivers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: configService.get<string>('MONGODB_DB_NAME'),
      }),
    }),
    AmbulanceModule,
    HospitalModule,
    EmergencyRequestModule,
    DashboardModule,
    RoutesModule,
    GatewayModule,
    AuthModule,
    UploadsModule,
    DriversModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
