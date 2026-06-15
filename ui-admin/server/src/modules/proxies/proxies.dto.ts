import { ArrayNotEmpty, IsArray, IsEmail } from 'class-validator';

export class GateDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails!: string[];
}
