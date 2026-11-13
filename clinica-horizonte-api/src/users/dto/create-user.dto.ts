import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  identityId: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName: string;
}