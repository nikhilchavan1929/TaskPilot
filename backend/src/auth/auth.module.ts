import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordHasher } from './password-hasher.service';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [JwtModule.register({}), AuthorizationModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PasswordHasher],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
