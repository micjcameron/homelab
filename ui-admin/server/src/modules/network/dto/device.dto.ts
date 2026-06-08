import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveDto {
  @ApiPropertyOptional({ example: 'Living Room TV' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredName?: string;
}

export class RenameDto {
  @ApiProperty({ example: 'Living Room TV' })
  @IsString()
  @MaxLength(60)
  preferredName!: string;
}
