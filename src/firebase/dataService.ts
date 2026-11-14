import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from './config';
import {
  Employee,
  Shift,
  WeeklySchedule,
  PayrollPeriod,
  PayrollRecord,
  StoreSettings,
  AuditLog,
  Administrator,
  PayrollAdjustment,
  PaymentMethod,
} from '../types';
import { AdminRole } from '../types';
import { INITIAL_STORE_SETTINGS, SAMPLE_EMPLOYEES } from '../utils/demoData';
import { getWorkWeekFriday, getDaysInWorkWeek } from '../utils/dateUtils';
import { calculatePayroll, calculateWeeklyHoursSummary } from '../utils/calculations';

// Local storage keys for demo mode persistence
const DEMO_EMPLOYEES_KEY = 'hanaro_demo_employees';
const DEMO_SHIFTS_KEY = 'hanaro_demo_shifts';
const DEMO_PAYROLL_PERIODS_KEY = 'hanaro_demo_payroll_periods';
const DEMO_PAYROLL_RECORDS_KEY = 'hanaro_demo_payroll_records';
const DEMO_SETTINGS_KEY = 'hanaro_demo_settings';
const DEMO_AUDIT_KEY = 'hanaro_demo_audit';
const DEMO_ADMINS_KEY = 'hanaro_demo_admins';

// Helper to log audit actions
export async function logAudit(
  isDemo: boolean,
  action: string,
  entity: 'EMPLOYEE' | 'SCHEDULE' | 'PAYROLL' | 'SETTINGS' | 'ADMIN',
  entityId: string,
  details: string
): Promise<void> {
  const adminEmail = auth.currentUser?.email || (isDemo ? 'demo.admin@hanaromarket.com' : 'admin@hanaromarket.com');
  const adminName = auth.currentUser?.displayName || 'Store Administrator';
  const timestamp = new Date().toISOString();

  const auditEntry: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    entity,
    entityId,
    details,
    performedBy: adminName,
    performedByEmail: adminEmail,
    timestamp,
  };

  if (isDemo) {
    const existing: AuditLog[] = JSON.parse(localStorage.getItem(DEMO_AUDIT_KEY) || '[]');
    localStorage.setItem(DEMO_AUDIT_KEY, JSON.stringify([auditEntry, ...existing].slice(0, 100)));
    return;
  }

  try {
    await setDoc(doc(db, 'auditLogs', auditEntry.id), auditEntry);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// ---------------- EMPLOYEES ----------------
export async function fetchEmployees(isDemo: boolean): Promise<Employee[]> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_EMPLOYEES_KEY);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    // Default to empty array so users can start fresh or click 'Seed'
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify([]));
    return [];
  }

  try {
    const snap = await getDocs(collection(db, 'employees'));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Employee));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'employees');
  }
}

export async function saveEmployeeRecord(isDemo: boolean, employee: Employee): Promise<void> {
  if (isDemo) {
    const list = await fetchEmployees(true);
    const existingIndex = list.findIndex(e => e.id === employee.id || e.employeeId === employee.employeeId);
    let updated: Employee[];
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = { ...employee, updatedAt: new Date().toISOString() };
    } else {
      updated = [{ ...employee, id: employee.id || `emp_${Date.now()}`, createdAt: new Date().toISOString() }, ...list];
    }
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(updated));
    await logAudit(true, existingIndex >= 0 ? 'UPDATE_EMPLOYEE' : 'CREATE_EMPLOYEE', 'EMPLOYEE', employee.employeeId, `Saved employee ${employee.fullName} (${employee.employeeId})`);
    return;
  }

  const docId = employee.id || `emp_${employee.employeeId}`;
  const rawPayload: Employee = {
    ...employee,
    id: docId,
    updatedAt: new Date().toISOString(),
    createdAt: employee.createdAt || new Date().toISOString(),
  };
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([, v]) => v !== undefined)
  );

  try {
    await setDoc(doc(db, 'employees', docId), payload);
    await logAudit(false, employee.id ? 'UPDATE_EMPLOYEE' : 'CREATE_EMPLOYEE', 'EMPLOYEE', employee.employeeId, `Saved employee ${employee.fullName} ($${employee.hourlyWage}/hr)`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `employees/${docId}`);
  }
}

export async function archiveEmployeeRecord(isDemo: boolean, employeeId: string, active: boolean): Promise<void> {
  if (isDemo) {
    const list = await fetchEmployees(true);
    const target = list.find(e => e.id === employeeId || e.employeeId === employeeId);
    const targetEmpId = target?.employeeId || employeeId;
    const updated = list.map(e => e.id === employeeId || e.employeeId === employeeId ? { ...e, active } : e);
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(updated));

    // If deactivated, purge from open (non-finalized) payroll records
    if (!active) {
      const payRecs: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
      const periods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
      const openPeriodIds = new Set(periods.filter(p => p.status !== 'finalized').map(p => p.id));
      const filtered = payRecs.filter(r => !(openPeriodIds.has(r.periodId) && (r.employeeId === targetEmpId || r.employeeId === employeeId)));
      localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(filtered));
    }

    await logAudit(true, active ? 'REACTIVATE_EMPLOYEE' : 'ARCHIVE_EMPLOYEE', 'EMPLOYEE', employeeId, `Toggled active status to ${active}`);
    return;
  }

  try {
    const ref = doc(db, 'employees', employeeId);
    await updateDoc(ref, { active, updatedAt: new Date().toISOString() });

    // If deactivated, purge from open payroll records in Firestore
    if (!active) {
      const empSnap = await getDoc(ref);
      const targetEmpId = empSnap.exists() ? (empSnap.data() as Employee).employeeId : employeeId;
      const openPeriodsSnap = await getDocs(query(collection(db, 'payrollPeriods'), where('status', '!=', 'finalized')));
      for (const pDoc of openPeriodsSnap.docs) {
        const recSnap = await getDocs(
          query(collection(db, 'payrollRecords'), where('periodId', '==', pDoc.id), where('employeeId', '==', targetEmpId))
        );
        for (const r of recSnap.docs) {
          await deleteDoc(r.ref);
        }
      }
    }

    await logAudit(false, active ? 'REACTIVATE_EMPLOYEE' : 'ARCHIVE_EMPLOYEE', 'EMPLOYEE', employeeId, `Toggled active status to ${active}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `employees/${employeeId}`);
  }
}

export async function deleteEmployeeRecord(isDemo: boolean, employeeId: string): Promise<void> {
  if (isDemo) {
    const list = await fetchEmployees(true);
    const target = list.find(e => e.id === employeeId || e.employeeId === employeeId);
    const targetEmpId = target?.employeeId || employeeId;
    const updated = list.filter(e => e.id !== employeeId && e.employeeId !== employeeId);
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify(updated));

    // Remove shifts for this employee
    const shifts: Shift[] = JSON.parse(localStorage.getItem(DEMO_SHIFTS_KEY) || '[]');
    const updatedShifts = shifts.filter(s => s.employeeId !== targetEmpId && s.employeeId !== employeeId);
    localStorage.setItem(DEMO_SHIFTS_KEY, JSON.stringify(updatedShifts));

    // Remove all payroll records for this employee
    const payRecs: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    const updatedPayRecs = payRecs.filter(r => r.employeeId !== targetEmpId && r.employeeId !== employeeId);
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(updatedPayRecs));

    await logAudit(true, 'DELETE_EMPLOYEE', 'EMPLOYEE', employeeId, `Permanently deleted employee ${target?.fullName || employeeId}`);
    return;
  }

  try {
    const empDoc = await getDoc(doc(db, 'employees', employeeId));
    const empData = empDoc.exists() ? (empDoc.data() as Employee) : null;
    const targetEmpId = empData?.employeeId || employeeId;

    await deleteDoc(doc(db, 'employees', employeeId));

    // Clean up shifts
    const schedulesSnap = await getDocs(collection(db, 'schedules'));
    for (const schedDoc of schedulesSnap.docs) {
      const shiftsSnap = await getDocs(
        query(collection(db, 'schedules', schedDoc.id, 'shifts'), where('employeeId', '==', targetEmpId))
      );
      for (const s of shiftsSnap.docs) {
        await deleteDoc(s.ref);
      }
    }

    // Clean up payroll records
    const paySnap = await getDocs(
      query(collection(db, 'payrollRecords'), where('employeeId', '==', targetEmpId))
    );
    for (const p of paySnap.docs) {
      await deleteDoc(p.ref);
    }

    await logAudit(false, 'DELETE_EMPLOYEE', 'EMPLOYEE', employeeId, `Permanently deleted employee ${empData?.fullName || employeeId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `employees/${employeeId}`);
  }
}

export async function deleteAllEmployees(isDemo: boolean): Promise<void> {
  if (isDemo) {
    localStorage.setItem(DEMO_EMPLOYEES_KEY, JSON.stringify([]));
    localStorage.setItem(DEMO_SHIFTS_KEY, JSON.stringify([]));
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify([]));
    await logAudit(true, 'DELETE_ALL_EMPLOYEES', 'EMPLOYEE', 'ALL', 'Cleared all employees, shifts, and payroll records.');
    return;
  }

  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    for (const d of empSnap.docs) {
      await deleteDoc(d.ref);
    }

    const schedulesSnap = await getDocs(collection(db, 'schedules'));
    for (const schedDoc of schedulesSnap.docs) {
      const shiftsSnap = await getDocs(collection(db, 'schedules', schedDoc.id, 'shifts'));
      for (const s of shiftsSnap.docs) {
        await deleteDoc(s.ref);
      }
    }

    const paySnap = await getDocs(collection(db, 'payrollRecords'));
    for (const p of paySnap.docs) {
      await deleteDoc(p.ref);
    }

    await logAudit(false, 'DELETE_ALL_EMPLOYEES', 'EMPLOYEE', 'ALL', 'Cleared all employees, shifts, and payroll records.');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'employees');
  }
}

// ---------------- SEED 25 SAMPLE EMPLOYEES TO FIRESTORE ----------------
export async function seed25SampleEmployeesToFirestore(): Promise<number> {
  let count = 0;
  for (const emp of SAMPLE_EMPLOYEES) {
    const docId = `emp_${emp.employeeId}`;
    try {
      await setDoc(doc(db, 'employees', docId), {
        ...emp,
        id: docId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      count++;
    } catch (err) {
      console.error(`Failed to seed ${emp.employeeId}:`, err);
    }
  }

  // Also seed initial store settings if not exist
  try {
    await setDoc(doc(db, 'settings', 'store_settings'), INITIAL_STORE_SETTINGS);
  } catch (err) {
    console.error('Failed to seed settings:', err);
  }

  await logAudit(false, 'SEED_SAMPLE_EMPLOYEES', 'EMPLOYEE', 'ALL', `Batch seeded ${count} sample grocery store employees.`);
  return count;
}

// ---------------- SHIFTS & SCHEDULES ----------------
export async function fetchShiftsForWeek(isDemo: boolean, fridayYmd: string): Promise<Shift[]> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_SHIFTS_KEY);
    const allShifts: Shift[] = saved ? JSON.parse(saved) : [];
    return allShifts.filter(s => s.scheduleId === fridayYmd);
  }

  try {
    const shiftsRef = collection(db, 'schedules', fridayYmd, 'shifts');
    const snap = await getDocs(shiftsRef);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as Shift));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `schedules/${fridayYmd}/shifts`);
  }
}

export async function saveShiftRecord(isDemo: boolean, fridayYmd: string, shift: Shift): Promise<void> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_SHIFTS_KEY);
    let allShifts: Shift[] = saved ? JSON.parse(saved) : [];
    const index = allShifts.findIndex(s => s.id === shift.id || (s.scheduleId === fridayYmd && s.employeeId === shift.employeeId && s.date === shift.date));
    if (index >= 0) {
      allShifts[index] = { ...shift, updatedAt: new Date().toISOString() };
    } else {
      allShifts.push({ ...shift, scheduleId: fridayYmd, createdAt: new Date().toISOString() });
    }
    localStorage.setItem(DEMO_SHIFTS_KEY, JSON.stringify(allShifts));
    return;
  }

  const shiftDocId = shift.id || `shift_${shift.employeeId}_${shift.date}`;
  const rawPayload: Shift = {
    ...shift,
    id: shiftDocId,
    scheduleId: fridayYmd,
    updatedAt: new Date().toISOString(),
    createdAt: shift.createdAt || new Date().toISOString(),
  };
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([, v]) => v !== undefined)
  );

  try {
    // Ensure schedule doc exists
    await setDoc(doc(db, 'schedules', fridayYmd), {
      weekStartDate: fridayYmd,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    }, { merge: true });

    await setDoc(doc(db, 'schedules', fridayYmd, 'shifts', shiftDocId), payload);
    await logAudit(false, 'SAVE_SHIFT', 'SCHEDULE', shiftDocId, `Shift ${shift.startTime}-${shift.endTime} for ${shift.employeeName} on ${shift.date}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schedules/${fridayYmd}/shifts/${shiftDocId}`);
  }
}

export async function deleteShiftRecord(isDemo: boolean, fridayYmd: string, shiftId: string): Promise<void> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_SHIFTS_KEY);
    let allShifts: Shift[] = saved ? JSON.parse(saved) : [];
    allShifts = allShifts.filter(s => s.id !== shiftId);
    localStorage.setItem(DEMO_SHIFTS_KEY, JSON.stringify(allShifts));
    return;
  }

  try {
    await deleteDoc(doc(db, 'schedules', fridayYmd, 'shifts', shiftId));
    await logAudit(false, 'DELETE_SHIFT', 'SCHEDULE', shiftId, `Deleted shift ${shiftId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schedules/${fridayYmd}/shifts/${shiftId}`);
  }
}

export interface CopyScheduleOptions {
  department?: string; // 'ALL' or specific
  mode?: 'merge' | 'overwrite'; // 'merge' doesn't replace existing days; 'overwrite' replaces all target shifts
}

export async function copyShiftsFromWeek(
  isDemo: boolean,
  sourceFridayYmd: string,
  targetFridayYmd: string,
  options?: CopyScheduleOptions
): Promise<number> {
  const rawSourceShifts = await fetchShiftsForWeek(isDemo, sourceFridayYmd);
  const allEmployees = await fetchEmployees(isDemo);
  const activeEmpIds = new Set(allEmployees.filter(e => e.active).map(e => e.employeeId));
  const sourceShifts = rawSourceShifts.filter(s => activeEmpIds.has(s.employeeId));
  if (sourceShifts.length === 0) return 0;

  const mode = options?.mode || 'merge';
  const targetShifts = await fetchShiftsForWeek(isDemo, targetFridayYmd);

  // If overwrite mode, remove existing target shifts first
  if (mode === 'overwrite' && targetShifts.length > 0) {
    for (const ts of targetShifts) {
      await deleteShiftRecord(isDemo, targetFridayYmd, ts.id);
    }
  }

  const sourceDays = getDaysInWorkWeek(sourceFridayYmd);
  const targetDays = getDaysInWorkWeek(targetFridayYmd);

  let copied = 0;
  for (const s of sourceShifts) {
    // Find matching day index (0 to 6)
    const dayIdx = sourceDays.findIndex(d => d.date === s.date);
    if (dayIdx >= 0 && targetDays[dayIdx]) {
      const targetDate = targetDays[dayIdx].date;

      // In merge mode, don't overwrite if employee already has shift on this day
      if (mode === 'merge') {
        const alreadyExists = targetShifts.some(
          ts => ts.employeeId === s.employeeId && ts.date === targetDate
        );
        if (alreadyExists) continue;
      }

      const newShift: Shift = {
        ...s,
        id: `shift_${targetFridayYmd}_${s.employeeId}_${targetDate}`,
        scheduleId: targetFridayYmd,
        date: targetDate,
        dayOfWeek: targetDays[dayIdx].dayOfWeek,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveShiftRecord(isDemo, targetFridayYmd, newShift);
      copied++;
    }
  }

  await logAudit(
    isDemo,
    'COPY_WEEK_SCHEDULE',
    'SCHEDULE',
    targetFridayYmd,
    `Copied ${copied} shifts from ${sourceFridayYmd} to ${targetFridayYmd} (mode: ${mode})`
  );
  return copied;
}

// ---------------- PAYROLL ----------------
export async function fetchPayrollPeriod(isDemo: boolean, periodId: string): Promise<PayrollPeriod | null> {
  if (isDemo) {
    const saved: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    return saved.find(p => p.id === periodId) || null;
  }

  try {
    const snap = await getDoc(doc(db, 'payrollPeriods', periodId));
    if (snap.exists()) {
      return snap.data() as PayrollPeriod;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `payrollPeriods/${periodId}`);
  }
}

export async function fetchAllPayrollPeriods(isDemo: boolean): Promise<PayrollPeriod[]> {
  if (isDemo) {
    const saved: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    return saved.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }

  try {
    const q = query(collection(db, 'payrollPeriods'), orderBy('weekStartDate', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => ({ ...d.data(), id: d.id } as PayrollPeriod));
    }
    const allSnap = await getDocs(collection(db, 'payrollPeriods'));
    const list = allSnap.docs.map((d) => ({ ...d.data(), id: d.id } as PayrollPeriod));
    return list.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  } catch (error) {
    try {
      const allSnap = await getDocs(collection(db, 'payrollPeriods'));
      const list = allSnap.docs.map((d) => ({ ...d.data(), id: d.id } as PayrollPeriod));
      return list.sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
    } catch {
      return [];
    }
  }
}

export async function fetchPayrollRecords(isDemo: boolean, periodId: string): Promise<PayrollRecord[]> {
  if (isDemo) {
    const saved: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    return saved.filter(r => r.periodId === periodId);
  }

  try {
    const q = query(collection(db, 'payrollRecords'), where('periodId', '==', periodId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as PayrollRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `payrollRecords?periodId=${periodId}`);
  }
}

export async function generateWeeklyPayroll(
  isDemo: boolean,
  fridayYmd: string,
  employees: Employee[],
  shifts: Shift[],
  settings: StoreSettings
): Promise<{ period: PayrollPeriod; records: PayrollRecord[] }> {
  const periodId = `period_${fridayYmd}`;
  const days = getDaysInWorkWeek(fridayYmd);
  const weekEndDate = days[6].date;

  // Retrieve existing records for period to preserve manual tax overrides & cash/check settings
  let existingRecords: PayrollRecord[] = [];
  if (isDemo) {
    try {
      const all: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
      existingRecords = all.filter((r) => r.periodId === periodId);
    } catch {
      existingRecords = [];
    }
  } else {
    try {
      existingRecords = await fetchPayrollRecords(false, periodId);
    } catch {
      existingRecords = [];
    }
  }

  const records: PayrollRecord[] = [];
  let sumRegHours = 0;
  let sumOtHours = 0;
  let sumGross = 0;
  let sumTaxes = 0;
  let sumDeductions = 0;
  let sumNet = 0;

  for (const emp of employees) {
    // Only active employees who worked or have adjustments belong in the payroll period
    if (!emp.active) continue;

    const empShifts = shifts.filter((s) => s.employeeId === emp.employeeId);
    const hoursSummary = calculateWeeklyHoursSummary(empShifts);
    const existingRec = existingRecords.find((r) => r.employeeId === emp.employeeId);
    const hasAdjustments = !!(existingRec?.adjustments && existingRec.adjustments.length > 0);

    // Skip employees who did not work during this workweek (0 hours and no registered adjustments)
    if (hoursSummary.totalHours === 0 && !hasAdjustments) {
      continue;
    }

    const calc = calculatePayroll({
      hourlyWage: emp.hourlyWage,
      regularHours: hoursSummary.regularHours,
      overtimeHours: hoursSummary.overtimeHours,
      settings,
      adjustments: existingRec?.adjustments || [],
      withholdFederal: emp.withholdFederal,
      withholdVirginia: emp.withholdVirginia,
      withholdSocialSecurity: emp.withholdSocialSecurity,
      withholdMedicare: emp.withholdMedicare,
      customFederalRate: emp.customFederalRate,
      customVaRate: emp.customVaRate,
    });

    const isManualTax = existingRec?.isManualTax || false;
    const fed = isManualTax ? (existingRec?.manualFederalWithholding ?? calc.federalWithholding) : calc.federalWithholding;
    const va = isManualTax ? (existingRec?.manualVaWithholding ?? calc.vaWithholding) : calc.vaWithholding;
    const ss = isManualTax ? (existingRec?.manualSocialSecurityTax ?? calc.socialSecurityTax) : calc.socialSecurityTax;
    const med = isManualTax ? (existingRec?.manualMedicareTax ?? calc.medicareTax) : calc.medicareTax;
    const totalTaxes = isManualTax ? Math.round((fed + va + ss + med) * 100) / 100 : calc.totalTaxes;
    const nonTaxDeductions = (calc.insuranceDeduction || 0) + (calc.otherDeductions || 0);
    const totalDeductions = Math.round((totalTaxes + nonTaxDeductions) * 100) / 100;
    const netPay = Math.max(0, Math.round((calc.grossPay - totalDeductions) * 100) / 100);

    const paymentMethod: PaymentMethod = existingRec?.paymentMethod || 'ALL_CHECK';
    let taxableHours = existingRec?.taxableHours !== undefined ? existingRec.taxableHours : hoursSummary.totalHours;
    let cashHours = existingRec?.cashHours !== undefined ? existingRec.cashHours : Math.max(0, hoursSummary.totalHours - taxableHours);

    let checkAmount = netPay;
    let cashAmount = 0;

    if (paymentMethod === 'ALL_CASH') {
      cashAmount = netPay;
      checkAmount = 0;
      taxableHours = 0;
      cashHours = hoursSummary.totalHours;
    } else if (paymentMethod === 'ALL_CHECK') {
      checkAmount = netPay;
      cashAmount = 0;
      taxableHours = hoursSummary.totalHours;
      cashHours = 0;
    } else if (paymentMethod === 'SPLIT') {
      if (existingRec?.checkAmount !== undefined && existingRec?.cashAmount !== undefined) {
        checkAmount = existingRec.checkAmount;
        cashAmount = existingRec.cashAmount;
      } else {
        const taxableGross = Math.round(taxableHours * emp.hourlyWage * 100) / 100;
        checkAmount = Math.max(0, Math.round((taxableGross - totalTaxes) * 100) / 100);
        cashAmount = Math.max(0, Math.round((netPay - checkAmount) * 100) / 100);
      }
    }

    sumRegHours += hoursSummary.regularHours;
    sumOtHours += hoursSummary.overtimeHours;
    sumGross += calc.grossPay;
    sumTaxes += totalTaxes;
    sumDeductions += totalDeductions;
    sumNet += netPay;

    const record: PayrollRecord = {
      id: `pay_${fridayYmd}_${emp.employeeId}`,
      periodId,
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      position: emp.position,
      department: emp.department,
      businessGroup: emp.businessGroup,
      groupNumber: emp.groupNumber,
      hourlyWage: emp.hourlyWage,
      regularHours: hoursSummary.regularHours,
      overtimeHours: hoursSummary.overtimeHours,
      regularPay: calc.regularPay,
      overtimePay: calc.overtimePay,
      grossPay: calc.grossPay,
      federalWithholding: fed,
      vaWithholding: va,
      socialSecurityTax: ss,
      medicareTax: med,
      totalTaxes,
      insuranceDeduction: calc.insuranceDeduction,
      otherDeductions: calc.otherDeductions,
      totalDeductions,
      netPay,
      withholdFederal: calc.withholdFederal,
      withholdVirginia: calc.withholdVirginia,
      withholdSocialSecurity: calc.withholdSocialSecurity,
      withholdMedicare: calc.withholdMedicare,
      paymentMethod,
      taxableHours,
      cashHours,
      checkAmount,
      cashAmount,
      isManualTax,
      manualFederalWithholding: existingRec?.manualFederalWithholding,
      manualVaWithholding: existingRec?.manualVaWithholding,
      manualSocialSecurityTax: existingRec?.manualSocialSecurityTax,
      manualMedicareTax: existingRec?.manualMedicareTax,
      notes: existingRec?.notes || '',
      isAdjusted: (existingRec?.adjustments && existingRec.adjustments.length > 0) || false,
      adjustments: existingRec?.adjustments || [],
      createdAt: existingRec?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.push(record);
  }

  const period: PayrollPeriod = {
    id: periodId,
    weekStartDate: fridayYmd,
    weekEndDate,
    status: 'draft',
    totalRegularHours: Math.round(sumRegHours * 100) / 100,
    totalOvertimeHours: Math.round(sumOtHours * 100) / 100,
    totalGrossPay: Math.round(sumGross * 100) / 100,
    totalTaxes: Math.round(sumTaxes * 100) / 100,
    totalDeductions: Math.round(sumDeductions * 100) / 100,
    totalNetPay: Math.round(sumNet * 100) / 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (isDemo) {
    const existingPeriods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    const existingRecords: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');

    const updatedPeriods = [period, ...existingPeriods.filter(p => p.id !== periodId)];
    const updatedRecords = [...records, ...existingRecords.filter(r => r.periodId !== periodId)];

    localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(updatedPeriods));
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(updatedRecords));

    await logAudit(true, 'GENERATE_PAYROLL', 'PAYROLL', periodId, `Generated payroll for ${records.length} employees (Gross: $${period.totalGrossPay})`);
    return { period, records };
  }

  try {
    // Save period
    await setDoc(doc(db, 'payrollPeriods', periodId), period);

    // Delete stale payroll records for this period that are no longer active/working
    const validIds = new Set(records.map((r) => r.id));
    for (const oldRec of existingRecords) {
      if (!validIds.has(oldRec.id)) {
        await deleteDoc(doc(db, 'payrollRecords', oldRec.id));
      }
    }

    // Save individual records (stripping undefined properties so Firestore never rejects)
    for (const rec of records) {
      const cleanRec = Object.fromEntries(
        Object.entries(rec).filter(([, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'payrollRecords', rec.id), cleanRec);
    }

    await logAudit(false, 'GENERATE_PAYROLL', 'PAYROLL', periodId, `Generated payroll for ${records.length} employees (Gross: $${period.totalGrossPay})`);
    return { period, records };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `payrollPeriods/${periodId}`);
  }
}

export async function finalizePayrollPeriod(isDemo: boolean, periodId: string): Promise<void> {
  const adminEmail = auth.currentUser?.email || (isDemo ? 'demo.admin@hanaromarket.com' : 'admin@hanaromarket.com');
  const now = new Date().toISOString();

  if (isDemo) {
    const existingPeriods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    const updated = existingPeriods.map(p => p.id === periodId ? { ...p, status: 'finalized' as const, finalizedAt: now, finalizedBy: adminEmail } : p);
    localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(updated));
    await logAudit(true, 'FINALIZE_PAYROLL', 'PAYROLL', periodId, `Locked and finalized payroll period by ${adminEmail}`);
    return;
  }

  try {
    await updateDoc(doc(db, 'payrollPeriods', periodId), {
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: adminEmail,
      updatedAt: now,
    });
    await logAudit(false, 'FINALIZE_PAYROLL', 'PAYROLL', periodId, `Locked and finalized payroll period by ${adminEmail}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollPeriods/${periodId}`);
  }
}

export async function reopenPayrollPeriod(isDemo: boolean, periodId: string, reason: string): Promise<void> {
  const adminEmail = auth.currentUser?.email || (isDemo ? 'demo.admin@hanaromarket.com' : 'admin@hanaromarket.com');
  const now = new Date().toISOString();

  if (isDemo) {
    const existingPeriods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    const updated = existingPeriods.map(p => p.id === periodId ? { ...p, status: 'pending_review' as const, reopenedAt: now, reopenedBy: adminEmail } : p);
    localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(updated));
    await logAudit(true, 'REOPEN_PAYROLL', 'PAYROLL', periodId, `Reopened finalized payroll period. Justification: "${reason}"`);
    return;
  }

  try {
    await updateDoc(doc(db, 'payrollPeriods', periodId), {
      status: 'pending_review',
      reopenedAt: now,
      reopenedBy: adminEmail,
      updatedAt: now,
    });
    await logAudit(false, 'REOPEN_PAYROLL', 'PAYROLL', periodId, `Reopened finalized payroll period. Justification: "${reason}"`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollPeriods/${periodId}`);
  }
}

export async function addPayrollAdjustment(
  isDemo: boolean,
  recordId: string,
  adjustment: PayrollAdjustment,
  settings: StoreSettings
): Promise<void> {
  if (isDemo) {
    const records: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    const idx = records.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      const rec = records[idx];
      const adjustments = [...(rec.adjustments || []), adjustment];
      const recalculated = calculatePayroll({
        hourlyWage: rec.hourlyWage,
        regularHours: rec.regularHours,
        overtimeHours: rec.overtimeHours,
        settings,
        insuranceDeduction: rec.insuranceDeduction,
        otherDeductions: rec.otherDeductions,
        adjustments,
        withholdFederal: rec.withholdFederal,
        withholdVirginia: rec.withholdVirginia,
        withholdSocialSecurity: rec.withholdSocialSecurity,
        withholdMedicare: rec.withholdMedicare,
      });

      records[idx] = {
        ...rec,
        grossPay: recalculated.grossPay,
        federalWithholding: recalculated.federalWithholding,
        vaWithholding: recalculated.vaWithholding,
        socialSecurityTax: recalculated.socialSecurityTax,
        medicareTax: recalculated.medicareTax,
        totalTaxes: recalculated.totalTaxes,
        totalDeductions: recalculated.totalDeductions,
        netPay: recalculated.netPay,
        isAdjusted: true,
        adjustments,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(records));
      await logAudit(true, 'PAYROLL_ADJUSTMENT', 'PAYROLL', recordId, `Adjusted by $${adjustment.amount}: ${adjustment.reason}`);
    }
    return;
  }

  try {
    const recRef = doc(db, 'payrollRecords', recordId);
    const snap = await getDoc(recRef);
    if (!snap.exists()) throw new Error('Record not found');

    const rec = snap.data() as PayrollRecord;
    const adjustments = [...(rec.adjustments || []), adjustment];
    const recalculated = calculatePayroll({
      hourlyWage: rec.hourlyWage,
      regularHours: rec.regularHours,
      overtimeHours: rec.overtimeHours,
      settings,
      insuranceDeduction: rec.insuranceDeduction,
      otherDeductions: rec.otherDeductions,
      adjustments,
      withholdFederal: rec.withholdFederal,
      withholdVirginia: rec.withholdVirginia,
      withholdSocialSecurity: rec.withholdSocialSecurity,
      withholdMedicare: rec.withholdMedicare,
    });

    await updateDoc(recRef, {
      grossPay: recalculated.grossPay,
      federalWithholding: recalculated.federalWithholding,
      vaWithholding: recalculated.vaWithholding,
      socialSecurityTax: recalculated.socialSecurityTax,
      medicareTax: recalculated.medicareTax,
      totalTaxes: recalculated.totalTaxes,
      totalDeductions: recalculated.totalDeductions,
      netPay: recalculated.netPay,
      isAdjusted: adjustments.length > 0,
      adjustments,
      updatedAt: new Date().toISOString(),
    });

    await logAudit(false, 'PAYROLL_ADJUSTMENT', 'PAYROLL', recordId, `Adjusted by $${adjustment.amount}: ${adjustment.reason}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollRecords/${recordId}`);
  }
}

export async function savePayrollRecordAdjustments(
  isDemo: boolean,
  recordId: string,
  adjustments: PayrollAdjustment[],
  settings: StoreSettings,
  auditNote?: string
): Promise<PayrollRecord> {
  if (isDemo) {
    const records: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    const idx = records.findIndex((r) => r.id === recordId);
    if (idx < 0) throw new Error('Record not found');

    const rec = records[idx];
    const recalculated = calculatePayroll({
      hourlyWage: rec.hourlyWage,
      regularHours: rec.regularHours,
      overtimeHours: rec.overtimeHours,
      settings,
      insuranceDeduction: rec.insuranceDeduction,
      otherDeductions: rec.otherDeductions,
      adjustments,
      withholdFederal: rec.withholdFederal,
      withholdVirginia: rec.withholdVirginia,
      withholdSocialSecurity: rec.withholdSocialSecurity,
      withholdMedicare: rec.withholdMedicare,
    });

    const updatedRec: PayrollRecord = {
      ...rec,
      grossPay: recalculated.grossPay,
      federalWithholding: recalculated.federalWithholding,
      vaWithholding: recalculated.vaWithholding,
      socialSecurityTax: recalculated.socialSecurityTax,
      medicareTax: recalculated.medicareTax,
      totalTaxes: recalculated.totalTaxes,
      totalDeductions: recalculated.totalDeductions,
      netPay: recalculated.netPay,
      isAdjusted: adjustments.length > 0,
      adjustments,
      updatedAt: new Date().toISOString(),
    };

    records[idx] = updatedRec;
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(records));

    // Update parent payroll period totals if exists
    if (rec.periodId) {
      const periods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
      const pIdx = periods.findIndex((p) => p.id === rec.periodId);
      if (pIdx >= 0) {
        const periodRecords = records.filter((r) => r.periodId === rec.periodId);
        periods[pIdx] = {
          ...periods[pIdx],
          totalGrossPay: Math.round(periodRecords.reduce((s, r) => s + r.grossPay, 0) * 100) / 100,
          totalTaxes: Math.round(periodRecords.reduce((s, r) => s + r.totalTaxes, 0) * 100) / 100,
          totalDeductions: Math.round(periodRecords.reduce((s, r) => s + r.totalDeductions, 0) * 100) / 100,
          totalNetPay: Math.round(periodRecords.reduce((s, r) => s + r.netPay, 0) * 100) / 100,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(periods));
      }
    }

    await logAudit(
      true,
      'UPDATE_ADJUSTMENTS',
      'PAYROLL',
      recordId,
      auditNote || `Updated adjustments (${adjustments.length} items registered for ${rec.employeeName})`
    );

    return updatedRec;
  }

  try {
    const recRef = doc(db, 'payrollRecords', recordId);
    const snap = await getDoc(recRef);
    if (!snap.exists()) throw new Error('Record not found');

    const rec = snap.data() as PayrollRecord;
    const recalculated = calculatePayroll({
      hourlyWage: rec.hourlyWage,
      regularHours: rec.regularHours,
      overtimeHours: rec.overtimeHours,
      settings,
      insuranceDeduction: rec.insuranceDeduction,
      otherDeductions: rec.otherDeductions,
      adjustments,
      withholdFederal: rec.withholdFederal,
      withholdVirginia: rec.withholdVirginia,
      withholdSocialSecurity: rec.withholdSocialSecurity,
      withholdMedicare: rec.withholdMedicare,
    });

    const payload = {
      grossPay: recalculated.grossPay,
      federalWithholding: recalculated.federalWithholding,
      vaWithholding: recalculated.vaWithholding,
      socialSecurityTax: recalculated.socialSecurityTax,
      medicareTax: recalculated.medicareTax,
      totalTaxes: recalculated.totalTaxes,
      totalDeductions: recalculated.totalDeductions,
      netPay: recalculated.netPay,
      isAdjusted: adjustments.length > 0,
      adjustments,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(recRef, payload);

    // Sync parent period totals in Firestore
    if (rec.periodId) {
      try {
        const q = query(collection(db, 'payrollRecords'), where('periodId', '==', rec.periodId));
        const qSnap = await getDocs(q);
        const allRecords = qSnap.docs.map((d) => (d.id === recordId ? { ...rec, ...payload } : (d.data() as PayrollRecord)));
        await updateDoc(doc(db, 'payrollPeriods', rec.periodId), {
          totalGrossPay: Math.round(allRecords.reduce((s, r) => s + (r.grossPay || 0), 0) * 100) / 100,
          totalTaxes: Math.round(allRecords.reduce((s, r) => s + (r.totalTaxes || 0), 0) * 100) / 100,
          totalDeductions: Math.round(allRecords.reduce((s, r) => s + (r.totalDeductions || 0), 0) * 100) / 100,
          totalNetPay: Math.round(allRecords.reduce((s, r) => s + (r.netPay || 0), 0) * 100) / 100,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not update period totals:', err);
      }
    }

    await logAudit(
      false,
      'UPDATE_ADJUSTMENTS',
      'PAYROLL',
      recordId,
      auditNote || `Updated adjustments (${adjustments.length} items registered for ${rec.employeeName})`
    );

    return { ...rec, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollRecords/${recordId}`);
    throw error;
  }
}

// ---------------- WITHHOLDING TAX SELECTION ----------------
export interface TaxWithholdingSelections {
  withholdFederal: boolean;
  withholdVirginia: boolean;
  withholdSocialSecurity: boolean;
  withholdMedicare: boolean;
}

export async function updatePayrollRecordTaxSelections(
  isDemo: boolean,
  recordId: string,
  taxSelections: TaxWithholdingSelections,
  settings: StoreSettings
): Promise<PayrollRecord> {
  if (isDemo) {
    const records: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    const idx = records.findIndex(r => r.id === recordId);
    if (idx < 0) throw new Error('Record not found');

    const rec = records[idx];
    const recalculated = calculatePayroll({
      hourlyWage: rec.hourlyWage,
      regularHours: rec.regularHours,
      overtimeHours: rec.overtimeHours,
      settings,
      insuranceDeduction: rec.insuranceDeduction,
      otherDeductions: rec.otherDeductions,
      adjustments: rec.adjustments,
      withholdFederal: taxSelections.withholdFederal,
      withholdVirginia: taxSelections.withholdVirginia,
      withholdSocialSecurity: taxSelections.withholdSocialSecurity,
      withholdMedicare: taxSelections.withholdMedicare,
    });

    const updatedRecord: PayrollRecord = {
      ...rec,
      federalWithholding: recalculated.federalWithholding,
      vaWithholding: recalculated.vaWithholding,
      socialSecurityTax: recalculated.socialSecurityTax,
      medicareTax: recalculated.medicareTax,
      totalTaxes: recalculated.totalTaxes,
      totalDeductions: recalculated.totalDeductions,
      netPay: recalculated.netPay,
      withholdFederal: taxSelections.withholdFederal,
      withholdVirginia: taxSelections.withholdVirginia,
      withholdSocialSecurity: taxSelections.withholdSocialSecurity,
      withholdMedicare: taxSelections.withholdMedicare,
      updatedAt: new Date().toISOString(),
    };

    records[idx] = updatedRecord;
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(records));

    // Update period totals
    const periodId = rec.periodId;
    const periodRecords = records.filter(r => r.periodId === periodId);
    const existingPeriods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
    const pIdx = existingPeriods.findIndex(p => p.id === periodId);
    if (pIdx >= 0) {
      existingPeriods[pIdx] = {
        ...existingPeriods[pIdx],
        totalTaxes: Math.round(periodRecords.reduce((s, r) => s + r.totalTaxes, 0) * 100) / 100,
        totalDeductions: Math.round(periodRecords.reduce((s, r) => s + r.totalDeductions, 0) * 100) / 100,
        totalNetPay: Math.round(periodRecords.reduce((s, r) => s + r.netPay, 0) * 100) / 100,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(existingPeriods));
    }

    await logAudit(true, 'UPDATE_TAX_WITHHOLDING', 'PAYROLL', recordId, `Updated tax withholding options for ${rec.employeeName}`);
    return updatedRecord;
  }

  try {
    const recRef = doc(db, 'payrollRecords', recordId);
    const snap = await getDoc(recRef);
    if (!snap.exists()) throw new Error('Record not found');

    const rec = snap.data() as PayrollRecord;
    const recalculated = calculatePayroll({
      hourlyWage: rec.hourlyWage,
      regularHours: rec.regularHours,
      overtimeHours: rec.overtimeHours,
      settings,
      insuranceDeduction: rec.insuranceDeduction,
      otherDeductions: rec.otherDeductions,
      adjustments: rec.adjustments,
      withholdFederal: taxSelections.withholdFederal,
      withholdVirginia: taxSelections.withholdVirginia,
      withholdSocialSecurity: taxSelections.withholdSocialSecurity,
      withholdMedicare: taxSelections.withholdMedicare,
    });

    const updatedPayload = {
      federalWithholding: recalculated.federalWithholding,
      vaWithholding: recalculated.vaWithholding,
      socialSecurityTax: recalculated.socialSecurityTax,
      medicareTax: recalculated.medicareTax,
      totalTaxes: recalculated.totalTaxes,
      totalDeductions: recalculated.totalDeductions,
      netPay: recalculated.netPay,
      withholdFederal: taxSelections.withholdFederal,
      withholdVirginia: taxSelections.withholdVirginia,
      withholdSocialSecurity: taxSelections.withholdSocialSecurity,
      withholdMedicare: taxSelections.withholdMedicare,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(recRef, updatedPayload);

    // Update period totals
    const allPeriodRecords = await fetchPayrollRecords(false, rec.periodId);
    const periodRef = doc(db, 'payrollPeriods', rec.periodId);
    await updateDoc(periodRef, {
      totalTaxes: Math.round(allPeriodRecords.reduce((s, r) => s + r.totalTaxes, 0) * 100) / 100,
      totalDeductions: Math.round(allPeriodRecords.reduce((s, r) => s + r.totalDeductions, 0) * 100) / 100,
      totalNetPay: Math.round(allPeriodRecords.reduce((s, r) => s + r.netPay, 0) * 100) / 100,
      updatedAt: new Date().toISOString(),
    });

    await logAudit(false, 'UPDATE_TAX_WITHHOLDING', 'PAYROLL', recordId, `Updated tax withholding options for ${rec.employeeName}`);
    return { ...rec, ...updatedPayload };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollRecords/${recordId}`);
  }
}

export async function batchUpdatePayrollTaxSelections(
  isDemo: boolean,
  periodId: string,
  taxSelections: TaxWithholdingSelections,
  settings: StoreSettings
): Promise<PayrollRecord[]> {
  const records = await fetchPayrollRecords(isDemo, periodId);
  const updatedRecords: PayrollRecord[] = [];

  for (const rec of records) {
    const updated = await updatePayrollRecordTaxSelections(isDemo, rec.id, taxSelections, settings);
    updatedRecords.push(updated);
  }

  await logAudit(
    isDemo,
    'BATCH_UPDATE_TAX_WITHHOLDING',
    'PAYROLL',
    periodId,
    `Batch updated tax withholdings for ${updatedRecords.length} records in ${periodId}`
  );
  return updatedRecords;
}

// ---------------- PAYMENT METHOD & MANUAL TAX OVERRIDE ----------------
export interface PaymentAndTaxUpdates {
  paymentMethod?: PaymentMethod;
  taxableHours?: number;
  cashHours?: number;
  checkAmount?: number;
  cashAmount?: number;
  isManualTax?: boolean;
  manualFederalWithholding?: number;
  manualVaWithholding?: number;
  manualSocialSecurityTax?: number;
  manualMedicareTax?: number;
  notes?: string;
}

export async function savePayrollRecordPaymentAndTaxes(
  isDemo: boolean,
  recordId: string,
  updates: PaymentAndTaxUpdates,
  settings: StoreSettings
): Promise<PayrollRecord> {
  if (isDemo) {
    const records: PayrollRecord[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_RECORDS_KEY) || '[]');
    const idx = records.findIndex((r) => r.id === recordId);
    if (idx < 0) throw new Error('Record not found');

    const rec = records[idx];

    let fed = rec.federalWithholding;
    let va = rec.vaWithholding;
    let ss = rec.socialSecurityTax;
    let med = rec.medicareTax;
    let totalTaxes = rec.totalTaxes;

    if (updates.isManualTax) {
      fed = updates.manualFederalWithholding !== undefined ? updates.manualFederalWithholding : rec.federalWithholding;
      va = updates.manualVaWithholding !== undefined ? updates.manualVaWithholding : rec.vaWithholding;
      ss = updates.manualSocialSecurityTax !== undefined ? updates.manualSocialSecurityTax : rec.socialSecurityTax;
      med = updates.manualMedicareTax !== undefined ? updates.manualMedicareTax : rec.medicareTax;
      totalTaxes = Math.round((fed + va + ss + med) * 100) / 100;
    } else {
      const recalculated = calculatePayroll({
        hourlyWage: rec.hourlyWage,
        regularHours: rec.regularHours,
        overtimeHours: rec.overtimeHours,
        settings,
        insuranceDeduction: rec.insuranceDeduction,
        otherDeductions: rec.otherDeductions,
        adjustments: rec.adjustments,
        withholdFederal: rec.withholdFederal,
        withholdVirginia: rec.withholdVirginia,
        withholdSocialSecurity: rec.withholdSocialSecurity,
        withholdMedicare: rec.withholdMedicare,
      });
      fed = recalculated.federalWithholding;
      va = recalculated.vaWithholding;
      ss = recalculated.socialSecurityTax;
      med = recalculated.medicareTax;
      totalTaxes = recalculated.totalTaxes;
    }

    const nonTaxDeductions = (rec.insuranceDeduction || 0) + (rec.otherDeductions || 0);
    const totalDeductions = Math.round((totalTaxes + nonTaxDeductions) * 100) / 100;
    const netPay = Math.max(0, Math.round((rec.grossPay - totalDeductions) * 100) / 100);

    let checkAmount = netPay;
    let cashAmount = 0;

    if (updates.paymentMethod === 'ALL_CASH') {
      cashAmount = netPay;
      checkAmount = 0;
    } else if (updates.paymentMethod === 'ALL_CHECK') {
      checkAmount = netPay;
      cashAmount = 0;
    } else if (updates.paymentMethod === 'SPLIT') {
      checkAmount = updates.checkAmount !== undefined ? updates.checkAmount : (rec.checkAmount ?? netPay);
      cashAmount = updates.cashAmount !== undefined ? updates.cashAmount : (rec.cashAmount ?? 0);
    }

    const updatedRecord: PayrollRecord = {
      ...rec,
      paymentMethod: updates.paymentMethod,
      taxableHours: updates.taxableHours,
      cashHours: updates.cashHours,
      checkAmount,
      cashAmount,
      isManualTax: updates.isManualTax ?? false,
      manualFederalWithholding: updates.manualFederalWithholding,
      manualVaWithholding: updates.manualVaWithholding,
      manualSocialSecurityTax: updates.manualSocialSecurityTax,
      manualMedicareTax: updates.manualMedicareTax,
      federalWithholding: fed,
      vaWithholding: va,
      socialSecurityTax: ss,
      medicareTax: med,
      totalTaxes,
      totalDeductions,
      netPay,
      notes: updates.notes !== undefined ? updates.notes : rec.notes,
      updatedAt: new Date().toISOString(),
    };

    records[idx] = updatedRecord;
    localStorage.setItem(DEMO_PAYROLL_RECORDS_KEY, JSON.stringify(records));

    // Update parent period totals
    if (rec.periodId) {
      const existingPeriods: PayrollPeriod[] = JSON.parse(localStorage.getItem(DEMO_PAYROLL_PERIODS_KEY) || '[]');
      const pIdx = existingPeriods.findIndex((p) => p.id === rec.periodId);
      if (pIdx >= 0) {
        const periodRecords = records.filter((r) => r.periodId === rec.periodId);
        existingPeriods[pIdx] = {
          ...existingPeriods[pIdx],
          totalTaxes: Math.round(periodRecords.reduce((s, r) => s + r.totalTaxes, 0) * 100) / 100,
          totalDeductions: Math.round(periodRecords.reduce((s, r) => s + (r.totalDeductions || r.totalTaxes), 0) * 100) / 100,
          totalNetPay: Math.round(periodRecords.reduce((s, r) => s + r.netPay, 0) * 100) / 100,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(DEMO_PAYROLL_PERIODS_KEY, JSON.stringify(existingPeriods));
      }
    }

    await logAudit(
      true,
      'UPDATE_PAYMENT_TAX',
      'PAYROLL',
      recordId,
      `Updated payment (${updates.paymentMethod}) and tax settings for ${rec.employeeName}`
    );

    return updatedRecord;
  }

  try {
    const recRef = doc(db, 'payrollRecords', recordId);
    const snap = await getDoc(recRef);
    if (!snap.exists()) throw new Error('Record not found');

    const rec = snap.data() as PayrollRecord;
    let fed = rec.federalWithholding;
    let va = rec.vaWithholding;
    let ss = rec.socialSecurityTax;
    let med = rec.medicareTax;
    let totalTaxes = rec.totalTaxes;

    if (updates.isManualTax) {
      fed = updates.manualFederalWithholding !== undefined ? updates.manualFederalWithholding : rec.federalWithholding;
      va = updates.manualVaWithholding !== undefined ? updates.manualVaWithholding : rec.vaWithholding;
      ss = updates.manualSocialSecurityTax !== undefined ? updates.manualSocialSecurityTax : rec.socialSecurityTax;
      med = updates.manualMedicareTax !== undefined ? updates.manualMedicareTax : rec.medicareTax;
      totalTaxes = Math.round((fed + va + ss + med) * 100) / 100;
    } else {
      const recalculated = calculatePayroll({
        hourlyWage: rec.hourlyWage,
        regularHours: rec.regularHours,
        overtimeHours: rec.overtimeHours,
        settings,
        insuranceDeduction: rec.insuranceDeduction,
        otherDeductions: rec.otherDeductions,
        adjustments: rec.adjustments,
        withholdFederal: rec.withholdFederal,
        withholdVirginia: rec.withholdVirginia,
        withholdSocialSecurity: rec.withholdSocialSecurity,
        withholdMedicare: rec.withholdMedicare,
      });
      fed = recalculated.federalWithholding;
      va = recalculated.vaWithholding;
      ss = recalculated.socialSecurityTax;
      med = recalculated.medicareTax;
      totalTaxes = recalculated.totalTaxes;
    }

    const nonTaxDeductions = (rec.insuranceDeduction || 0) + (rec.otherDeductions || 0);
    const totalDeductions = Math.round((totalTaxes + nonTaxDeductions) * 100) / 100;
    const netPay = Math.max(0, Math.round((rec.grossPay - totalDeductions) * 100) / 100);

    let checkAmount = netPay;
    let cashAmount = 0;
    if (updates.paymentMethod === 'ALL_CASH') {
      cashAmount = netPay;
      checkAmount = 0;
    } else if (updates.paymentMethod === 'ALL_CHECK') {
      checkAmount = netPay;
      cashAmount = 0;
    } else if (updates.paymentMethod === 'SPLIT') {
      checkAmount = updates.checkAmount !== undefined ? updates.checkAmount : (rec.checkAmount ?? netPay);
      cashAmount = updates.cashAmount !== undefined ? updates.cashAmount : (rec.cashAmount ?? 0);
    }

    const rawPayload: Record<string, unknown> = {
      paymentMethod: updates.paymentMethod,
      checkAmount,
      cashAmount,
      isManualTax: updates.isManualTax ?? false,
      federalWithholding: fed,
      vaWithholding: va,
      socialSecurityTax: ss,
      medicareTax: med,
      totalTaxes,
      totalDeductions,
      netPay,
      notes: updates.notes !== undefined ? updates.notes : (rec.notes ?? ''),
      updatedAt: new Date().toISOString(),
    };

    if (updates.taxableHours !== undefined) rawPayload.taxableHours = updates.taxableHours;
    if (updates.cashHours !== undefined) rawPayload.cashHours = updates.cashHours;
    if (updates.manualFederalWithholding !== undefined) rawPayload.manualFederalWithholding = updates.manualFederalWithholding;
    if (updates.manualVaWithholding !== undefined) rawPayload.manualVaWithholding = updates.manualVaWithholding;
    if (updates.manualSocialSecurityTax !== undefined) rawPayload.manualSocialSecurityTax = updates.manualSocialSecurityTax;
    if (updates.manualMedicareTax !== undefined) rawPayload.manualMedicareTax = updates.manualMedicareTax;

    const payload = rawPayload;

    await updateDoc(recRef, payload);

    if (rec.periodId) {
      try {
        const q = query(collection(db, 'payrollRecords'), where('periodId', '==', rec.periodId));
        const qSnap = await getDocs(q);
        const allRecords = qSnap.docs.map((d) => (d.id === recordId ? { ...rec, ...payload } : (d.data() as PayrollRecord)));
        await updateDoc(doc(db, 'payrollPeriods', rec.periodId), {
          totalTaxes: Math.round(allRecords.reduce((s, r) => s + (r.totalTaxes || 0), 0) * 100) / 100,
          totalNetPay: Math.round(allRecords.reduce((s, r) => s + (r.netPay || 0), 0) * 100) / 100,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Could not update period totals:', err);
      }
    }

    await logAudit(
      false,
      'UPDATE_PAYMENT_TAX',
      'PAYROLL',
      recordId,
      `Updated payment (${updates.paymentMethod}) and tax settings for ${rec.employeeName}`
    );

    return { ...rec, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payrollRecords/${recordId}`);
    throw error;
  }
}

// ---------------- STORE SETTINGS ----------------
export async function fetchStoreSettings(isDemo: boolean): Promise<StoreSettings> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StoreSettings;
        if (!parsed.storeName || parsed.storeName.includes('Hanaro') || parsed.storeName.includes('CMORE')) {
          parsed.storeName = 'MANAGEMENT OF CULMORE';
          parsed.storeNameKo = 'MANAGEMENT OF CULMORE';
          localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch {
        // fallback
      }
    }
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(INITIAL_STORE_SETTINGS));
    return INITIAL_STORE_SETTINGS;
  }

  try {
    const snap = await getDoc(doc(db, 'settings', 'store_settings'));
    if (snap.exists()) {
      const data = snap.data() as StoreSettings;
      // If storeName was from prior versions, auto-update to MANAGEMENT OF CULMORE
      if (!data.storeName || data.storeName.includes('Hanaro') || data.storeName.includes('CMORE')) {
        const updated: StoreSettings = {
          ...data,
          storeName: 'MANAGEMENT OF CULMORE',
          storeNameKo: 'MANAGEMENT OF CULMORE',
          updatedAt: new Date().toISOString(),
        };
        try {
          await updateDoc(doc(db, 'settings', 'store_settings'), {
            storeName: 'MANAGEMENT OF CULMORE',
            storeNameKo: 'MANAGEMENT OF CULMORE',
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // ignore background update error if permission restricted
        }
        return updated;
      }
      return data;
    }
    // Auto-create initial settings if not present
    await setDoc(doc(db, 'settings', 'store_settings'), INITIAL_STORE_SETTINGS);
    return INITIAL_STORE_SETTINGS;
  } catch (error) {
    console.warn('Could not load settings from Firestore, fallback to defaults:', error);
    return INITIAL_STORE_SETTINGS;
  }
}

export async function saveStoreSettingsRecord(isDemo: boolean, settings: StoreSettings): Promise<void> {
  const adminEmail = auth.currentUser?.email || (isDemo ? 'demo.admin@hanaromarket.com' : 'admin@hanaromarket.com');
  const isOwner = adminEmail.toLowerCase() === 'jaraman1215@gmail.com';
  const payload: StoreSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };

  if (isDemo) {
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(payload));
    await logAudit(true, 'UPDATE_SETTINGS', 'SETTINGS', 'store_settings', 'Updated tax rates and store details');
    return;
  }

  try {
    const cleanPayload: Record<string, unknown> = { ...payload };
    if (!isOwner) {
      delete cleanPayload.workspacePasscode;
    }
    await setDoc(doc(db, 'settings', 'store_settings'), cleanPayload, { merge: true });
    await logAudit(false, 'UPDATE_SETTINGS', 'SETTINGS', 'store_settings', 'Updated tax rates and store details');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/store_settings');
  }
}

export async function saveWorkspacePasscode(isDemo: boolean, newPasscode: string): Promise<void> {
  if (!/^\d{6}$/.test(newPasscode)) {
    throw new Error('Passcode must be exactly 6 numeric digits.');
  }

  const adminEmail = auth.currentUser?.email || '';
  if (!isDemo && adminEmail.toLowerCase() !== 'jaraman1215@gmail.com') {
    throw new Error('Only jaraman1215@gmail.com is authorized to modify the workspace passcode.');
  }

  if (isDemo) {
    const current = await fetchStoreSettings(true);
    const updated: StoreSettings = {
      ...current,
      workspacePasscode: newPasscode,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail || 'jaraman1215@gmail.com',
    };
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(updated));
    await logAudit(true, 'UPDATE_PASSCODE', 'SETTINGS', 'store_settings', 'Updated 6-digit workspace entry passcode');
    return;
  }

  try {
    await setDoc(
      doc(db, 'settings', 'store_settings'),
      {
        id: 'store_settings',
        workspacePasscode: newPasscode,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail,
      },
      { merge: true }
    );
    await logAudit(false, 'UPDATE_PASSCODE', 'SETTINGS', 'store_settings', 'Updated 6-digit workspace entry passcode');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/store_settings');
  }
}

// ---------------- AUDIT LOGS ----------------
export async function fetchAuditLogs(isDemo: boolean): Promise<AuditLog[]> {
  if (isDemo) {
    return JSON.parse(localStorage.getItem(DEMO_AUDIT_KEY) || '[]');
  }

  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
  } catch (error) {
    // If composite index is pending, fallback to un-ordered getDocs
    try {
      const snap = await getDocs(collection(db, 'auditLogs'));
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
      return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50);
    } catch {
      return [];
    }
  }
}

// ---------------- ADMINISTRATORS ----------------
const DEFAULT_DEMO_ADMINS: Administrator[] = [
  {
    uid: 'demo_admin_1',
    email: 'jaraman1215@gmail.com',
    loginId: 'jaraman1215@gmail.com',
    name: 'Primary Owner (Admin)',
    role: 'super_admin',
    createdAt: '2026-11-06T08:00:00Z',
  },
  {
    uid: 'demo_admin_2',
    email: 'manager@culmore.local',
    loginId: 'manager',
    name: 'Assistant Manager',
    role: 'manager',
    createdAt: '2026-11-06T08:00:00Z',
  },
];

export async function fetchAdministrators(isDemo: boolean): Promise<Administrator[]> {
  if (isDemo) {
    const saved = localStorage.getItem(DEMO_ADMINS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_DEMO_ADMINS;
      }
    }
    localStorage.setItem(DEMO_ADMINS_KEY, JSON.stringify(DEFAULT_DEMO_ADMINS));
    return DEFAULT_DEMO_ADMINS;
  }

  try {
    const snap = await getDocs(collection(db, 'administrators'));
    return snap.docs.map(d => ({ ...d.data(), uid: d.id } as Administrator));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'administrators');
  }
}

export async function saveAdministratorRecord(
  isDemo: boolean,
  input: { emailOrId: string; role: AdminRole; name: string }
): Promise<Administrator> {
  const trimmed = input.emailOrId.trim();
  const isEmail = trimmed.includes('@');
  const cleanId = isEmail ? trimmed.toLowerCase() : trimmed.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  const normalizedEmail = isEmail ? cleanId : `${cleanId}@culmore.local`;
  const docId = `prov_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`.slice(0, 120);

  const adminRecord: Administrator = {
    uid: docId,
    email: normalizedEmail,
    loginId: cleanId,
    name: input.name.trim() || cleanId,
    role: input.role,
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.email || 'admin',
  };

  if (isDemo) {
    const list = await fetchAdministrators(true);
    const updated = [adminRecord, ...list.filter(a => a.email !== normalizedEmail && a.uid !== docId)];
    localStorage.setItem(DEMO_ADMINS_KEY, JSON.stringify(updated));
    await logAudit(true, 'PROVISION_ADMIN', 'ADMIN', docId, `Provisioned ${adminRecord.loginId} as ${adminRecord.role}`);
    return adminRecord;
  }

  try {
    await setDoc(doc(db, 'administrators', docId), adminRecord);
    await logAudit(false, 'PROVISION_ADMIN', 'ADMIN', docId, `Provisioned ${adminRecord.loginId} as ${adminRecord.role}`);
    return adminRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `administrators/${docId}`);
  }
}

export async function updateAdministratorRole(
  isDemo: boolean,
  uid: string,
  role: AdminRole
): Promise<void> {
  if (isDemo) {
    const list = await fetchAdministrators(true);
    const updated = list.map(a => (a.uid === uid ? { ...a, role } : a));
    localStorage.setItem(DEMO_ADMINS_KEY, JSON.stringify(updated));
    await logAudit(true, 'UPDATE_ADMIN_ROLE', 'ADMIN', uid, `Updated role to ${role}`);
    return;
  }

  try {
    await updateDoc(doc(db, 'administrators', uid), { role });
    await logAudit(false, 'UPDATE_ADMIN_ROLE', 'ADMIN', uid, `Updated role to ${role}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `administrators/${uid}`);
  }
}

export async function deleteAdministratorRecord(isDemo: boolean, uid: string): Promise<void> {
  if (isDemo) {
    const list = await fetchAdministrators(true);
    const updated = list.filter(a => a.uid !== uid);
    localStorage.setItem(DEMO_ADMINS_KEY, JSON.stringify(updated));
    await logAudit(true, 'DELETE_ADMIN', 'ADMIN', uid, `Removed administrator ${uid}`);
    return;
  }

  try {
    await deleteDoc(doc(db, 'administrators', uid));
    await logAudit(false, 'DELETE_ADMIN', 'ADMIN', uid, `Removed administrator ${uid}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `administrators/${uid}`);
  }
}
