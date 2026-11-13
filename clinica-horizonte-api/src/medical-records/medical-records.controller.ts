import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OidcAuthGuard } from '../auth/oidc-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BreakGlassDto } from './dto/break-glass.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { MedicalRecordsService } from './medical-records.service';

@ApiTags('medical-records')
@ApiBearerAuth()
@UseGuards(OidcAuthGuard, RolesGuard)
@Roles('HEALTH_PROFESSIONAL')
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Get('patient/:patientId')
  list(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.records.listForPatient(patientId, request.user);
  }

  @Post()
  create(@Body() input: CreateMedicalRecordDto, @Req() request: AuthenticatedRequest) {
    return this.records.create(input, request.user);
  }

  @Post('patient/:patientId/break-glass')
  breakGlass(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() input: BreakGlassDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.records.requestEmergencyAccess(patientId, input, request.user);
  }
}