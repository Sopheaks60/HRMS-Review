import { defineEventHandler, readBody, createError } from 'h3';
import { usePrisma } from '../../utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const prisma = usePrisma();

  const exchangeRate = Number(body.exchangeRateKhrUsd || 4100);
  const nssfCeiling = Number(body.nssfWageCeilingKhr || 1200000);
  const relief = Number(body.gdtDependentReliefKhr || 150000);

  try {
    await prisma.$executeRaw`
      UPDATE payroll_settings 
      SET 
        "exchangeRateKhrUsd" = ${exchangeRate},
        "nssfWageCeilingKhr" = ${nssfCeiling},
        "gdtDependentReliefKhr" = ${relief},
        "updatedAt" = NOW()
      WHERE "companyEntity" = 'KROMPAY_TECH_CAMBODIA'
    `;

    return {
      success: true,
      message: 'System parameters successfully persisted to Neon Serverless PostgreSQL',
      data: body,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database write failure: ${error.message}`,
    });
  }
});

