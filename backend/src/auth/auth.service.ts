import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordHasher } from './password-hasher.service';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  PublicUser,
  RefreshTokenPayload,
  TokenPair,
} from './auth.types';
import { AbilityFactory } from '../authorization/ability.factory';

const TOKEN_ISSUER = 'todo-assignment-api';
const TOKEN_AUDIENCE = 'todo-assignment-web';
const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  readonly refreshTtlSeconds: number;

  private readonly accessTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordHasher: PasswordHasher,
    private readonly abilityFactory: AbilityFactory,
  ) {
    this.accessTtlSeconds = this.readPositiveInteger(
      'JWT_ACCESS_TTL_SECONDS',
      DEFAULT_ACCESS_TTL_SECONDS,
    );
    this.refreshTtlSeconds = this.readPositiveInteger(
      'JWT_REFRESH_TTL_SECONDS',
      DEFAULT_REFRESH_TTL_SECONDS,
    );
  }

  async register(emailInput: string, password: string): Promise<TokenPair> {
    const secrets = this.getTokenSecrets();
    this.assertPasswordByteLength(password);
    const email = this.normalizeEmail(emailInput);
    const passwordHash = await this.passwordHasher.hash(password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }

    return this.createSession(user, secrets);
  }

  async login(emailInput: string, password: string): Promise<TokenPair> {
    const secrets = this.getTokenSecrets();
    this.assertPasswordByteLength(password);
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await this.passwordHasher.verify(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSession(user, secrets);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const secrets = this.getTokenSecrets();
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: secrets.refresh,
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      payload.tokenUse !== 'refresh' ||
      typeof payload.sid !== 'string' ||
      typeof payload.sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const oldHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !this.hashesMatch(session.tokenHash, oldHash)) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const rotatedRefreshToken = await this.signRefreshToken(
      session.userId,
      session.id,
      secrets.refresh,
    );
    const accessToken = await this.signAccessToken(
      session.userId,
      session.id,
      secrets.access,
    );
    const newHash = this.hashToken(rotatedRefreshToken);
    const expiresAt = this.refreshExpiry();

    // Compare-and-swap prevents two concurrent refreshes from both succeeding.
    const rotation = await this.prisma.refreshSession.updateMany({
      where: {
        id: session.id,
        tokenHash: oldHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { tokenHash: newHash, expiresAt },
    });

    if (rotation.count !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return {
      accessToken,
      refreshToken: rotatedRefreshToken,
      user: await this.toPublicUser(session.user),
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    const secrets = this.getTokenSecrets();
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: secrets.access,
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      payload.tokenUse !== 'access' ||
      typeof payload.sid !== 'string' ||
      typeof payload.sub !== 'string'
    ) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: { select: { id: true, email: true, role: true, customRoleId: true } },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session is no longer active.');
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      customRoleId: session.user.customRoleId,
      sessionId: session.id,
    };
  }

  private async createSession(
    user: User,
    secrets: { access: string; refresh: string },
  ): Promise<TokenPair> {
    const sessionId = randomUUID();
    const refreshToken = await this.signRefreshToken(
      user.id,
      sessionId,
      secrets.refresh,
    );
    const accessToken = await this.signAccessToken(
      user.id,
      sessionId,
      secrets.access,
    );

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });

    return { accessToken, refreshToken, user: await this.toPublicUser(user) };
  }

  private async signAccessToken(
    userId: string,
    sessionId: string,
    secret: string,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      tokenUse: 'access',
    };
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: this.accessTtlSeconds,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithm: 'HS256',
    });
  }

  private async signRefreshToken(
    userId: string,
    sessionId: string,
    secret: string,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      tokenUse: 'refresh',
    };
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: this.refreshTtlSeconds,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithm: 'HS256',
    });
  }

  private getTokenSecrets(): { access: string; refresh: string } {
    return {
      access: this.requireSecret('JWT_ACCESS_SECRET'),
      refresh: this.requireSecret('JWT_REFRESH_SECRET'),
    };
  }

  private requireSecret(key: string): string {
    const secret = this.configService.get<string>(key);
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new ServiceUnavailableException(
        `${key} must be configured with at least 32 bytes before authentication can be used.`,
      );
    }
    return secret;
  }

  private readPositiveInteger(key: string, fallback: number): number {
    const configured = this.configService.get<string>(key);
    if (configured === undefined || configured.trim() === '') return fallback;

    const value = Number(configured);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer.`);
    }
    return value;
  }

  private assertPasswordByteLength(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Password must be no more than 72 UTF-8 bytes.');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlSeconds * 1000);
  }

  private async toPublicUser(
    user: Pick<User, 'id' | 'email' | 'role' | 'customRoleId' | 'firstName' | 'lastName' | 'avatarUrl'>,
  ): Promise<PublicUser> {
    const [customRole, permissions] = await Promise.all([
      user.customRoleId
        ? this.prisma.role.findUnique({ where: { id: user.customRoleId }, select: { name: true } })
        : null,
      this.abilityFactory.rulesForUser({ id: user.id, role: user.role, customRoleId: user.customRoleId }),
    ]);
    return {
      id: user.id,
      email: user.email,
      role: customRole?.name ?? user.role,
      permissions,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}





