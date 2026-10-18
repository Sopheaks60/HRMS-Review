import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SystemParametersDto {
  companyEntity?: string;
  currency?: string;
  exchangeRateKhrUsd?: number;
  nssfWageFloorKhr?: number;
  nssfWageCeilingKhr?: number;
  nssfEmployeePensionRate?: number;
  nssfEmployerPensionRate?: number;
  nssfHealthCareRate?: number;
  nssfOccupationalRiskRate?: number;
  gdtDependentReliefKhr?: number;
  seniorityPayFrequency?: string;
  taxBracketsConfig?: any[];
  allowancesTaxableByDefault?: boolean;
}

const DEFAULT_TAX_BRACKETS = [
  { tier: 1, minKhr: 0, maxKhr: 1500000, rate: 0, deductionKhr: 0 },
  { tier: 2, minKhr: 1500001, maxKhr: 2000000, rate: 0.05, deductionKhr: 75000 },
  { tier: 3, minKhr: 2000001, maxKhr: 8500000, rate: 0.10, deductionKhr: 175000 },
  { tier: 4, minKhr: 8500001, maxKhr: 12500000, rate: 0.15, deductionKhr: 600000 },
  { tier: 5, minKhr: 12500001, maxKhr: null, rate: 0.20, deductionKhr: 1225000 },
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch centralized statutory system parameters from Neon PostgreSQL
   */
  async getSystemParameters() {
    try {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT * FROM payroll_settings 
        WHERE "companyEntity" = 'KROMPAY_TECH_CAMBODIA' 
        LIMIT 1
      `;

      if (rows && rows.length > 0) {
        const row = rows[0];
        return {
          source: 'neon-postgresql',
          databaseHost: 'ep-young-wave-b578dmsm-pooler.c-7.us-east-2.aws.neon.tech',
          databaseName: 'krompay',
          connected: true,
          data: {
            id: row.id,
            companyEntity: row.companyEntity,
            currency: row.currency,
            exchangeRateKhrUsd: Number(row.exchangeRateKhrUsd),
            nssfWageFloorKhr: 400000,
            nssfWageCeilingKhr: Number(row.nssfWageCeilingKhr),
            nssfEmployeePensionRate: Number(row.nssfEmployeePensionRate),
            nssfEmployerPensionRate: Number(row.nssfEmployerPensionRate),
            nssfHealthCareRate: Number(row.nssfHealthCareRate),
            nssfOccupationalRiskRate: Number(row.nssfOccupationalRiskRate),
            gdtDependentReliefKhr: Number(row.gdtDependentReliefKhr),
            seniorityPayFrequency: row.seniorityPayFrequency,
            taxBracketsConfig: row.taxBracketsConfig || DEFAULT_TAX_BRACKETS,
            allowancesTaxableByDefault: row.allowancesTaxableByDefault,
            updatedAt: row.updatedAt,
          },
        };
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch from Neon DB: ${err.message}`);
    }

    // Default statutory fallback
    return {
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
        taxBracketsConfig: DEFAULT_TAX_BRACKETS,
        allowancesTaxableByDefault: true,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Update GDT official monthly exchange rate in Neon PostgreSQL
   */
  async updateExchangeRate(usdToKhr: number) {
    if (!usdToKhr || usdToKhr < 1000 || usdToKhr > 100000) {
      throw new Error('Exchange rate must be between 1,000 and 100,000 KHR');
    }

    await this.prisma.$executeRaw`
      UPDATE payroll_settings 
      SET "exchangeRateKhrUsd" = ${usdToKhr}, "updatedAt" = NOW()
      WHERE "companyEntity" = 'KROMPAY_TECH_CAMBODIA'
    `;

    return {
      success: true,
      message: `Official GDT monthly exchange rate persisted to Neon PostgreSQL: $1 USD = ${usdToKhr.toLocaleString()} KHR`,
      exchangeRateKhrUsd: usdToKhr,
    };
  }

  /**
   * Update full statutory parameters in Neon PostgreSQL
   */
  async updateSystemParameters(dto: SystemParametersDto) {
    const exchangeRate = Number(dto.exchangeRateKhrUsd || 4100);
    const nssfCeiling = Number(dto.nssfWageCeilingKhr || 1200000);
    const relief = Number(dto.gdtDependentReliefKhr || 150000);

    await this.prisma.$executeRaw`
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
      message: 'Centralized statutory parameters successfully updated in Neon PostgreSQL',
      data: dto,
    };
  }
}

