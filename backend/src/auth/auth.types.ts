import type { UserRole } from '../generated/prisma/client';
import type { AppRule } from '../authorization/ability.factory';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  tokenUse: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  tokenUse: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  customRoleId: string | null;
  sessionId: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: string;
  permissions: AppRule[];
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}
