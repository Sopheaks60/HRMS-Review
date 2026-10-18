import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const hireDateStr = (query.hireDate as string) || '2020-01-15';
  const hireDate = new Date(hireDateStr);
  const today = new Date();

  // Completed years of service
  let completedYears = today.getFullYear() - hireDate.getFullYear();
  const m = today.getMonth() - hireDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < hireDate.getDate())) {
    completedYears--;
  }
  completedYears = Math.max(0, completedYears);

  // Article 166: 1.5 days/month (18 days/yr base) + 1 extra day for every 3 full years of service
  const baseAnnualDays = 18;
  const seniorityBonusDays = Math.floor(completedYears / 3);
  const totalAnnualEntitlement = baseAnnualDays + seniorityBonusDays;

  const currentYearMonthsServed = Math.min(12, today.getMonth() + 1);
  const monthlyAccrualRate = Math.round((totalAnnualEntitlement / 12) * 100) / 100;
  const ytdAccruedDays = Math.round(monthlyAccrualRate * currentYearMonthsServed * 10) / 10;

  return {
    success: true,
    statutoryBasis: 'Cambodia Labor Law Article 166',
    hireDate: hireDateStr,
    completedYearsOfService: completedYears,
    baseAnnualEntitlementDays: baseAnnualDays,
    seniorityBonusDays,
    totalAnnualEntitlementDays: totalAnnualEntitlement,
    monthlyAccrualRate,
    ytdAccruedDays,
    nextSeniorityMilestoneYears: (Math.floor(completedYears / 3) + 1) * 3,
    yearsUntilNextBonusDay: ((Math.floor(completedYears / 3) + 1) * 3) - completedYears,
  };
});

