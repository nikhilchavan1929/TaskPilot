import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from './ability.factory';

export const ABILITY_CHECK = 'todo:ability-check';
export type AbilityCheck = (ability: AppAbility) => boolean;

export const CheckAbility = (check: AbilityCheck) => SetMetadata(ABILITY_CHECK, check);
