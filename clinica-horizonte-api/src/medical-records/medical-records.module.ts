import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';

@Module({
  imports: [AuthModule],
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsService],
})
export class MedicalRecordsModule {}