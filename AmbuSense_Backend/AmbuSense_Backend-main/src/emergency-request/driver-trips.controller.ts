import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { UpdateStatusDto } from './dto/update-status.dto';
import { EmergencyRequestService } from './emergency-request.service';
import { emergencyRequestExample } from '../swagger/api-examples';

@ApiTags('Driver Trips')
@ApiCookieAuth('session')
@Controller('driver/my-trip')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.DRIVER)
export class DriverTripsController {
  constructor(
    private readonly emergencyRequestService: EmergencyRequestService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated driver active trip' })
  @ApiResponse({
    status: 200,
    description: 'Assigned active emergency request for the driver.',
    schema: { example: emergencyRequestExample },
  })
  @ApiResponse({ status: 404, description: 'Assigned trip not found.' })
  findMyTrip(@CurrentUser() user: UserDocument) {
    return this.emergencyRequestService.findMyTrip(user);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Update the authenticated driver trip status' })
  @ApiBody({ type: UpdateStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Trip status updated.',
    schema: {
      example: { ...emergencyRequestExample, status: 'en-route' },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  updateStatus(
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.updateMyTripStatus(user, dto.status);
  }

  @Patch('reject')
  @ApiOperation({ summary: 'Reject the current assigned trip' })
  @ApiResponse({
    status: 200,
    description: 'Trip rejected and returned to pending queue.',
    schema: { example: { message: 'Trip rejected successfully' } },
  })
  @ApiResponse({ status: 404, description: 'No assigned trip found.' })
  rejectTrip(@CurrentUser() user: UserDocument) {
    return this.emergencyRequestService.rejectMyTrip(user);
  }
}
