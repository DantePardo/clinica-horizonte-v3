-- CreateEnum
CREATE TYPE "Role" AS ENUM ('IT_ADMIN', 'ADMIN_STAFF', 'HEALTH_PROFESSIONAL', 'SECURITY_AUDITOR');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "identityId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "rutCiphertext" TEXT NOT NULL,
    "rutLookupHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "contactCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "attendingDoctorId" UUID NOT NULL,
    "notesCiphertext" TEXT NOT NULL,
    "diagnosisCiphertext" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditOutbox" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAccessEvent" (
    "id" UUID NOT NULL,
    "doctorIdentity" TEXT NOT NULL,
    "patientId" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertTriggered" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmergencyAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identityId_key" ON "User"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_rutLookupHash_key" ON "Patient"("rutLookupHash");

-- CreateIndex
CREATE INDEX "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MedicalRecord_patientId_createdAt_idx" ON "MedicalRecord"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditOutbox_deliveredAt_occurredAt_idx" ON "AuditOutbox"("deliveredAt", "occurredAt");

-- CreateIndex
CREATE INDEX "EmergencyAccessEvent_doctorIdentity_occurredAt_idx" ON "EmergencyAccessEvent"("doctorIdentity", "occurredAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
