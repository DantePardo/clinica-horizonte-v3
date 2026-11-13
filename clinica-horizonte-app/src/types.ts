export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export interface Patient {
  id: string;
  rut?: string;
  firstName: string;
  lastName: string;
  contact?: { email: string | null; phone: string | null };
}
export interface Doctor { id: string; displayName: string }
export interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  doctor: Doctor;
  patient: Patient;
}
export interface MedicalRecord { id: string; clinicalNotes: string; diagnosis: string; createdAt: string }
export interface AuditEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  occurredAt: string;
  ipAddress: string | null;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
}
