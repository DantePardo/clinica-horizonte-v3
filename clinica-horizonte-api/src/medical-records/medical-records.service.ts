import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { BreakGlassDto } from './dto/break-glass.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly toleranceMinutes = Number(process.env.ACCESS_WINDOW_TOLERANCE_MINUTES ?? 15);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async listForPatient(patientId: string, user: AuthenticatedUser) {
    const doctor = await this.prisma.user.findUnique({ where: { identityId: user.sub } });
    if (!doctor || doctor.role !== 'HEALTH_PROFESSIONAL') throw new ForbiddenException();

    const now = new Date();
    const since = new Date(now.getTime() - (240 + this.toleranceMinutes) * 60_000);
    const until = new Date(now.getTime() + this.toleranceMinutes * 60_000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        doctorId: doctor.id,
        scheduledAt: { gte: since, lte: until },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    const hasAppointment = appointments.some((appointment) => {
      const start = appointment.scheduledAt.getTime() - this.toleranceMinutes * 60_000;
      const end = appointment.scheduledAt.getTime() +
        (appointment.durationMinutes + this.toleranceMinutes) * 60_000;
      return now.getTime() >= start && now.getTime() <= end;
    });
    const hasEmergencyAccess = await this.prisma.emergencyAccessEvent.findFirst({
      where: {
        patientId,
        doctorIdentity: user.sub,
        occurredAt: { gte: new Date(now.getTime() - 15 * 60_000) },
      },
    });
    if (!hasAppointment && !hasEmergencyAccess) throw new ForbiddenException();

    const records = await this.prisma.medicalRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      id: record.id,
      clinicalNotes: this.encryption.decrypt(record.notesCiphertext),
      diagnosis: this.encryption.decrypt(record.diagnosisCiphertext),
      createdAt: record.createdAt,
    }));
  }

  async create(input: CreateMedicalRecordDto, user: AuthenticatedUser) {
    const doctor = await this.prisma.user.findUnique({ where: { identityId: user.sub } });
    if (!doctor || doctor.role !== 'HEALTH_PROFESSIONAL') throw new ForbiddenException();
    if (!(await this.hasActiveAppointment(input.patientId, doctor.id))) {
      throw new ForbiddenException('A medical record requires an active assigned appointment');
    }

    const record = await this.prisma.medicalRecord.create({
      data: {
        patientId: input.patientId,
        attendingDoctorId: doctor.id,
        notesCiphertext: this.encryption.encrypt(input.clinicalNotes),
        diagnosisCiphertext: this.encryption.encrypt(input.diagnosis),
      },
    });
    return { id: record.id, createdAt: record.createdAt };
  }

  async requestEmergencyAccess(patientId: string, input: BreakGlassDto, user: AuthenticatedUser) {
    const doctor = await this.prisma.user.findUnique({ where: { identityId: user.sub } });
    if (!doctor || doctor.role !== 'HEALTH_PROFESSIONAL') throw new ForbiddenException();
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException();

    const occurredAt = new Date();
    await this.prisma.$transaction([
      this.prisma.emergencyAccessEvent.create({
        data: {
          doctorIdentity: user.sub,
          patientId,
          justification: input.justification.trim(),
          occurredAt,
        },
      }),
      this.prisma.auditOutbox.create({
        data: {
          eventType: 'BREAK_GLASS_ACCESS',
          actorId: user.sub,
          resource: 'medical-records',
          resourceId: patientId,
          occurredAt,
          metadata: { priority: 'high' },
        },
      }),
    ]);
    return { granted: true, expiresAt: new Date(occurredAt.getTime() + 15 * 60_000) };
  }

  private async hasActiveAppointment(patientId: string, doctorId: string) {
    const now = new Date();
    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId,
        doctorId,
        scheduledAt: {
          gte: new Date(now.getTime() - (240 + this.toleranceMinutes) * 60_000),
          lte: new Date(now.getTime() + this.toleranceMinutes * 60_000),
        },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
    return appointments.some((appointment) => {
      const start = appointment.scheduledAt.getTime() - this.toleranceMinutes * 60_000;
      const end = appointment.scheduledAt.getTime() +
        (appointment.durationMinutes + this.toleranceMinutes) * 60_000;
      return now.getTime() >= start && now.getTime() <= end;
    });
  }
}