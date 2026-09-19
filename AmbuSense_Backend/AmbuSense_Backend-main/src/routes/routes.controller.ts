import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { RoutesService } from './routes.service';
import {
  ambulanceExample,
  emergencyRequestExample,
  routeLegExample,
} from '../swagger/api-examples';

@ApiTags('Routes')
@ApiCookieAuth('session')
@Controller('routes')
@UseGuards(AuthGuard, RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('ambulance/:ambulanceId/request/:requestId')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Get route from ambulance to pickup location' })
  @ApiParam({ name: 'ambulanceId', example: ambulanceExample.id })
  @ApiParam({ name: 'requestId', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description: 'Route leg from ambulance to emergency request.',
    schema: { example: routeLegExample },
  })
  getAmbulanceToRequestRoute(
    @Param('ambulanceId') ambulanceId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.routesService.getAmbulanceToRequestRoute(
      ambulanceId,
      requestId,
      user,
    );
  }

  @Get('request/:requestId/hospital')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Get route from pickup location to hospital' })
  @ApiParam({ name: 'requestId', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description: 'Route leg from request to assigned hospital.',
    schema: { example: routeLegExample },
  })
  getRequestToHospitalRoute(
    @Param('requestId') requestId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.routesService.getRequestToHospitalRoute(requestId, user);
  }

  @Get('request/:requestId/full')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Get full ambulance, pickup, and hospital route' })
  @ApiParam({ name: 'requestId', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description:
      'Full route split into ambulance-to-pickup and pickup-to-hospital legs.',
    schema: {
      example: {
        ambulanceToPickup: routeLegExample,
        pickupToHospital: {
          ...routeLegExample,
          distanceInMeters: 5100,
          durationInSeconds: 900,
        },
        totalDistance: 7550,
        totalDuration: 1330,
      },
    },
  })
  getFullRequestRoute(
    @Param('requestId') requestId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.routesService.getFullRequestRoute(requestId, user);
  }
}
