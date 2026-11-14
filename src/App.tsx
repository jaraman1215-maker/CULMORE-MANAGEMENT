import React, { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { db, testConnection } from './firebase/config';
import {
  fetchEmployees,
  saveEmployeeRecord,
  archiveEmployeeRecord,
  deleteEmployeeRecord,
  deleteAllEmployees,
  fetchShiftsForWeek,
  saveShiftRecord,
  deleteShiftRecord,
  copyShiftsFromWeek,
  fetchPayrollPeriod,
  fetchPayrollRecords,
  generateWeeklyPayroll,
  finalizePayrollPeriod,
  reopenPayrollPeriod,
  addPayrollAdjustment,
  savePayrollRecordAdjustments,
  updatePayrollRecordTaxSelections,
  batchUpdatePayrollTaxSelections,
  savePayrollRecordPaymentAndTaxes,
  PaymentAndTaxUpdates,
  TaxWithholdingSelections,
  CopyScheduleOptions,
  fetchStoreSettings,
  saveStoreSettingsRecord,
  fetchAuditLogs,
  fetchAdministrators,
  saveAdministratorRecord,
  updateAdministratorRole,
  deleteAdministratorRecord,
  seed25SampleEmployeesToFirestore,
  saveWorkspacePasscode,
} from './firebase/dataService';
import {
  Employee,
  Shift,
  PayrollPeriod,
  PayrollRecord,
  StoreSettings,
  AuditLog,
  Administrator,
  AdminRole,
  PayrollAdjustment,
} from './types';
import { INITIAL_STORE_SETTINGS } from './utils/demoData';
import { getDaysInWorkWeek, getWorkWeekFriday } from './utils/dateUtils';
import { calculateShiftHours, isCashierEmployee } from './utils/calculations';
import {
  saveScheduleAutoBackup,
  buildFinalPayrollArchive,
  saveFinalPayrollArchiveLocal,
  downloadFinalPayrollArchiveToComputer,
} from './utils/backupUtils';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { ScheduleView } from './components/ScheduleView';
import { PayrollView } from './components/PayrollView';
import { ReportsView } from './components/ReportsView';
import { SettingsAndAuditView } from './components/SettingsAndAuditView';
import { AdminManualView } from './components/AdminManualView';
import { CalculationTestModal } from './components/CalculationTestModal';
import { AuthModal } from './components/AuthModal';
import { PasscodeGateModal } from './components/PasscodeGateModal';
import { PasswordResetModal, PasswordResetInitialTarget } from './components/PasswordResetModal';
import { PrintScheduleStandaloneView } from './components/PrintScheduleStandaloneView';
import { PrintPaystubStandaloneView } from './components/PrintPaystubStandaloneView';
import { PrintPayrollRegisterStandaloneView } from './components/PrintPayrollRegisterStandaloneView';

const AppContent: React.FC = () => {
  const { isAdmin, isDemoMode } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentWeekFriday, setCurrentWeekFriday] = useState<string>(
    () => new URLSearchParams(window.location.search).get('week') || getWorkWeekFriday()
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<PasswordResetInitialTarget | null>(null);

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState<boolean>(false);
  const [isSettingsReady, setIsSettingsReady] = useState<boolean>(false);

  // Mandatory Skill Test Connection
  useEffect(() => {
    testConnection();
  }, []);

  // Fetch all primary datasets (used for Demo Mode or fallback refresh)
  const loadAllData = useCallback(async () => {
    if (!isDemoMode && !isAdmin) {
      setIsLoadingData(false);
      return;
    }
    try {
      setIsLoadingData(true);
      const [empList, sett, audits, admins] = await Promise.all([
        fetchEmployees(isDemoMode),
        fetchStoreSettings(isDemoMode),
        fetchAuditLogs(isDemoMode),
        fetchAdministrators(isDemoMode),
      ]);

      setEmployees(empList);
      setSettings(sett);
      setIsSettingsReady(true);
      setAuditLogs(audits);
      setAdministrators(admins);

      // Load shifts and payroll for current week
      const [weekShifts, period] = await Promise.all([
        fetchShiftsForWeek(isDemoMode, currentWeekFriday),
        fetchPayrollPeriod(isDemoMode, `period_${currentWeekFriday}`),
      ]);
      setShifts(weekShifts);
      setPayrollPeriod(period);

      if (period) {
        const records = await fetchPayrollRecords(isDemoMode, period.id);
        setPayrollRecords(records);
      } else {
        setPayrollRecords([]);
      }
    } catch (err) {
      console.error('Error loading application data:', err);
      setIsSettingsReady(true);
    } finally {
      setIsLoadingData(false);
    }
  }, [isDemoMode, isAdmin, currentWeekFriday]);

  useEffect(() => {
    if (isDemoMode) {
      loadAllData();
      return;
    }
    if (!isAdmin) {
      setIsLoadingData(false);
      return;
    }

    // Live Cloud Firestore real-time synchronization across PC, laptop, and tablet
    setIsLoadingData(true);
    const periodId = `period_${currentWeekFriday}`;

    const unsubEmployees = onSnapshot(
      collection(db, 'employees'),
      (snap) => {
        setEmployees(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Employee)));
        setIsLoadingData(false);
      },
      (err) => {
        console.error('Firestore employees listener error:', err);
        setIsLoadingData(false);
      }
    );

    const unsubShifts = onSnapshot(
      collection(db, 'schedules', currentWeekFriday, 'shifts'),
      (snap) => {
        setShifts(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Shift)));
      },
      (err) => {
        console.error('Firestore shifts listener error:', err);
      }
    );

    const unsubPeriod = onSnapshot(
      doc(db, 'payrollPeriods', periodId),
      (snap) => {
        setPayrollPeriod(snap.exists() ? (snap.data() as PayrollPeriod) : null);
      },
      (err) => {
        console.error('Firestore payrollPeriod listener error:', err);
      }
    );

    const unsubRecords = onSnapshot(
      query(collection(db, 'payrollRecords'), where('periodId', '==', periodId)),
      (snap) => {
        setPayrollRecords(snap.docs.map((d) => ({ ...d.data(), id: d.id } as PayrollRecord)));
      },
      (err) => {
        console.error('Firestore payrollRecords listener error:', err);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'store_settings'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as StoreSettings);
          setIsSettingsReady(true);
        } else {
          fetchStoreSettings(false)
            .then((s) => {
              setSettings(s);
              setIsSettingsReady(true);
            })
            .catch(() => setIsSettingsReady(true));
        }
      },
      (err) => {
        console.error('Firestore settings listener error:', err);
        setIsSettingsReady(true);
      }
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'administrators'),
      (snap) => {
        setAdministrators(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as Administrator)));
      },
      (err) => {
        console.error('Firestore administrators listener error:', err);
      }
    );

    const unsubAudits = onSnapshot(
      collection(db, 'auditLogs'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog));
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setAuditLogs(list.slice(0, 50));
      },
      (err) => {
        console.error('Firestore auditLogs listener error:', err);
      }
    );

    return () => {
      unsubEmployees();
      unsubShifts();
      unsubPeriod();
      unsubRecords();
      unsubSettings();
      unsubAdmins();
      unsubAudits();
    };
  }, [isDemoMode, isAdmin, currentWeekFriday, loadAllData]);

  // Helper to sync open payroll strictly using registered active employees
  const syncOpenPayrollStrict = async (empList: Employee[], weekShifts: Shift[]) => {
    const activeEmps = empList.filter((e) => e.active);
    const activeIds = new Set(activeEmps.map((e) => e.employeeId));
    const activeShifts = weekShifts.filter((s) => activeIds.has(s.employeeId));
    if ((payrollPeriod && payrollPeriod.status !== 'finalized') || (!payrollPeriod && activeShifts.length > 0)) {
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        activeEmps,
        activeShifts,
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
  };

  // Handlers for Employee modifications
  const handleSaveEmployee = async (emp: Employee) => {
    await saveEmployeeRecord(isDemoMode, emp);

    // If employee has shifts in the current week, update their breaks and hours according to the new part
    const empShifts = shifts.filter((s) => s.employeeId === emp.employeeId);
    if (empShifts.length > 0) {
      const isCashier = isCashierEmployee(emp.department, emp.position);
      for (const s of empShifts) {
        const calc = calculateShiftHours(
          s.startTime,
          s.endTime,
          s.actualBreakMinutes ?? s.breakMinutes,
          isCashier
        );
        const updatedShift: Shift = {
          ...s,
          hours: calc.hours,
          rawHours: calc.rawHours,
          paidBreakMinutes: calc.paidBreakMinutes,
          actualBreakMinutes: calc.actualBreakMinutes,
          excessBreakMinutes: calc.excessBreakMinutes,
          isOvernight: calc.isOvernight,
          businessGroup: emp.businessGroup,
        };
        await saveShiftRecord(isDemoMode, currentWeekFriday, updatedShift);
      }
    }

    const [updatedEmps, updatedShifts] = await Promise.all([
      fetchEmployees(isDemoMode),
      fetchShiftsForWeek(isDemoMode, currentWeekFriday),
    ]);
    if (isDemoMode) await loadAllData();
    await syncOpenPayrollStrict(updatedEmps, updatedShifts);
  };

  const handleArchiveEmployee = async (employeeId: string, active: boolean) => {
    await archiveEmployeeRecord(isDemoMode, employeeId, active);
    const [updatedEmps, updatedShifts] = await Promise.all([
      fetchEmployees(isDemoMode),
      fetchShiftsForWeek(isDemoMode, currentWeekFriday),
    ]);
    if (isDemoMode) await loadAllData();
    await syncOpenPayrollStrict(updatedEmps, updatedShifts);
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    await deleteEmployeeRecord(isDemoMode, employeeId);
    const [updatedEmps, updatedShifts] = await Promise.all([
      fetchEmployees(isDemoMode),
      fetchShiftsForWeek(isDemoMode, currentWeekFriday),
    ]);
    if (isDemoMode) await loadAllData();
    await syncOpenPayrollStrict(updatedEmps, updatedShifts);
  };

  const handleDeleteAllEmployees = async () => {
    await deleteAllEmployees(isDemoMode);
    setEmployees([]);
    setShifts([]);
    setPayrollRecords([]);
    if (payrollPeriod && payrollPeriod.status !== 'finalized') {
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        [],
        [],
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
    if (isDemoMode) await loadAllData();
  };

  // Handlers for Shifts & Schedules
  const handleSaveShift = async (shift: Shift) => {
    await saveShiftRecord(isDemoMode, currentWeekFriday, shift);
    const updated = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
    setShifts(updated);
    saveScheduleAutoBackup(currentWeekFriday, updated, 'auto');
    await syncOpenPayrollStrict(employees, updated);
  };

  const handleDeleteShift = async (shiftId: string) => {
    await deleteShiftRecord(isDemoMode, currentWeekFriday, shiftId);
    const updated = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
    setShifts(updated);
    saveScheduleAutoBackup(currentWeekFriday, updated, 'auto');
    await syncOpenPayrollStrict(employees, updated);
  };

  const handleCopyFromPreviousWeek = async (
    sourceFriday: string,
    targetFriday: string,
    options?: CopyScheduleOptions
  ) => {
    await copyShiftsFromWeek(isDemoMode, sourceFriday, targetFriday, options);
    const updated = await fetchShiftsForWeek(isDemoMode, targetFriday);
    setShifts(updated);
    saveScheduleAutoBackup(targetFriday, updated, 'auto');
    if (targetFriday === currentWeekFriday) {
      await syncOpenPayrollStrict(employees, updated);
    }
  };

  const handleRestoreScheduleBackup = async (
    targetWeekFriday: string,
    backupShifts: Shift[],
    mode: 'merge' | 'overwrite'
  ): Promise<number> => {
    const targetDays = getDaysInWorkWeek(targetWeekFriday);
    const activeEmps = employees.filter((e) => e.active);
    const activeEmpMap = new Map(activeEmps.map((e) => [e.employeeId, e]));
    const currentWeekShifts = await fetchShiftsForWeek(isDemoMode, targetWeekFriday);

    if (mode === 'overwrite') {
      for (const existing of currentWeekShifts) {
        await deleteShiftRecord(isDemoMode, targetWeekFriday, existing.id);
      }
    }

    const existingKeys = new Set(
      mode === 'merge' ? currentWeekShifts.map((s) => `${s.employeeId}_${s.date}`) : []
    );

    let applied = 0;
    for (const bakShift of backupShifts) {
      const emp = activeEmpMap.get(bakShift.employeeId);
      if (!emp) continue;

      const matchedDay =
        targetDays.find((d) => d.dayOfWeek === bakShift.dayOfWeek) ||
        targetDays.find((d) => d.date === bakShift.date);
      if (!matchedDay) continue;

      const key = `${emp.employeeId}_${matchedDay.date}`;
      if (mode === 'merge' && existingKeys.has(key)) continue;

      const isCashier = isCashierEmployee(emp.department, emp.position);
      const calc = calculateShiftHours(
        bakShift.startTime,
        bakShift.endTime,
        bakShift.actualBreakMinutes ?? bakShift.breakMinutes,
        isCashier
      );

      const newShift: Shift = {
        ...bakShift,
        id: `shift_${targetWeekFriday}_${emp.employeeId}_${matchedDay.date}`,
        scheduleId: targetWeekFriday,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        date: matchedDay.date,
        dayOfWeek: matchedDay.dayOfWeek,
        hours: calc.hours,
        rawHours: calc.rawHours,
        paidBreakMinutes: calc.paidBreakMinutes,
        actualBreakMinutes: calc.actualBreakMinutes,
        excessBreakMinutes: calc.excessBreakMinutes,
        isOvernight: calc.isOvernight,
        businessGroup: emp.businessGroup || bakShift.businessGroup,
        updatedAt: new Date().toISOString(),
      };

      await saveShiftRecord(isDemoMode, targetWeekFriday, newShift);
      existingKeys.add(key);
      applied++;
    }

    const updated = await fetchShiftsForWeek(isDemoMode, targetWeekFriday);
    setShifts(updated);
    saveScheduleAutoBackup(targetWeekFriday, updated, 'auto');
    if (targetWeekFriday === currentWeekFriday) {
      await syncOpenPayrollStrict(employees, updated);
    }
    return applied;
  };

  // Handlers for Payroll
  const handleGeneratePayroll = async () => {
    const activeEmps = employees.filter((e) => e.active);
    const activeIds = new Set(activeEmps.map((e) => e.employeeId));
    const activeShifts = shifts.filter((s) => activeIds.has(s.employeeId));
    const { period, records } = await generateWeeklyPayroll(
      isDemoMode,
      currentWeekFriday,
      activeEmps,
      activeShifts,
      settings
    );
    setPayrollPeriod(period);
    setPayrollRecords(records);
  };

  const handleFinalizePayroll = async (periodId: string) => {
    await finalizePayrollPeriod(isDemoMode, periodId);
    const [updatedPeriod, latestRecords] = await Promise.all([
      fetchPayrollPeriod(isDemoMode, periodId),
      fetchPayrollRecords(isDemoMode, periodId),
    ]);
    setPayrollPeriod(updatedPeriod);
    setPayrollRecords(latestRecords);

    if (updatedPeriod) {
      const activeEmps = employees.filter((e) => e.active);
      const activeIds = new Set(activeEmps.map((e) => e.employeeId));
      const archive = buildFinalPayrollArchive({
        period: updatedPeriod,
        records: latestRecords.filter((r) => activeIds.has(r.employeeId)),
        employees: activeEmps,
        settings,
        finalizedBy: updatedPeriod.finalizedBy || 'admin',
      });
      saveFinalPayrollArchiveLocal(archive);
      downloadFinalPayrollArchiveToComputer(archive);
    }
  };

  const handleReopenPayroll = async (periodId: string, reason: string) => {
    await reopenPayrollPeriod(isDemoMode, periodId, reason);
    const updated = await fetchPayrollPeriod(isDemoMode, periodId);
    setPayrollPeriod(updated);
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  const handleAddAdjustment = async (recordId: string, adjustment: PayrollAdjustment) => {
    await addPayrollAdjustment(isDemoMode, recordId, adjustment, settings);
    if (payrollPeriod) {
      const records = await fetchPayrollRecords(isDemoMode, payrollPeriod.id);
      setPayrollRecords(records);
    }
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  const handleSaveAdjustments = async (recordId: string, adjustments: PayrollAdjustment[], note?: string) => {
    await savePayrollRecordAdjustments(isDemoMode, recordId, adjustments, settings, note);
    if (payrollPeriod) {
      const [records, updatedPeriod] = await Promise.all([
        fetchPayrollRecords(isDemoMode, payrollPeriod.id),
        fetchPayrollPeriod(isDemoMode, payrollPeriod.id),
      ]);
      setPayrollRecords(records);
      if (updatedPeriod) setPayrollPeriod(updatedPeriod);
    }
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  const handleUpdatePayrollTaxSelections = async (
    recordId: string,
    taxSelections: TaxWithholdingSelections
  ) => {
    await updatePayrollRecordTaxSelections(isDemoMode, recordId, taxSelections, settings);
    if (payrollPeriod) {
      const [records, updatedPeriod] = await Promise.all([
        fetchPayrollRecords(isDemoMode, payrollPeriod.id),
        fetchPayrollPeriod(isDemoMode, payrollPeriod.id),
      ]);
      setPayrollRecords(records);
      setPayrollPeriod(updatedPeriod);
    }
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  const handleBatchUpdatePayrollTaxSelections = async (
    periodId: string,
    taxSelections: TaxWithholdingSelections
  ) => {
    await batchUpdatePayrollTaxSelections(isDemoMode, periodId, taxSelections, settings);
    const [records, updatedPeriod] = await Promise.all([
      fetchPayrollRecords(isDemoMode, periodId),
      fetchPayrollPeriod(isDemoMode, periodId),
    ]);
    setPayrollRecords(records);
    setPayrollPeriod(updatedPeriod);
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  const handleSavePaymentAndTaxes = async (
    recordId: string,
    updates: PaymentAndTaxUpdates
  ) => {
    await savePayrollRecordPaymentAndTaxes(isDemoMode, recordId, updates, settings);
    if (payrollPeriod) {
      const [records, updatedPeriod] = await Promise.all([
        fetchPayrollRecords(isDemoMode, payrollPeriod.id),
        fetchPayrollPeriod(isDemoMode, payrollPeriod.id),
      ]);
      setPayrollRecords(records);
      if (updatedPeriod) setPayrollPeriod(updatedPeriod);
    }
    const audits = await fetchAuditLogs(isDemoMode);
    setAuditLogs(audits);
  };

  // Settings
  const handleSaveSettings = async (newSettings: StoreSettings) => {
    await saveStoreSettingsRecord(isDemoMode, newSettings);
    setSettings(newSettings);
  };

  const handleUpdatePasscode = async (newPasscode: string) => {
    await saveWorkspacePasscode(isDemoMode, newPasscode);
    setSettings((prev) => ({
      ...prev,
      workspacePasscode: newPasscode,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleProvisionAdmin = async (emailOrId: string, role: AdminRole, name: string) => {
    await saveAdministratorRecord(isDemoMode, { emailOrId, role, name });
    const updatedAdmins = await fetchAdministrators(isDemoMode);
    setAdministrators(updatedAdmins);
  };

  const handleUpdateAdminRole = async (uid: string, role: AdminRole) => {
    await updateAdministratorRole(isDemoMode, uid, role);
    const updatedAdmins = await fetchAdministrators(isDemoMode);
    setAdministrators(updatedAdmins);
  };

  const handleDeleteAdmin = async (uid: string) => {
    await deleteAdministratorRecord(isDemoMode, uid);
    const updatedAdmins = await fetchAdministrators(isDemoMode);
    setAdministrators(updatedAdmins);
  };

  // Seeding 25 sample employees
  const handleSeedSampleData = async () => {
    if (isDemoMode) {
      localStorage.removeItem('hanaro_demo_employees');
      localStorage.removeItem('hanaro_demo_shifts');
      localStorage.removeItem('hanaro_demo_payroll_periods');
      localStorage.removeItem('hanaro_demo_payroll_records');
      await loadAllData();
      return;
    }

    const count = await seed25SampleEmployeesToFirestore();
    await loadAllData();
  };

  // If user is not authorized admin and not in demo mode, display AuthModal
  if (!isAdmin && !isDemoMode) {
    return <AuthModal />;
  }

  // Standalone print routes bypass passcode gate when already authenticated
  const urlParams = new URLSearchParams(window.location.search);
  const isPrintSchedule = urlParams.get('print') === 'schedule';
  const isPrintPaystub = urlParams.get('print') === 'paystub';
  const isPrintPayrollRegister = urlParams.get('print') === 'payroll_register';

  // Require 6-digit workspace passcode before entering main workspace
  if (!isPrintSchedule && !isPrintPaystub && !isPrintPayrollRegister && !isPasscodeUnlocked) {
    if (!isSettingsReady && isLoadingData) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm font-bold">
          Loading workspace security...
        </div>
      );
    }
    return (
      <PasscodeGateModal
        expectedPasscode={settings.workspacePasscode || '123456'}
        onUnlock={() => setIsPasscodeUnlocked(true)}
      />
    );
  }

  // Standalone print schedule route (?print=schedule)
  if (isPrintSchedule) {
    const printWeek = urlParams.get('week') || currentWeekFriday;
    const printGroup = urlParams.get('group') || 'ALL';
    const printMode = (urlParams.get('mode') === 'detailed' ? 'detailed' : 'compact') as 'compact' | 'detailed';

    return (
      <PrintScheduleStandaloneView
        currentWeekFriday={printWeek}
        selectedGroup={printGroup}
        mode={printMode}
        employees={employees}
        shifts={shifts}
      />
    );
  }

  // Standalone print paystub route (?print=paystub)
  if (isPrintPaystub) {
    const printWeek = urlParams.get('week') || currentWeekFriday;
    const printEmp = urlParams.get('emp') || (employees[0]?.employeeId ?? '');
    return (
      <PrintPaystubStandaloneView
        weekFriday={printWeek}
        employeeId={printEmp}
        employees={employees}
        settings={settings}
        payrollRecords={payrollRecords}
      />
    );
  }

  // Standalone print payroll register route (?print=payroll_register)
  if (isPrintPayrollRegister) {
    const printWeek = urlParams.get('week') || currentWeekFriday;
    const printGroup = urlParams.get('group') || 'ALL';
    return (
      <PrintPayrollRegisterStandaloneView
        weekFriday={printWeek}
        selectedGroup={printGroup}
        employees={employees}
        settings={settings}
        payrollRecords={payrollRecords}
        payrollPeriod={payrollPeriod}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col antialiased text-slate-900">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenTestModal={() => setShowTestModal(true)}
        onLockWorkspace={() => setIsPasscodeUnlocked(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 print:pl-0 flex-1 flex flex-col min-w-0">
        <Header
          currentWeekFriday={currentWeekFriday}
          onOpenTestModal={() => setShowTestModal(true)}
          onSeedSampleData={handleSeedSampleData}
          employeeCount={employees.length}
          setMobileOpen={setMobileOpen}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
          {activeTab === 'dashboard' && (
            <DashboardView
              employees={employees}
              shifts={shifts}
              payrollPeriod={payrollPeriod}
              settings={settings}
              currentWeekFriday={currentWeekFriday}
              setActiveTab={setActiveTab}
              onOpenTestModal={() => setShowTestModal(true)}
              onOpenPasswordReset={(target) => {
                setPasswordResetTarget(target || null);
                setIsPasswordResetOpen(true);
              }}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              onSaveEmployee={handleSaveEmployee}
              onArchiveEmployee={handleArchiveEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onDeleteAllEmployees={handleDeleteAllEmployees}
              onSeedSampleData={handleSeedSampleData}
              onOpenPasswordReset={(target) => {
                setPasswordResetTarget(target || null);
                setIsPasswordResetOpen(true);
              }}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              currentWeekFriday={currentWeekFriday}
              onChangeWeek={(fri) => setCurrentWeekFriday(fri)}
              employees={employees}
              shifts={shifts}
              onSaveShift={handleSaveShift}
              onDeleteShift={handleDeleteShift}
              onCopyFromPreviousWeek={handleCopyFromPreviousWeek}
              onRestoreScheduleBackup={handleRestoreScheduleBackup}
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollView
              currentWeekFriday={currentWeekFriday}
              onChangeWeek={(fri) => setCurrentWeekFriday(fri)}
              employees={employees}
              shifts={shifts}
              payrollPeriod={payrollPeriod}
              payrollRecords={payrollRecords}
              settings={settings}
              onGeneratePayroll={handleGeneratePayroll}
              onFinalizePayroll={handleFinalizePayroll}
              onReopenPayroll={handleReopenPayroll}
              onAddAdjustment={handleAddAdjustment}
              onSaveAdjustments={handleSaveAdjustments}
              onUpdateTaxSelections={handleUpdatePayrollTaxSelections}
              onBatchUpdateTaxSelections={handleBatchUpdatePayrollTaxSelections}
              onSavePaymentAndTaxes={handleSavePaymentAndTaxes}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              employees={employees}
              payrollPeriod={payrollPeriod}
              payrollRecords={payrollRecords}
              settings={settings}
              currentWeekFriday={currentWeekFriday}
              onChangeWeek={(fri) => setCurrentWeekFriday(fri)}
              onSavePaymentAndTaxes={handleSavePaymentAndTaxes}
              onSyncWithSchedule={handleGeneratePayroll}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsAndAuditView
              settings={settings}
              auditLogs={auditLogs}
              administrators={administrators}
              onSaveSettings={handleSaveSettings}
              onUpdatePasscode={handleUpdatePasscode}
              onProvisionAdmin={handleProvisionAdmin}
              onUpdateAdminRole={handleUpdateAdminRole}
              onDeleteAdmin={handleDeleteAdmin}
              onOpenPasswordReset={(target) => {
                setPasswordResetTarget(target || null);
                setIsPasswordResetOpen(true);
              }}
            />
          )}

          {activeTab === 'manual' && <AdminManualView />}
        </main>
      </div>

      {/* Math & Compliance Test Modal */}
      <CalculationTestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
      />

      {/* Admin & Employee Password Reset Modal */}
      <PasswordResetModal
        isOpen={isPasswordResetOpen}
        onClose={() => setIsPasswordResetOpen(false)}
        employees={employees}
        administrators={administrators}
        initialTarget={passwordResetTarget}
        onSaveEmployeeEmail={async (emp, newEmail) => {
          await handleSaveEmployee({ ...emp, email: newEmail });
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ExchangeRateProvider>
          <AppContent />
        </ExchangeRateProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
