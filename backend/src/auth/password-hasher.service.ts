import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';

const DEFAULT_BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordHasher {
  private readonly rounds: number;

  constructor(config: ConfigService) {
    const configuredRounds = config.get<string>('BCRYPT_ROUNDS');
    this.rounds = configuredRounds ? Number(configuredRounds) : DEFAULT_BCRYPT_ROUNDS;

    if (!Number.isSafeInteger(this.rounds) || this.rounds < 10 || this.rounds > 14) {
      throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 14.');
    }
  }

  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
