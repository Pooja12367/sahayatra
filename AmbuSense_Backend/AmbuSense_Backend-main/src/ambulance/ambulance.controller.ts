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
import { AmbulanceStatus, UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { AmbulanceService } from './ambulance.service';
import { CreateAmbulanceDto } from './dto/create-ambulance.dto';
import { UpdateAmbulanceDto } from './dto/update-ambulance.dto';
import { UpdateAmbulanceStatusDto } from './dto/update-ambulance-status.dto';
import { FindAmbulancesQueryDto } from './dto/find-ambulances-query.dto';
import { ambulanceExample, messageExample } from '../swagger/api-examples';

@ApiTags('Ambulances')
@ApiCookieAuth('session')
@Controller('ambulances')
@UseGuards(AuthGuard, RolesGuard)
export class AmbulanceController {
  constructor(private readonly ambulanceService: AmbulanceService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create an ambulance' })
  @ApiBody({ type: CreateAmbulanceDto })
  @ApiResponse({
    status: 201,
    description: 'Ambulance created.',
    schema: { example: ambulanceExample },
  })
  @ApiResponse({ status: 400, description: 'Invalid ambulance payload.' })
  create(@Body() dto: CreateAmbulanceDto) {
    return this.ambulanceService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'List ambulances' })
  @ApiQuery({ name: 'search', required: false, example: 'AMB-102' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AmbulanceStatus,
    example: AmbulanceStatus.AVAILABLE,
  })
  @ApiQuery({ name: 'isActive', required: false, example: true })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Matching ambulances.',
    schema: {
      example: {
        data: [ambulanceExample],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  findAll(@Query() query: FindAmbulancesQueryDto) {
    return this.ambulanceService.findAll(query);
  }

  @Get('my-ambulance')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get the authenticated driver ambulance' })
  @ApiResponse({
    status: 200,
    description: 'Driver ambulance details.',
    schema: { example: ambulanceExample },
  })
  @ApiResponse({ status: 404, description: 'Driver ambulance not found.' })
  findMyAmbulance(@CurrentUser() user: UserDocument) {
    return this.ambulanceService.findDriverAmbulance(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Get an ambulance by id' })
  @ApiParam({ name: 'id', example: ambulanceExample.id })
  @ApiResponse({
    status: 200,
    description: 'Ambulance details.',
    schema: { example: ambulanceExample },
  })
  @ApiResponse({ status: 404, description: 'Ambulance not found.' })
  findOne(@Param('id') id: string) {
    return this.ambulanceService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update an ambulance' })
  @ApiParam({ name: 'id', example: ambulanceExample.id })
  @ApiBody({ type: UpdateAmbulanceDto })
  @ApiResponse({
    status: 200,
    description: 'Ambulance updated.',
    schema: { example: ambulanceExample },
  })
  update(@Param('id') id: string, @Body() dto: UpdateAmbulanceDto) {
    return this.ambulanceService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER)
  @ApiOperation({ summary: 'Update an ambulance status' })
  @ApiParam({ name: 'id', example: ambulanceExample.id })
  @ApiBody({ type: UpdateAmbulanceStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Ambulance status updated.',
    schema: {
      example: { ...ambulanceExample, status: 'assigned' },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAmbulanceStatusDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.ambulanceService.updateStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete an ambulance' })
  @ApiParam({ name: 'id', example: ambulanceExample.id })
  @ApiResponse({
    status: 200,
    description: 'Ambulance deleted.',
    schema: { example: messageExample },
  })
  remove(@Param('id') id: string) {
    return this.ambulanceService.remove(id);
  }
}
