import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OidcAuthGuard } from '../auth/oidc-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AppointmentsService } from './appointments.service';

class DayQuery {
  @IsOptional()
  @IsDateString()
  date: string;
}

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(OidcAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Roles('ADMIN_STAFF', 'HEALTH_PROFESSIONAL')
  list(@Req() request: AuthenticatedRequest, @Query() query: DayQuery) {
    return this.appointments.listForDay(request.user, query.date ?? new Date().toISOString().slice(0, 10));
  }

  @Post()
  @Roles('ADMIN_STAFF')
  create(@Body() input: CreateAppointmentDto) {
    return this.appointments.create(input);
  }

  @Patch(':id/status')
  @Roles('ADMIN_STAFF', 'HEALTH_PROFESSIONAL')
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateAppointmentStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appointments.updateStatus(id, input.status as AppointmentStatus, request.user);
  }
}