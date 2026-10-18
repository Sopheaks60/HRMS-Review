import { defineEventHandler } from 'h3';
import { usePrisma } from '../../utils/prisma';

const DEFAULT_TAX_BRACKETS = [
  { tier: 1, minKhr: 0, maxKhr: 1500000, rate: 0, deductionKhr: 0 },
  { tier: 2, minKhr: 1500001, maxKhr: 2000000, rate: 0.05, deductionKhr: 75000 },
  { tier: 3, minKhr: 2000001, maxKhr: 8500000, rate: 0.10, deductionKhr: 175000 },
  { tier: 4, minKhr: 8500001, maxKhr: 12500000, rate: 0.15, deductionKhr: 600000 },
  { tier: 5, minKhr: 12500001, maxKhr: null, rate: 0.20, deductionKhr: 1225000 },
];

export default defineEventHandler(async () => {
  const prisma = usePrisma();
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM payroll_settings 
      WHERE "companyEntity" = 'KROMPAY_TECH_CAMBODIA' 
      LIMIT 1
    `;

    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        success: true,
        source: 'neon-postgresql',
        databaseHost: 'ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech',
        databaseName: 'krompay',
        connected: true,
        data: {
          id: row.id,
          companyEntity: row.companyEntity,
          currency: row.currency,
          exchangeRateKhrUsd: Number(row.exchangeRateKhrUsd || 4100),
          nssfWageFloorKhr: 400000,
          nssfWageCeilingKhr: Number(row.nssfWageCeilingKhr || 1200000),
          nssfEmployeePensionRate: Number(row.nssfEmployeePensionRate || 0.02),
          nssfEmployerPensionRate: Number(row.nssfEmployerPensionRate || 0.02),
          nssfHealthCareRate: Number(row.nssfHealthCareRate || 0.026),
          nssfOccupationalRiskRate: Number(row.nssfOccupationalRiskRate || 0.008),
          gdtDependentReliefKhr: Number(row.gdtDependentReliefKhr || 150000),
          seniorityPayFrequency: row.seniorityPayFrequency || 'BIANNUAL_JUNE_DEC',
          seniorityDailyDivisor: 26,
          otRateNormalDay: 1.5,
          otRateNight: 2.0,
          otRateRestDay: 2.0,
          otRateHoliday: 2.0,
          taxBracketsConfig: row.taxBracketsConfig || DEFAULT_TAX_BRACKETS,
          allowancesTaxableByDefault: row.allowancesTaxableByDefault ?? true,
          updatedAt: row.updatedAt,
        },
      };
    }
  } catch (error: any) {
    console.warn('Error reading from Neon DB:', error.message);
  }

  // Statutory fallback
  return {
    success: true,
    source: 'statutory-default',
    databaseHost: 'ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech',
    databaseName: 'krompay',
    connected: false,
    data: {
      companyEntity: 'KROMPAY_TECH_CAMBODIA',
      currency: 'USD',
      exchangeRateKhrUsd: 4100,
      nssfWageFloorKhr: 400000,
      nssfWageCeilingKhr: 1200000,
      nssfEmployeePensionRate: 0.02,
      nssfEmployerPensionRate: 0.02,
      nssfHealthCareRate: 0.026,
      nssfOccupationalRiskRate: 0.008,
      gdtDependentReliefKhr: 150000,
      seniorityPayFrequency: 'BIANNUAL_JUNE_DEC',
      seniorityDailyDivisor: 26,
      otRateNormalDay: 1.5,
      otRateNight: 2.0,
      otRateRestDay: 2.0,
      otRateHoliday: 2.0,
      taxBracketsConfig: DEFAULT_TAX_BRACKETS,
      allowancesTaxableByDefault: true,
      updatedAt: new Date().toISOString(),
    },
  };
});

