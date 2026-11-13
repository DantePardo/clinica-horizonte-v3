import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OidcAuthGuard } from '../auth/oidc-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(OidcAuthGuard, RolesGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @Roles('ADMIN_STAFF', 'HEALTH_PROFESSIONAL')
  list(@Req() request: AuthenticatedRequest) {
    return this.patients.findVisibleTo(request.user);
  }

  @Post()
  @Roles('ADMIN_STAFF')
  create(@Body() input: CreatePatientDto) {
    return this.patients.create(input);
  }
}