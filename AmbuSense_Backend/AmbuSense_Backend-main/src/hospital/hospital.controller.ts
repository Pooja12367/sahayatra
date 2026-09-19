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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import { HospitalService } from './hospital.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { FindHospitalsQueryDto } from './dto/find-hospitals-query.dto';
import { hospitalExample, messageExample } from '../swagger/api-examples';

@ApiTags('Hospitals')
@ApiCookieAuth('session')
@Controller('hospitals')
@UseGuards(AuthGuard, RolesGuard)
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Create a hospital' })
  @ApiBody({ type: CreateHospitalDto })
  @ApiResponse({
    status: 201,
    description: 'Hospital created.',
    schema: { example: hospitalExample },
  })
  create(@Body() dto: CreateHospitalDto) {
    return this.hospitalService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  @ApiOperation({ summary: 'List hospitals' })
  @ApiQuery({ name: 'search', required: false, example: 'City Care' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['available', 'busy', 'offline'],
    example: 'available',
  })
  @ApiQuery({ name: 'hasAvailableBeds', required: false, example: true })
  @ApiResponse({
    status: 200,
    description: 'Matching hospitals.',
    schema: { example: [hospitalExample] },
  })
  findAll(@Query() query: FindHospitalsQueryDto) {
    return this.hospitalService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  @ApiOperation({ summary: 'Get a hospital by id' })
  @ApiParam({ name: 'id', example: hospitalExample.id })
  @ApiResponse({
    status: 200,
    description: 'Hospital details.',
    schema: { example: hospitalExample },
  })
  @ApiResponse({ status: 404, description: 'Hospital not found.' })
  findOne(@Param('id') id: string) {
    return this.hospitalService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  @ApiOperation({ summary: 'Update a hospital' })
  @ApiParam({ name: 'id', example: hospitalExample.id })
  @ApiBody({ type: UpdateHospitalDto })
  @ApiResponse({
    status: 200,
    description: 'Hospital updated.',
    schema: { example: hospitalExample },
  })
  update(@Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a hospital' })
  @ApiParam({ name: 'id', example: hospitalExample.id })
  @ApiResponse({
    status: 200,
    description: 'Hospital deleted.',
    schema: { example: messageExample },
  })
  remove(@Param('id') id: string) {
    return this.hospitalService.remove(id);
  }
}
