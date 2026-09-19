import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { EmergencyRequestService } from './emergency-request.service';
import { CreateEmergencyRequestDto } from './dto/create-emergency-request.dto';
import { UpdateEmergencyRequestDto } from './dto/update-emergency-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignEmergencyRequestDto } from './dto/assign-emergency-request.dto';
import { DispatchEmergencyRequestDto } from './dto/dispatch-emergency-request.dto';
import { CancelEmergencyRequestDto } from './dto/cancel-emergency-request.dto';
import { FindEmergencyRequestsQueryDto } from './dto/find-emergency-requests-query.dto';
import {
  emergencyRequestExample,
  messageExample,
} from '../swagger/api-examples';

@ApiTags('Emergency Requests')
@ApiCookieAuth('session')
@Controller('emergency-requests')
@UseGuards(AuthGuard, RolesGuard)
export class EmergencyRequestController {
  constructor(
    private readonly emergencyRequestService: EmergencyRequestService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Create an emergency request' })
  @ApiBody({ type: CreateEmergencyRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Emergency request created.',
    schema: { example: emergencyRequestExample },
  })
  create(
    @Body() dto: CreateEmergencyRequestDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'List emergency requests' })
  @ApiQuery({ name: 'search', required: false, example: 'Sita' })
  @ApiQuery({ name: 'status', required: false, example: 'assigned' })
  @ApiQuery({
    name: 'assignedAmbulance',
    required: false,
    example: '65f1a6f2c3b7a91d2e4f5680',
  })
  @ApiQuery({
    name: 'assignedHospital',
    required: false,
    example: '65f1a6f2c3b7a91d2e4f5681',
  })
  @ApiQuery({
    name: 'hospitalAssignmentTechnique',
    required: false,
    example: 'system-auto',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching emergency requests.',
    schema: { example: [emergencyRequestExample] },
  })
  findAll(
    @Query() query: FindEmergencyRequestsQueryDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.findAll(query, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Get an emergency request by id' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description: 'Emergency request details.',
    schema: { example: emergencyRequestExample },
  })
  @ApiResponse({ status: 404, description: 'Emergency request not found.' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.emergencyRequestService.findOne(id, user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Assign ambulance and/or hospital to a request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: AssignEmergencyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Emergency request assigned.',
    schema: { example: emergencyRequestExample },
  })
  assign(@Param('id') id: string, @Body() dto: AssignEmergencyRequestDto) {
    return this.emergencyRequestService.assign(id, dto);
  }

  @Patch(':id/dispatch')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({
    summary: 'Dispatch a request using a hospital assignment flow',
  })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: DispatchEmergencyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Emergency request dispatched.',
    schema: { example: emergencyRequestExample },
  })
  dispatch(@Param('id') id: string, @Body() dto: DispatchEmergencyRequestDto) {
    return this.emergencyRequestService.dispatch(id, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Cancel an emergency request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: CancelEmergencyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Emergency request cancelled.',
    schema: {
      example: {
        ...emergencyRequestExample,
        status: 'cancelled',
        cancellationReason: 'Patient cancelled the request',
      },
    },
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelEmergencyRequestDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.cancel(id, dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update an emergency request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: UpdateEmergencyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Emergency request updated.',
    schema: { example: emergencyRequestExample },
  })
  update(@Param('id') id: string, @Body() dto: UpdateEmergencyRequestDto) {
    return this.emergencyRequestService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Update an emergency request status' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiBody({ type: UpdateStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Emergency request status updated.',
    schema: {
      example: { ...emergencyRequestExample, status: 'en-route' },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.emergencyRequestService.updateStatus(id, dto.status, user);
  }
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an emergency request' })
  @ApiParam({ name: 'id', example: emergencyRequestExample.id })
  @ApiResponse({
    status: 200,
    description: 'Emergency request deleted.',
    schema: { example: messageExample },
  })
  remove(@Param('id') id: string) {
    return this.emergencyRequestService.remove(id);
  }
}
