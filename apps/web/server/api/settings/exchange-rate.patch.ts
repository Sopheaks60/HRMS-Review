import { defineEventHandler, readBody, createError } from 'h3';
import { usePrisma } from '../../utils/prisma';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const rate = Number(body.usdToKhr || body.rate);

  if (!rate || rate < 1000 || rate > 100000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid exchange rate specified (must be between 1,000 and 100,000 KHR)',
    });
  }

  const prisma = usePrisma();
  try {
    await prisma.$executeRaw`
      UPDATE payroll_settings 
      SET "exchangeRateKhrUsd" = ${rate}, "updatedAt" = NOW()
      WHERE "companyEntity" = 'KROMPAY_TECH_CAMBODIA'
    `;

    return {
      success: true,
      message: `Official GDT monthly exchange rate saved to Neon PostgreSQL: $1 USD = ${rate.toLocaleString()} KHR`,
      exchangeRateKhrUsd: rate,
      updatedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Database update failed: ${error.message}`,
    });
  }
});

