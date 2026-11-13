import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class BreakGlassDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(500)
  justification: string;
}