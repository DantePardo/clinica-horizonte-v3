import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsUUID()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  clinicalNotes: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3000)
  diagnosis: string;
}