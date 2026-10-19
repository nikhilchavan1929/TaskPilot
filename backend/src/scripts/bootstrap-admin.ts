import { PrismaService } from '../database/prisma.service';

async function bootstrapFirstAdministrator(): Promise<void> {
  const emailIndex = process.argv.indexOf('--email');
  const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : undefined;
  if (!email) {
    throw new Error('Provide the email of an already registered account with --email.');
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const existingAdministrators = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (existingAdministrators > 0) {
      throw new Error('Bootstrap is disabled because an administrator already exists.');
    }

    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', customRoleId: null },
    });
    console.log('The registered account is now the first administrator.');
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrapFirstAdministrator().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Administrator bootstrap failed.';
  console.error(message);
  process.exitCode = 1;
});
