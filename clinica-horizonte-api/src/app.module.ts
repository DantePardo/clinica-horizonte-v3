import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientsModule } from './patients/patients.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { AuditController } from './audit/audit.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    MedicalRecordsModule,
  ],
  controllers: [HealthController, AuditController],
})
export class AppModule {}