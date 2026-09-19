import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiCookieAuth('session')
@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Get dashboard summary metrics' })
  @ApiResponse({
    status: 200,
    description: 'Summary counts for dashboard cards.',
    schema: {
      example: {
        ambulances: { total: 12, available: 5, assigned: 4, offline: 3 },
        hospitals: { total: 8, available: 6, busy: 1, offline: 1 },
        emergencyRequests: { total: 45, pending: 3, active: 7, completed: 35 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Admin or dispatcher role required.',
  })
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
