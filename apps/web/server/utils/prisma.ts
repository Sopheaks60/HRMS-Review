import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function usePrisma(): PrismaClient {
  if (!prismaInstance) {
    const databaseUrl =
      process.env.DATABASE_URL ||
      'postgresql://neondb_owner:npg_iC4OogpK5YjB@ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech/krompay?sslmode=require&connect_timeout=30&pool_timeout=30&pgbouncer=true';

    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ['error', 'warn'],
    });
  }
  return prismaInstance;
}

