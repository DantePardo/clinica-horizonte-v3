import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async listForDay(user: AuthenticatedUser, date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) throw new ForbiddenException('Invalid date');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        ...(user.roles.includes('HEALTH_PROFESSIONAL')
          ? { doctor: { identityId: user.sub } }
          : {}),
      },
      include: {
        doctor: { select: { id: true, displayName: true } },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            contactCiphertext: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return appointments.map(({ patient, ...appointment }) => ({
      ...appointment,
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        ...(user.roles.includes('ADMIN_STAFF')
          ? { contact: JSON.parse(this.encryption.decrypt(patient.contactCiphertext)) }
          : {}),
      },
    }));
  }

  create(input: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: { ...input, scheduledAt: new Date(input.scheduledAt) },
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateStatus(id: string, status: AppointmentStatus, user: AuthenticatedUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { doctor: { select: { identityId: true } } },
    });
    if (!appointment) throw new NotFoundException();
    if (
      user.roles.includes('HEALTH_PROFESSIONAL') &&
      appointment.doctor.identityId !== user.sub
    ) {
      throw new ForbiddenException();
    }
    if (user.roles.includes('HEALTH_PROFESSIONAL') && status !== 'COMPLETED') {
      throw new ForbiddenException('Professionals can only mark assigned appointments as completed');
    }
    return this.prisma.appointment.update({ where: { id }, data: { status } });
  }
}