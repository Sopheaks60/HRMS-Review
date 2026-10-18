import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Testing KromPay connection to Neon PostgreSQL...');
  console.log('DATABASE_URL host:', process.env.DATABASE_URL ? (process.env.DATABASE_URL.split('@')[1] || '').split('/')[0] : 'not set');

  try {
    const rawResult: any = await prisma.$queryRaw`SELECT NOW() as server_time, current_database() as db_name, version() as pg_version`;
    console.log('✅ KromPay Prisma connected to Neon PostgreSQL successfully!');
    console.log('Server info:', rawResult);

    // Query payroll_settings from Neon
    const settings: any = await prisma.$queryRaw`SELECT * FROM payroll_settings LIMIT 1`;
    console.log('✅ Retrieved Centralized System Parameters from Neon DB:', {
      companyEntity: settings[0]?.companyEntity,
      exchangeRateKhrUsd: settings[0]?.exchangeRateKhrUsd,
      nssfWageCeilingKhr: settings[0]?.nssfWageCeilingKhr,
      gdtDependentReliefKhr: settings[0]?.gdtDependentReliefKhr,
      updatedAt: settings[0]?.updatedAt,
    });

  } catch (error: any) {
    console.error('❌ KromPay Neon connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

