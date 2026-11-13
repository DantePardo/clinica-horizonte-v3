import { IsDateString, IsInt, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsDateString()
  scheduledAt: string;

  @IsInt()
  @Min(10)
  @Max(240)
  durationMinutes: number;
}