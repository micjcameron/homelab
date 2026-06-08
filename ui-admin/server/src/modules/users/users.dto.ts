import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { UserRole } from './users.types';

export class UserDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ example: 'admin' })
  @Expose()
  username!: string;

  @ApiProperty({ enum: UserRole })
  @Expose()
  role!: UserRole;

  @Exclude()
  password!: string;
}
