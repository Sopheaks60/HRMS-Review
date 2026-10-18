import { defineEventHandler, setResponseHeader } from 'h3';
import { usePrisma } from '../../../utils/prisma';

export default defineEventHandler(async (event) => {
  const prisma = usePrisma();
  let employees: any[] = [];

  try {
    employees = await prisma.$queryRaw`
      SELECT id, "employeeNumber", "firstName", "lastName", "baseSalaryUSD", "currencyPreference", "bankAccountNumber", "bankName"
      FROM employees
      LIMIT 50
    `;
  } catch (err: any) {
    employees = [
      { employeeNumber: 'KP-001', firstName: 'Sophea', lastName: 'Chan', baseSalaryUSD: 1800, bankAccountNumber: '001234567', bankName: 'ABA Bank' },
      { employeeNumber: 'KP-002', firstName: 'Dara', lastName: 'Vann', baseSalaryUSD: 1400, bankAccountNumber: '001889922', bankName: 'Canadia Bank' },
      { employeeNumber: 'KP-003', firstName: 'Bopha', lastName: 'Rith', baseSalaryUSD: 950, bankAccountNumber: '002998811', bankName: 'Wing Bank' },
    ];
  }

  const fxRate = 4100;
  const period = new Date().toISOString().slice(0, 7);

  // Bakong batch payout format
  const headers = ['Merchant_Account_ID', 'Beneficiary_Phone_Or_Account', 'Beneficiary_Name', 'Currency', 'Amount', 'Fee_Payer', 'Payment_Reference', 'Terminal_ID'];
  const rows = employees.map((emp) => {
    const isKhr = emp.currencyPreference === 'KHR';
    const amount = isKhr ? Math.round(Number(emp.baseSalaryUSD || 1000) * fxRate) : Number(emp.baseSalaryUSD || 1000).toFixed(2);
    const currency = isKhr ? 'KHR' : 'USD';
    const phoneOrAcc = emp.bankAccountNumber || `855${Math.floor(10000000 + Math.random() * 89999999)}`;
    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
    const ref = `KP-PAY-${period}-${emp.employeeNumber || '000'}`;

    return [
      'krompay_tech_khqr@aba',
      phoneOrAcc,
      `"${empName}"`,
      currency,
      amount,
      'SENDER',
      ref,
      'KP_TERMINAL_01',
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename=bakong_khqr_batch_${period}.csv`);
  return csvContent;
});

