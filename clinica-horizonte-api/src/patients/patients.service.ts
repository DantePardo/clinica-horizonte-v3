import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { FieldEncryptionService } from '../common/field-encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: FieldEncryptionService,
  ) {}

  async create(input: CreatePatientDto) {
    const normalizedRut = input.rut.replace(/[.\s-]/g, '').toUpperCase();
    const contact = JSON.stringify({ email: input.email ?? null, phone: input.phone ?? null });
    const patient = await this.prisma.patient.create({
      data: {
        rutCiphertext: this.encryption.encrypt(normalizedRut),
        rutLookupHash: this.encryption.lookup(normalizedRut),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        contactCiphertext: this.encryption.encrypt(contact),
      },
    });
    return this.toAdministrativeView(patient);
  }

  async findVisibleTo(user: AuthenticatedUser) {
    const isAdministrative = user.roles.includes('ADMIN_STAFF');
    if (!isAdministrative && !user.roles.includes('HEALTH_PROFESSIONAL')) {
      throw new ForbiddenException();
    }
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const patients = await this.prisma.patient.findMany({
      where: isAdministrative
        ? undefined
        : {
            appointments: {
              some: {
                doctor: { identityId: user.sub },
                scheduledAt: { gte: startOfDay, lt: endOfDay },
              },
            },
          },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return patients.map((patient) => {
      if (isAdministrative) return this.toAdministrativeView(patient);
      return {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
      };
    });
  }

  private toAdministrativeView(patient: {
    id: string;
    rutCiphertext: string;
    firstName: string;
    lastName: string;
    contactCiphertext: string;
    createdAt: Date;
  }) {
    return {
      id: patient.id,
      rut: this.encryption.decrypt(patient.rutCiphertext),
      firstName: patient.firstName,
      lastName: patient.lastName,
      contact: JSON.parse(this.encryption.decrypt(patient.contactCiphertext)) as {
        email: string | null;
        phone: string | null;
      },
      createdAt: patient.createdAt,
    };
  }
}