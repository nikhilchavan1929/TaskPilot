import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';
import { AbilityFactory } from './ability.factory';
import { ABILITY_CHECK, type AbilityCheck } from './check-ability.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const check = this.reflector.getAllAndOverride<AbilityCheck>(ABILITY_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!check) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ability = await this.abilityFactory.createForUser(request.user);
    if (!check(ability)) throw new ForbiddenException('You do not have permission to perform this action.');
    return true;
  }
}
