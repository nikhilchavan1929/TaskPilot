import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AbilityFactory } from './ability.factory';
import { PoliciesGuard } from './policies.guard';

@Module({
  imports: [DatabaseModule],
  providers: [AbilityFactory, PoliciesGuard],
  exports: [AbilityFactory, PoliciesGuard],
})
export class AuthorizationModule {}
