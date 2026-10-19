import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../generated/prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  customRoleId?: string | null;
}
