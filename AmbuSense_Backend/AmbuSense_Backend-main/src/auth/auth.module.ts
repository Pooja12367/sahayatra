import { Module } from '@nestjs/common';
import { RoleProfilesModule } from '../role-profiles/role-profiles.module';
import { UsersModule } from '../users/users.module';
import { UsersController } from '../users/users.controller';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [UsersModule, RoleProfilesModule],
  controllers: [AuthController, UsersController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
