import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vectorExts = await prisma.$queryRawUnsafe(
    `SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name ILIKE '%vector%'`,
  );
  console.log('VECTOR EXTS:', JSON.stringify(vectorExts, null, 2));

  try {
    const allowed = await prisma.$queryRawUnsafe(`SHOW neon.allowed_extensions`);
    console.log('NEON ALLOWED EXTENSIONS:', JSON.stringify(allowed, null, 2));
  } catch (e) {
    console.log('SHOW failed:', (e as Error).message);
  }
}

main().finally(() => prisma.$disconnect());
