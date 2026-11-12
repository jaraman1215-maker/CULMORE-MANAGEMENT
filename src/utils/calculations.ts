import { Shift, StoreSettings, PayrollAdjustment, Employee } from '../types';

/**
 * Checks if an employee belongs to the Cashier part/department based on department or position title.
 * Cashier rules: Shifts >= 6h get 20m paid break, shifts >= 11h get 40m paid break.
 */
export function isCashierEmployee(dept?: string, position?: string): boolean {
  const text = `${dept || ''} ${position || ''}`.toLowerCase();
  return (
    text.includes('cashier') ||
    text.includes('캐셔') ||
    text.includes('계산') ||
    text.includes('front end') ||
    text.includes('csm')
  );
}

/**
 * Determines statutory/store eligible paid break duration based on raw shift duration and role.
 * Policy:
 * - General staff: >= 11h -> 60m paid (1h); >= 6h -> 30m paid; < 6h -> 0m.
 * - Cashier part: >= 11h -> 40m paid; >= 6h -> 20m paid; < 6h -> 0m.
 */
export function calculateEligiblePaidBreak(rawHours: number, isCashier: boolean = false): number {
  if (isCashier) {
    if (rawHours >= 11) return 40;
    if (rawHours >= 6) return 20;
    return 0;
  } else {
    if (rawHours >= 11) return 60;
    if (rawHours >= 6) return 30;
    return 0;
  }
}

export interface ShiftHoursCalculationResult {
  hours: number;
  isOvernight: boolean;
  rawHours: number;
  paidBreakMinutes: number;
  actualBreakMinutes: number;
  excessBreakMinutes: number;
}

/**
 * Calculates net working hours for a shift, accurately supporting overnight shifts crossing midnight
 * and applying the Virginia grocery store paid break policy.
 * - Shifts >= 6h get 30m paid (Cashier: 20m)
 * - Shifts >= 11h get 60m paid (Cashier: 40m)
 * - Excess break taken over the paid allowance is unpaid and deducted from payable hours.
 */
export function calculateShiftHours(
  startTime: string,
  endTime: string,
  breakOrActualMinutes?: number,
  isCashier: boolean = false
): ShiftHoursCalculationResult {
  if (!startTime || !endTime) {
    return {
      hours: 0,
      isOvernight: false,
      rawHours: 0,
      paidBreakMinutes: 0,
      actualBreakMinutes: 0,
      excessBreakMinutes: 0,
    };
  }

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  if (
    isNaN(startHour) ||
    isNaN(startMin) ||
    isNaN(endHour) ||
    isNaN(endMin)
  ) {
    return {
      hours: 0,
      isOvernight: false,
      rawHours: 0,
      paidBreakMinutes: 0,
      actualBreakMinutes: 0,
      excessBreakMinutes: 0,
    };
  }

  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  let isOvernight = false;
  let rawDurationMinutes = 0;

  if (endTotalMinutes > startTotalMinutes) {
    // Normal same-day shift
    rawDurationMinutes = endTotalMinutes - startTotalMinutes;
  } else if (endTotalMinutes < startTotalMinutes) {
    // Overnight shift crossing midnight (e.g., 22:00 to 06:00)
    isOvernight = true;
    rawDurationMinutes = 24 * 60 - startTotalMinutes + endTotalMinutes;
  } else {
    rawDurationMinutes = 0;
  }

  const rawHours = Math.round((rawDurationMinutes / 60) * 100) / 100;
  const paidBreakMinutes = calculateEligiblePaidBreak(rawHours, isCashier);

  // If breakOrActualMinutes is specified, that is the actual break taken.
  // Otherwise, default actual break to the granted paid break allowance.
  const actualBreakMinutes =
    breakOrActualMinutes !== undefined
      ? Math.max(0, Number(breakOrActualMinutes) || 0)
      : paidBreakMinutes;

  // Unpaid excess break that exceeds the paid allowance
  const excessBreakMinutes = Math.max(0, actualBreakMinutes - paidBreakMinutes);
  const payableMinutes = Math.max(0, rawDurationMinutes - excessBreakMinutes);

  // Net payable hours rounded to 2 decimal places
  const hours = Math.round((payableMinutes / 60) * 100) / 100;

  return {
    hours,
    isOvernight,
    rawHours,
    paidBreakMinutes,
    actualBreakMinutes,
    excessBreakMinutes,
  };
}

/**
 * Resolves a shift with break calculations dynamically matched to the employee's current
 * work part (department & position), ensuring break rules and payable hours stay strictly in sync
 * whenever an employee's department/position is updated in Employee Management.
 */
export function getEffectiveShiftForEmployee(shift: Shift, emp?: Employee): Shift {
  if (!emp) return shift;
  const isCashier = isCashierEmployee(emp.department, emp.position);
  const calc = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.actualBreakMinutes ?? shift.breakMinutes,
    isCashier
  );
  return {
    ...shift,
    hours: calc.hours,
    rawHours: calc.rawHours,
    paidBreakMinutes: calc.paidBreakMinutes,
    actualBreakMinutes: calc.actualBreakMinutes,
    excessBreakMinutes: calc.excessBreakMinutes,
    isOvernight: calc.isOvernight,
    businessGroup: emp.businessGroup || shift.businessGroup,
  };
}

/**
 * Sums all shift hours for a week and splits into FLSA regular hours (<= 40) and overtime (> 40).
 */
export function calculateWeeklyHoursSummary(shifts: Shift[]): {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
} {
  const totalHours = shifts.reduce((sum, shift) => sum + (Number(shift.hours) || 0), 0);
  const roundedTotal = Math.round(totalHours * 100) / 100;
  const regularHours = Math.min(40, roundedTotal);
  const overtimeHours = Math.max(0, Math.round((roundedTotal - 40) * 100) / 100);

  return {
    totalHours: roundedTotal,
    regularHours,
    overtimeHours,
  };
}

export interface PayrollCalculationInput {
  hourlyWage: number;
  regularHours: number;
  overtimeHours: number;
  settings: StoreSettings;
  customFederalRate?: number;
  customVaRate?: number;
  insuranceDeduction?: number;
  otherDeductions?: number;
  adjustments?: PayrollAdjustment[];
  withholdFederal?: boolean;
  withholdVirginia?: boolean;
  withholdSocialSecurity?: boolean;
  withholdMedicare?: boolean;
}

export interface PayrollCalculationResult {
  regularPay: number;
  overtimePay: number;
  adjustmentsTotal: number;
  grossPay: number;
  federalWithholding: number;
  vaWithholding: number;
  socialSecurityTax: number;
  medicareTax: number;
  totalTaxes: number;
  insuranceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  withholdFederal: boolean;
  withholdVirginia: boolean;
  withholdSocialSecurity: boolean;
  withholdMedicare: boolean;
}

/**
 * Calculates complete payroll breakdown for an employee workweek adhering to
 * Fair Labor Standards Act (FLSA 1.5x OT) and Virginia withholding & FICA mandates.
 * Supports selectable withholding toggles (e.g. for exempt staff, contractor, or custom deduction rules).
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const wage = Math.max(0, Number(input.hourlyWage) || 0);
  const regHours = Math.max(0, Number(input.regularHours) || 0);
  const otHours = Math.max(0, Number(input.overtimeHours) || 0);

  const otMultiplier = Number(input.settings?.overtimeMultiplier) || 1.5;
  const regularPay = Math.round(regHours * wage * 100) / 100;
  const overtimeRate = wage * otMultiplier;
  const overtimePay = Math.round(otHours * overtimeRate * 100) / 100;

  // Sum adjustments
  const adjustmentsTotal = (input.adjustments || []).reduce(
    (sum, adj) => sum + (Number(adj.amount) || 0),
    0
  );

  const grossPay = Math.max(
    0,
    Math.round((regularPay + overtimePay + adjustmentsTotal) * 100) / 100
  );

  // Check which withholdings are enabled (defaults to true if undefined)
  const ssEnabled = input.withholdSocialSecurity !== false;
  const medEnabled = input.withholdMedicare !== false;
  const fedEnabled = input.withholdFederal !== false;
  const vaEnabled = input.withholdVirginia !== false;

  // FICA Statutory Taxes (Mandatory US Rates: Social Security 6.2%, Medicare 1.45%)
  const ssRate = (Number(input.settings?.socialSecurityRate) || 6.20) / 100;
  const medRate = (Number(input.settings?.medicareRate) || 1.45) / 100;

  const socialSecurityTax = ssEnabled ? Math.round(grossPay * ssRate * 100) / 100 : 0;
  const medicareTax = medEnabled ? Math.round(grossPay * medRate * 100) / 100 : 0;

  // Estimated Withholding Taxes (Configurable / Adjustable)
  const fedRate =
    (input.customFederalRate !== undefined
      ? input.customFederalRate
      : input.settings?.federalTaxDefaultRate ?? 10.0) / 100;
  const vaRate =
    (input.customVaRate !== undefined
      ? input.customVaRate
      : input.settings?.vaTaxDefaultRate ?? 5.0) / 100;

  const federalWithholding = fedEnabled ? Math.round(grossPay * fedRate * 100) / 100 : 0;
  const vaWithholding = vaEnabled ? Math.round(grossPay * vaRate * 100) / 100 : 0;

  const totalTaxes = Math.round(
    (federalWithholding + vaWithholding + socialSecurityTax + medicareTax) * 100
  ) / 100;

  const insurance = Math.max(0, Number(input.insuranceDeduction) || 0);
  const other = Math.max(0, Number(input.otherDeductions) || 0);

  const totalDeductions = Math.round((totalTaxes + insurance + other) * 100) / 100;
  const netPay = Math.max(0, Math.round((grossPay - totalDeductions) * 100) / 100);

  return {
    regularPay,
    overtimePay,
    adjustmentsTotal,
    grossPay,
    federalWithholding,
    vaWithholding,
    socialSecurityTax,
    medicareTax,
    totalTaxes,
    insuranceDeduction: insurance,
    otherDeductions: other,
    totalDeductions,
    netPay,
    withholdFederal: fedEnabled,
    withholdVirginia: vaEnabled,
    withholdSocialSecurity: ssEnabled,
    withholdMedicare: medEnabled,
  };
}

/**
 * Currency formatter ($X.XX USD)
 */
export function formatCurrency(amount: number): string {
  const safe = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Formats time from 24h 'HH:MM' to friendly 12h 'h:mm A'
 */
export function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${mStr} ${ampm}`;
}

/**
 * Automated test suite verifying calculation accuracy for overnight shifts, overtime rules,
 * tax rates, and payroll rounding. Runs in-browser to verify production readiness.
 */
export interface CalculationTestResult {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  category: 'Shift Hours' | 'Overtime' | 'FICA Taxes' | 'Net Pay' | 'Overnight';
}

export function runCalculationSelfTests(): CalculationTestResult[] {
  const tests: CalculationTestResult[] = [];

  // Test 1: Standard daytime shift with paid break (08:00 - 16:30, 8.5h raw, 30m break)
  // Raw >= 6h grants 30m paid break. Actual 30m <= 30m paid -> 0 excess -> 8.50 payable hrs.
  const t1 = calculateShiftHours('08:00', '16:30', 30, false);
  tests.push({
    name: 'Daytime shift with 30m paid break (08:00 - 16:30, raw 8.5h, 30m break)',
    expected: '8.50 hrs (overnight: false, paid: 30m, excess: 0m)',
    actual: `${t1.hours.toFixed(2)} hrs (overnight: ${t1.isOvernight}, paid: ${t1.paidBreakMinutes}m, excess: ${t1.excessBreakMinutes}m)`,
    passed: t1.hours === 8.5 && !t1.isOvernight && t1.paidBreakMinutes === 30 && t1.excessBreakMinutes === 0,
    category: 'Shift Hours',
  });

  // Test 2: Shift with excess break deducted (08:00 - 16:30, 8.5h raw, 60m actual break)
  // 60m actual - 30m paid = 30m excess unpaid deduction -> 8.00 payable hrs.
  const t2 = calculateShiftHours('08:00', '16:30', 60, false);
  tests.push({
    name: 'Daytime shift with excess break (08:00 - 16:30, 60m break -> 30m excess deducted)',
    expected: '8.00 hrs (excess: 30m deducted)',
    actual: `${t2.hours.toFixed(2)} hrs (excess: ${t2.excessBreakMinutes}m deducted)`,
    passed: t2.hours === 8.0 && t2.excessBreakMinutes === 30,
    category: 'Shift Hours',
  });

  // Test 3: Cashier role shift >= 6h (08:00 - 16:00, 8.0h raw, 30m actual break)
  // Cashier >= 6h gets 20m paid break. 30m actual - 20m paid = 10m excess deducted -> 470m = 7.83 hrs.
  const t3 = calculateShiftHours('08:00', '16:00', 30, true);
  tests.push({
    name: 'Cashier Part shift (08:00 - 16:00, 8.0h raw, 20m paid, 30m break taken)',
    expected: '7.83 hrs (paid: 20m, excess: 10m)',
    actual: `${t3.hours.toFixed(2)} hrs (paid: ${t3.paidBreakMinutes}m, excess: ${t3.excessBreakMinutes}m)`,
    passed: t3.hours === 7.83 && t3.paidBreakMinutes === 20 && t3.excessBreakMinutes === 10,
    category: 'Shift Hours',
  });

  // Test 4: Long shift >= 11h grants 60m paid break (Cashier: 40m)
  const t4General = calculateShiftHours('08:00', '20:00', 60, false); // 12h raw, 60m paid -> 12.00h
  const t4Cashier = calculateShiftHours('08:00', '20:00', 40, true);  // 12h raw, 40m paid -> 12.00h
  tests.push({
    name: 'Long shift >= 11h (12h raw: General 60m paid, Cashier 40m paid)',
    expected: 'General: 12.00 hrs (paid: 60m), Cashier: 12.00 hrs (paid: 40m)',
    actual: `General: ${t4General.hours.toFixed(2)} hrs (paid: ${t4General.paidBreakMinutes}m), Cashier: ${t4Cashier.hours.toFixed(2)} hrs (paid: ${t4Cashier.paidBreakMinutes}m)`,
    passed: t4General.hours === 12.0 && t4General.paidBreakMinutes === 60 && t4Cashier.hours === 12.0 && t4Cashier.paidBreakMinutes === 40,
    category: 'Shift Hours',
  });

  // Test 5: Overnight shift crossing midnight (22:00 to 06:00 with 30 min break)
  const t5 = calculateShiftHours('22:00', '06:00', 30, false);
  tests.push({
    name: 'Overnight shift crossing midnight (22:00 - 06:00, 8.0h raw, 30m paid break)',
    expected: '8.00 hrs (overnight: true, paid: 30m)',
    actual: `${t5.hours.toFixed(2)} hrs (overnight: ${t5.isOvernight}, paid: ${t5.paidBreakMinutes}m)`,
    passed: t5.hours === 8.0 && t5.isOvernight && t5.paidBreakMinutes === 30,
    category: 'Overnight',
  });

  // Test 6: FLSA Overtime Split (46 total hours scheduled)
  const mockShifts: Shift[] = [
    { id: '1', scheduleId: 's', employeeId: 'e', employeeName: 'n', date: '2026-11-06', dayOfWeek: 'Friday', startTime: '08:00', endTime: '18:00', breakMinutes: 60, hours: 9, isOvernight: false },
    { id: '2', scheduleId: 's', employeeId: 'e', employeeName: 'n', date: '2026-11-07', dayOfWeek: 'Saturday', startTime: '08:00', endTime: '18:00', breakMinutes: 60, hours: 9, isOvernight: false },
    { id: '3', scheduleId: 's', employeeId: 'e', employeeName: 'n', date: '2026-11-08', dayOfWeek: 'Sunday', startTime: '08:00', endTime: '18:00', breakMinutes: 60, hours: 9, isOvernight: false },
    { id: '4', scheduleId: 's', employeeId: 'e', employeeName: 'n', date: '2026-11-09', dayOfWeek: 'Monday', startTime: '08:00', endTime: '18:00', breakMinutes: 60, hours: 9, isOvernight: false },
    { id: '5', scheduleId: 's', employeeId: 'e', employeeName: 'n', date: '2026-11-10', dayOfWeek: 'Tuesday', startTime: '08:00', endTime: '19:00', breakMinutes: 60, hours: 10, isOvernight: false },
  ];
  const weeklySummary = calculateWeeklyHoursSummary(mockShifts);
  tests.push({
    name: 'Weekly Overtime Split (46 scheduled hours)',
    expected: '40 reg hrs, 6 OT hrs',
    actual: `${weeklySummary.regularHours} reg hrs, ${weeklySummary.overtimeHours} OT hrs`,
    passed: weeklySummary.regularHours === 40 && weeklySummary.overtimeHours === 6 && weeklySummary.totalHours === 46,
    category: 'Overtime',
  });

  // Test 5: Overtime Pay calculation ($18.00 base -> OT rate $27.00)
  const mockSettings: StoreSettings = {
    id: 'store_settings',
    storeName: 'MANAGEMENT OF CULMORE',
    storeNameKo: 'MANAGEMENT OF CULMORE',
    address: '4210 John Marr Dr',
    city: 'Annandale',
    state: 'VA',
    zipCode: '22003',
    phone: '(703) 555-0199',
    ein: '54-1928374',
    federalTaxDefaultRate: 10.0,
    vaTaxDefaultRate: 5.0,
    socialSecurityRate: 6.20,
    medicareRate: 1.45,
    overtimeMultiplier: 1.5,
    defaultBreakMinutes: 30,
    workWeekStartDay: 'Friday',
  };

  const payCalc = calculatePayroll({
    hourlyWage: 18.00,
    regularHours: 40,
    overtimeHours: 6,
    settings: mockSettings,
  });

  tests.push({
    name: 'Gross Pay calculation (40h @ $18 + 6h @ $27)',
    expected: '$720.00 reg + $162.00 OT = $882.00 gross',
    actual: `$${payCalc.regularPay.toFixed(2)} reg + $${payCalc.overtimePay.toFixed(2)} OT = $${payCalc.grossPay.toFixed(2)} gross`,
    passed: payCalc.regularPay === 720.00 && payCalc.overtimePay === 162.00 && payCalc.grossPay === 882.00,
    category: 'Overtime',
  });

  // Test 6: FICA Statutory Taxes (Social Security 6.20% on $882.00 = $54.68, Medicare 1.45% = $12.79)
  const expectedSS = Math.round(882 * 0.062 * 100) / 100; // 54.68
  const expectedMed = Math.round(882 * 0.0145 * 100) / 100; // 12.79
  tests.push({
    name: 'FICA Statutory Taxes on $882.00 gross',
    expected: `SS: $${expectedSS.toFixed(2)}, Med: $${expectedMed.toFixed(2)}`,
    actual: `SS: $${payCalc.socialSecurityTax.toFixed(2)}, Med: $${payCalc.medicareTax.toFixed(2)}`,
    passed: payCalc.socialSecurityTax === expectedSS && payCalc.medicareTax === expectedMed,
    category: 'FICA Taxes',
  });

  // Test 7: Virginia state withholding (5.0% on $882.00 = $44.10)
  tests.push({
    name: 'Virginia State Withholding (5.0% on $882.00)',
    expected: '$44.10',
    actual: `$${payCalc.vaWithholding.toFixed(2)}`,
    passed: payCalc.vaWithholding === 44.10,
    category: 'Net Pay',
  });

  // Test 8: Net Pay reconciliation
  // Gross: 882.00, Fed: 88.20, VA: 44.10, SS: 54.68, Med: 12.79 -> Total tax = 199.77 -> Net = 682.23
  const expectedNet = Math.round((882.00 - 199.77) * 100) / 100;
  tests.push({
    name: 'Net Pay Reconciliation ($882.00 - $199.77 taxes)',
    expected: `$${expectedNet.toFixed(2)}`,
    actual: `$${payCalc.netPay.toFixed(2)}`,
    passed: payCalc.netPay === expectedNet,
    category: 'Net Pay',
  });

  return tests;
}
