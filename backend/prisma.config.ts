import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
  datasource: {
    // Safe local default; override via the shell environment when needed.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
