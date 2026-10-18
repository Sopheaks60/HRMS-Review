import { defineEventHandler } from 'h3';
import { usePrisma } from '../utils/prisma';

export default defineEventHandler(async () => {
  const prisma = usePrisma();
  const startTime = Date.now();
  try {
    const rawResult: any = await prisma.$queryRaw`
      SELECT NOW() as server_time, current_database() as db_name, version() as pg_version
    `;
    const latency = Date.now() - startTime;
    return {
      status: 'UP',
      database: 'Neon Serverless PostgreSQL',
      host: 'ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech',
      latencyMs: latency,
      serverTime: rawResult[0]?.server_time,
      databaseName: rawResult[0]?.db_name,
      pgVersion: rawResult[0]?.pg_version,
      architecture: 'Nuxt 4 Full-Stack (Nitro Engine)',
    };
  } catch (error: any) {
    return {
      status: 'DOWN',
      database: 'Neon Serverless PostgreSQL',
      error: error.message,
      architecture: 'Nuxt 4 Full-Stack (Nitro Engine)',
    };
  }
});

