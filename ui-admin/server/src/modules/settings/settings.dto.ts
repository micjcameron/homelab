import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCloudflareDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  token?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  accountId?: string;
}
