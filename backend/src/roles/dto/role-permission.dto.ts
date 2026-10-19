import { IsIn } from 'class-validator';
import type { AbilityAction, AbilitySubject } from '../../authorization/ability.factory';

const ACTIONS: AbilityAction[] = ['manage', 'create', 'read', 'update', 'delete', 'complete'];
const SUBJECTS: AbilitySubject[] = ['Task', 'User', 'Role', 'all'];

export class RolePermissionDto {
  @IsIn(ACTIONS)
  action!: AbilityAction;

  @IsIn(SUBJECTS)
  subject!: AbilitySubject;
}
