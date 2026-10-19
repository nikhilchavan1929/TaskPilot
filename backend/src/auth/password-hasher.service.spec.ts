import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  it('hashes a value and verifies only the matching value', async () => {
    const config = {
      get: jest.fn().mockReturnValue('10'),
    } as unknown as ConfigService;
    const hasher = new PasswordHasher(config);
    const sample = randomUUID();

    const passwordHash = await hasher.hash(sample);

    expect(passwordHash).not.toBe(sample);
    await expect(hasher.verify(sample, passwordHash)).resolves.toBe(true);
    await expect(hasher.verify(randomUUID(), passwordHash)).resolves.toBe(false);
  });
});
