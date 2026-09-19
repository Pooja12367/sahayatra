import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBody,
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
import { CancelEmergencyRequestDto } from './dto/cancel-emergency-request.dto';
import { EmergencyRequestService } from './emergency-request.service';
import { emergencyRequestExample } from '../swagger/api-examples';

@ApiTags('My Requests')
@ApiCookieAuth('session')
@Controller('my/requests')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.PATIENT)
export class MyRequestsController {
  constructor(
    private readonly emergencyRequestService: EmergencyRequestService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated patient requests' })
  @ApiResponse({
    status: 200,
    description: 'Requests owned by the current patient.',
    schema: { example: [emergencyRequestExample] },
  })
  findAll(@CurrentUser() user: UserDocument) {
    return this.emergencyRequestService.findMyRequests(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one authenticated patient request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description: 'Request owned by the current patient.',
    schema: { example: emergencyRequestExample },
  })
  @ApiResponse({ status: 404, description: 'Request not found.' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.emergencyRequestService.findMyRequest(id, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel one authenticated patient request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: CancelEmergencyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Request cancelled.',
    schema: {
      example: {
        ...emergencyRequestExample,
        status: 'cancelled',
        cancellationReason: 'Patient cancelled the request',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Request cannot be cancelled.' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelEmergencyRequestDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.cancelMyRequest(id, dto, user);
  }
}
