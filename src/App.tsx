import React, { useState, useEffect, useCallback } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExchangeRateProvider } from './context/ExchangeRateContext';
import { testConnection } from './firebase/config';
import {
  fetchEmployees,
  saveEmployeeRecord,
  archiveEmployeeRecord,
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
  seed25SampleEmployeesToFirestore,
} from './firebase/dataService';
import {
  Employee,
  Shift,
  PayrollPeriod,
  PayrollRecord,
  StoreSettings,
  AuditLog,
  Administrator,
  PayrollAdjustment,
} from './types';
import { INITIAL_STORE_SETTINGS } from './utils/demoData';
import { getWorkWeekFriday } from './utils/dateUtils';
import { calculateShiftHours, isCashierEmployee } from './utils/calculations';
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

  // Core Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Mandatory Skill Test Connection
  useEffect(() => {
    testConnection();
  }, []);

  // Fetch all primary datasets
  const loadAllData = useCallback(async () => {
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
    } finally {
      setIsLoadingData(false);
    }
  }, [isDemoMode, currentWeekFriday]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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

    await loadAllData();

    // Auto-sync with open payroll
    if (payrollPeriod && payrollPeriod.status !== 'finalized') {
      const updatedEmps = await fetchEmployees(isDemoMode);
      const updatedShifts = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        updatedEmps.filter((e) => e.active),
        updatedShifts,
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
  };

  const handleArchiveEmployee = async (employeeId: string, active: boolean) => {
    await archiveEmployeeRecord(isDemoMode, employeeId, active);
    await loadAllData();
    if (payrollPeriod && payrollPeriod.status !== 'finalized') {
      const updatedEmps = await fetchEmployees(isDemoMode);
      const updatedShifts = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        updatedEmps.filter((e) => e.active),
        updatedShifts,
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
  };

  // Handlers for Shifts & Schedules
  const handleSaveShift = async (shift: Shift) => {
    await saveShiftRecord(isDemoMode, currentWeekFriday, shift);
    const updated = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
    setShifts(updated);

    // Auto-sync with open payroll period immediately
    if (payrollPeriod && payrollPeriod.status !== 'finalized') {
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        employees.filter((e) => e.active),
        updated,
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    await deleteShiftRecord(isDemoMode, currentWeekFriday, shiftId);
    const updated = await fetchShiftsForWeek(isDemoMode, currentWeekFriday);
    setShifts(updated);

    // Auto-sync with open payroll period immediately
    if (payrollPeriod && payrollPeriod.status !== 'finalized') {
      const { period, records } = await generateWeeklyPayroll(
        isDemoMode,
        currentWeekFriday,
        employees.filter((e) => e.active),
        updated,
        settings
      );
      setPayrollPeriod(period);
      setPayrollRecords(records);
    }
  };

  const handleCopyFromPreviousWeek = async (
    sourceFriday: string,
    targetFriday: string,
    options?: CopyScheduleOptions
  ) => {
    await copyShiftsFromWeek(isDemoMode, sourceFriday, targetFriday, options);
    const updated = await fetchShiftsForWeek(isDemoMode, targetFriday);
    setShifts(updated);
  };

  // Handlers for Payroll
  const handleGeneratePayroll = async () => {
    const { period, records } = await generateWeeklyPayroll(
      isDemoMode,
      currentWeekFriday,
      employees.filter(e => e.active),
      shifts,
      settings
    );
    setPayrollPeriod(period);
    setPayrollRecords(records);
  };

  const handleFinalizePayroll = async (periodId: string) => {
    await finalizePayrollPeriod(isDemoMode, periodId);
    const updated = await fetchPayrollPeriod(isDemoMode, periodId);
    setPayrollPeriod(updated);
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

  const handleProvisionAdmin = async (email: string, role: 'admin' | 'manager', name: string) => {
    // In production, invites/adds admin record
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

  // Standalone print schedule route (?print=schedule)
  const urlParams = new URLSearchParams(window.location.search);
  const isPrintSchedule = urlParams.get('print') === 'schedule';
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
  const isPrintPaystub = urlParams.get('print') === 'paystub';
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
  const isPrintPayrollRegister = urlParams.get('print') === 'payroll_register';
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
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              onSaveEmployee={handleSaveEmployee}
              onArchiveEmployee={handleArchiveEmployee}
              onSeedSampleData={handleSeedSampleData}
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
              onProvisionAdmin={handleProvisionAdmin}
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
