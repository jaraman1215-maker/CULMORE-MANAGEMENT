import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  FileSpreadsheet,
  Search,
  User,
  Calendar,
  Building,
  CheckCircle2,
  DollarSign,
  ChevronDown,
  Sliders,
  Users,
  Filter,
  X,
  Briefcase,
  Store,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  ArrowLeft,
  CalendarDays,
  FileCheck,
  Download,
  Check,
  ExternalLink,
  Info,
  Edit3,
} from 'lucide-react';
import { Employee, PayrollRecord, PayrollPeriod, StoreSettings, BUSINESS_GROUPS, getBusinessGroup } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useExchangeRate } from '../context/ExchangeRateContext';
import { formatCurrency, isCashierEmployee } from '../utils/calculations';
import {
  formatWorkWeekRange,
  getPreviousWeekFriday,
  getNextWeekFriday,
  getWorkWeekFriday,
  getWorkWeekThursday,
} from '../utils/dateUtils';
import {
  fetchAllPayrollPeriods,
  fetchPayrollPeriod,
  fetchPayrollRecords,
  PaymentAndTaxUpdates,
} from '../firebase/dataService';

interface ReportsViewProps {
  employees: Employee[];
  payrollPeriod: PayrollPeriod | null;
  payrollRecords: PayrollRecord[];
  settings: StoreSettings;
  currentWeekFriday: string;
  onChangeWeek?: (fridayYmd: string) => void;
  onSavePaymentAndTaxes?: (recordId: string, updates: PaymentAndTaxUpdates) => Promise<void>;
  onSyncWithSchedule?: () => Promise<void>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employees,
  payrollPeriod,
  payrollRecords,
  settings,
  currentWeekFriday,
  onChangeWeek,
  onSavePaymentAndTaxes,
  onSyncWithSchedule,
}) => {
  const { t, language } = useLanguage();
  const { usdToKrwRate, formatKrw } = useExchangeRate();
  const { isDemoMode } = useAuth();

  const [activeReportTab, setActiveReportTab] = useState<'paystub' | 'summary' | 'historical'>('paystub');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [paystubSearchTerm, setPaystubSearchTerm] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    payrollRecords[0]?.employeeId || employees[0]?.employeeId || ''
  );
  const [searchFilter, setSearchFilter] = useState('');

  // Historical Payroll State (Select pay date to view & print)
  const [selectedHistoricalFriday, setSelectedHistoricalFriday] = useState<string>(currentWeekFriday);
  const [allRecordedPeriods, setAllRecordedPeriods] = useState<PayrollPeriod[]>([]);
  const [historicalPeriod, setHistoricalPeriod] = useState<PayrollPeriod | null>(payrollPeriod);
  const [historicalRecords, setHistoricalRecords] = useState<PayrollRecord[]>(payrollRecords);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [historicalViewMode, setHistoricalViewMode] = useState<'table' | 'paystub'>('table');
  const [selectedHistoricalEmpId, setSelectedHistoricalEmpId] = useState<string>('');

  // Print Modal & Standalone Print States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalType, setPrintModalType] = useState<'paystub' | 'payroll_register'>('paystub');
  const [printModalTargetEmpId, setPrintModalTargetEmpId] = useState<string>(
    payrollRecords[0]?.employeeId || employees[0]?.employeeId || ''
  );
  const [printModalTargetWeek, setPrintModalTargetWeek] = useState<string>(currentWeekFriday);
  const [printModalTargetGroup, setPrintModalTargetGroup] = useState<string>(selectedGroup || 'ALL');
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Paystub Direct Tax Input / Override State (Item 4)
  const [isPaystubTaxModalOpen, setIsPaystubTaxModalOpen] = useState(false);
  const [taxTargetRecord, setTaxTargetRecord] = useState<PayrollRecord | null>(null);
  const [isManualTax, setIsManualTax] = useState(false);
  const [manualFedStr, setManualFedStr] = useState('');
  const [manualVaStr, setManualVaStr] = useState('');
  const [manualSsStr, setManualSsStr] = useState('');
  const [manualMedStr, setManualMedStr] = useState('');
  const [isSavingTax, setIsSavingTax] = useState(false);
  const [taxSaveSuccess, setTaxSaveSuccess] = useState(false);

  const handleOpenPaystubTaxModal = (rec: PayrollRecord) => {
    setTaxTargetRecord(rec);
    setIsManualTax(rec.isManualTax ?? false);
    setManualFedStr(
      (rec.manualFederalWithholding !== undefined
        ? rec.manualFederalWithholding
        : rec.federalWithholding
      ).toFixed(2)
    );
    setManualVaStr(
      (rec.manualVaWithholding !== undefined
        ? rec.manualVaWithholding
        : rec.vaWithholding
      ).toFixed(2)
    );
    setManualSsStr(
      (rec.manualSocialSecurityTax !== undefined
        ? rec.manualSocialSecurityTax
        : rec.socialSecurityTax
      ).toFixed(2)
    );
    setManualMedStr(
      (rec.manualMedicareTax !== undefined
        ? rec.manualMedicareTax
        : rec.medicareTax
      ).toFixed(2)
    );
    setTaxSaveSuccess(false);
    setIsPaystubTaxModalOpen(true);
  };

  const handleSavePaystubTaxes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxTargetRecord || !onSavePaymentAndTaxes) return;
    try {
      setIsSavingTax(true);
      const fed = parseFloat(manualFedStr) || 0;
      const va = parseFloat(manualVaStr) || 0;
      const ss = parseFloat(manualSsStr) || 0;
      const med = parseFloat(manualMedStr) || 0;

      await onSavePaymentAndTaxes(taxTargetRecord.id, {
        paymentMethod: taxTargetRecord.paymentMethod || 'ALL_CHECK',
        isManualTax,
        manualFederalWithholding: isManualTax ? fed : undefined,
        manualVaWithholding: isManualTax ? va : undefined,
        manualSocialSecurityTax: isManualTax ? ss : undefined,
        manualMedicareTax: isManualTax ? med : undefined,
      });

      setTaxSaveSuccess(true);
      setTimeout(() => {
        setIsPaystubTaxModalOpen(false);
        setTaxSaveSuccess(false);
      }, 700);
    } catch (err) {
      console.error('Failed to save paystub tax overrides:', err);
    } finally {
      setIsSavingTax(false);
    }
  };

  // Load all recorded periods from Firestore/localStorage
  useEffect(() => {
    let isMounted = true;
    const loadPeriods = async () => {
      try {
        const periods = await fetchAllPayrollPeriods(isDemoMode);
        if (isMounted) {
          const exists = periods.some((p) => p.weekStartDate === currentWeekFriday);
          if (!exists && payrollPeriod) {
            setAllRecordedPeriods([payrollPeriod, ...periods]);
          } else {
            setAllRecordedPeriods(periods);
          }
        }
      } catch (err) {
        console.error('Failed to load payroll periods:', err);
      }
    };
    loadPeriods();
    return () => {
      isMounted = false;
    };
  }, [isDemoMode, currentWeekFriday, payrollPeriod]);

  // Load historical records when selectedHistoricalFriday changes
  useEffect(() => {
    let isMounted = true;
    if (selectedHistoricalFriday === currentWeekFriday) {
      setHistoricalPeriod(payrollPeriod);
      setHistoricalRecords(payrollRecords);
      return;
    }

    const loadHistoricalData = async () => {
      setIsLoadingHistorical(true);
      try {
        const periodId = `period_${selectedHistoricalFriday}`;
        const [period, records] = await Promise.all([
          fetchPayrollPeriod(isDemoMode, periodId),
          fetchPayrollRecords(isDemoMode, periodId),
        ]);
        if (isMounted) {
          setHistoricalPeriod(period || null);
          setHistoricalRecords(records || []);
        }
      } catch (err) {
        console.error('Failed to load historical payroll:', err);
      } finally {
        if (isMounted) setIsLoadingHistorical(false);
      }
    };

    loadHistoricalData();
    return () => {
      isMounted = false;
    };
  }, [selectedHistoricalFriday, currentWeekFriday, payrollPeriod, payrollRecords, isDemoMode]);

  // Resolves business name reliably (falls back from old legacy names)
  const displayStoreName =
    settings.storeName && !settings.storeName.includes('Hanaro') && !settings.storeName.includes('CMORE')
      ? settings.storeName
      : 'MANAGEMENT OF CULMORE';
  const displayStoreNameKo =
    settings.storeNameKo && !settings.storeNameKo.includes('Hanaro') && !settings.storeNameKo.includes('CMORE')
      ? settings.storeNameKo
      : 'MANAGEMENT OF CULMORE';

  // Group resolver helpers
  const getEmpGroup = (emp?: Employee) => {
    return getBusinessGroup(emp?.businessGroup || emp?.groupNumber);
  };

  const getRecGroup = (rec?: PayrollRecord) => {
    const emp = employees.find((e) => e.employeeId === rec?.employeeId);
    return getBusinessGroup(rec?.businessGroup || rec?.groupNumber || emp?.businessGroup || emp?.groupNumber);
  };

  // Filter payroll records that actually have worked hours or pay/adjustments (Item: exclude non-applicable employees)
  const activeWorkingRecords = payrollRecords.filter(
    (r) =>
      r.regularHours > 0 ||
      r.overtimeHours > 0 ||
      r.grossPay > 0 ||
      (r.adjustments && r.adjustments.length > 0)
  );

  // Group metrics: only count working employees who actually have payroll in this period
  const groupMetrics = BUSINESS_GROUPS.map((grp) => {
    const groupRecs = activeWorkingRecords.filter((r) => getRecGroup(r).id === grp.id);
    const totalNet = groupRecs.reduce((sum, r) => sum + r.netPay, 0);
    return {
      ...grp,
      empCount: groupRecs.length,
      recordCount: groupRecs.length,
      totalNet,
    };
  });

  const grandTotalNet = activeWorkingRecords.reduce((sum, r) => sum + r.netPay, 0);

  // Group selection switch
  const handleSelectGroup = (grpId: string) => {
    setSelectedGroup(grpId);
    if (grpId !== 'ALL') {
      const groupRecs = activeWorkingRecords.filter((r) => getRecGroup(r).id === grpId);
      if (groupRecs.length > 0) {
        if (!groupRecs.some((r) => r.employeeId === selectedEmployeeId)) {
          setSelectedEmployeeId(groupRecs[0].employeeId);
        }
      } else {
        setSelectedEmployeeId('');
      }
    } else {
      if (activeWorkingRecords.length > 0 && !activeWorkingRecords.some((r) => r.employeeId === selectedEmployeeId)) {
        setSelectedEmployeeId(activeWorkingRecords[0].employeeId);
      }
    }
  };

  // Keep selectedEmployeeId pointing to a valid working employee for the selected group
  useEffect(() => {
    const groupRecs = activeWorkingRecords.filter((r) => {
      if (selectedGroup === 'ALL') return true;
      return getRecGroup(r).id === selectedGroup;
    });

    if (groupRecs.length > 0) {
      if (!groupRecs.some((r) => r.employeeId === selectedEmployeeId)) {
        setSelectedEmployeeId(groupRecs[0].employeeId);
      }
    } else if (selectedGroup !== 'ALL') {
      setSelectedEmployeeId('');
    }
  }, [payrollRecords, selectedGroup]);

  // Selected paystub record and employee (strictly from active working records)
  const selectedRecord =
    activeWorkingRecords.find((r) => {
      if (selectedGroup !== 'ALL' && getRecGroup(r).id !== selectedGroup) return false;
      return r.employeeId === selectedEmployeeId;
    }) ||
    activeWorkingRecords.find((r) => {
      if (selectedGroup === 'ALL') return true;
      return getRecGroup(r).id === selectedGroup;
    });

  const selectedEmployee = employees.find((e) => e.employeeId === (selectedRecord?.employeeId || selectedEmployeeId));
  const selectedEmpGroup = getEmpGroup(selectedEmployee);

  // Standalone print URLs (opens top-level window/tab without iframe sandboxing)
  const getPaystubPrintUrl = (empId: string, week?: string) => {
    return `${window.location.origin}${window.location.pathname}?print=paystub&emp=${empId}&week=${week || currentWeekFriday}`;
  };

  const getPayrollRegisterPrintUrl = (week?: string, group?: string) => {
    return `${window.location.origin}${window.location.pathname}?print=payroll_register&week=${week || currentWeekFriday}&group=${group || 'ALL'}`;
  };

  const handleOpenPrintModal = (
    type: 'paystub' | 'payroll_register' = 'paystub',
    empId?: string,
    week?: string,
    grp?: string
  ) => {
    setPrintModalType(type);
    if (empId) setPrintModalTargetEmpId(empId);
    else if (!printModalTargetEmpId) setPrintModalTargetEmpId(selectedEmployeeId || employees[0]?.employeeId || '');
    if (week) setPrintModalTargetWeek(week);
    else setPrintModalTargetWeek(currentWeekFriday);
    if (grp) setPrintModalTargetGroup(grp);
    else setPrintModalTargetGroup(selectedGroup || 'ALL');
    setPrintFeedback(null);
    setIsPrintModalOpen(true);
  };

  // Direct print paystub
  const handleDirectPrintPaystub = (empId: string, week?: string) => {
    const targetWeek = week || currentWeekFriday;
    const targetEmp = empId || selectedEmployeeId;
    const printUrl = getPaystubPrintUrl(targetEmp, targetWeek);

    try {
      const a = document.createElement('a');
      a.href = printUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setPrintFeedback(
        language === 'ko'
          ? '새 탭에서 급여명세서 인쇄 페이지가 열렸습니다. 팝업이 차단된 경우 [새 창에서 열어 바로 인쇄하기] 버튼을 눌러주세요.'
          : 'Paystub opened in a new tab. If popups are blocked, click the direct button.'
      );
    } catch (err) {
      console.warn('Failed to open tab via click:', err);
    }

    if (window.self === window.top) {
      try {
        window.print();
      } catch (_) {}
    }
  };

  // Direct print payroll register
  const handleDirectPrintRegister = (week?: string, group?: string) => {
    const targetWeek = week || currentWeekFriday;
    const targetGroup = group || selectedGroup || 'ALL';
    const printUrl = getPayrollRegisterPrintUrl(targetWeek, targetGroup);

    try {
      const a = document.createElement('a');
      a.href = printUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setPrintFeedback(
        language === 'ko'
          ? '새 탭에서 급여 대장 인쇄 페이지가 열렸습니다. 팝업이 차단된 경우 [새 창에서 열어 바로 인쇄하기] 버튼을 눌러주세요.'
          : 'Payroll register opened in a new tab. If popups are blocked, click the direct button.'
      );
    } catch (err) {
      console.warn('Failed to open tab via click:', err);
    }

    if (window.self === window.top) {
      try {
        window.print();
      } catch (_) {}
    }
  };

  // Generic print handler delegator
  const handlePrint = () => {
    if (activeReportTab === 'summary') {
      handleOpenPrintModal('payroll_register', undefined, currentWeekFriday, selectedGroup);
    } else if (activeReportTab === 'historical') {
      if (historicalViewMode === 'paystub' && selectedHistoricalEmpId) {
        handleOpenPrintModal('paystub', selectedHistoricalEmpId, selectedHistoricalFriday);
      } else {
        handleOpenPrintModal('payroll_register', undefined, selectedHistoricalFriday, selectedGroup);
      }
    } else {
      handleOpenPrintModal('paystub', selectedEmployeeId, currentWeekFriday);
    }
  };

  // Download standalone printable HTML for Paystub
  const handleDownloadPaystubHtml = (rec: PayrollRecord, emp?: Employee, weekYmd?: string) => {
    const targetWeek = weekYmd || currentWeekFriday;
    const grp = getBusinessGroup(rec.businessGroup || rec.groupNumber || emp?.businessGroup || emp?.groupNumber);
    const filename = `Culmore_Paystub_${rec.employeeName.replace(/\\s+/g, '_')}_${rec.employeeId}_${targetWeek}.html`;

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Paystub - ${rec.employeeName} (${rec.employeeId})</title>
  <style>
    @page { size: portrait; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 12px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; }
    .meta { font-size: 11px; color: #475569; margin: 2px 0 0; }
    .title-badge { background: #0f172a; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold; text-align: right; display: inline-block; font-size: 11px; }
    .emp-card { margin-top: 15px; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; font-size: 11px; }
    .emp-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; }
    .emp-card .val { font-size: 12px; font-weight: bold; color: #0f172a; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
    .table-box { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .table-title { background: #f1f5f9; padding: 6px 12px; font-weight: bold; font-size: 11px; border-bottom: 1px solid #cbd5e1; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; background: #f8fafc; color: #64748b; padding: 6px 8px; font-size: 10px; border-bottom: 1px solid #e2e8f0; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .net-banner { margin-top: 16px; padding: 14px 20px; background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
    .net-title { font-size: 13px; font-weight: bold; color: #166534; }
    .net-amount { font-size: 24px; font-weight: 900; color: #14532d; }
    .footer-notes { margin-top: 16px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; color: #64748b; }
    .sig-area { margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; }
    .sig-line { display: inline-block; width: 180px; border-bottom: 1px solid #64748b; }
    .no-print { margin-bottom: 16px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0f172a; color: white; padding: 10px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <strong>MANAGEMENT OF CULMORE — 공식 급여명세서 인쇄본</strong>
    <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer;">지금 바로 인쇄 (Print)</button>
  </div>

  <div class="header">
    <div>
      <h1 class="company">${grp ? grp.name : displayStoreName}</h1>
      <p class="meta">${displayStoreName} • ${settings.address}, ${settings.city}, ${settings.state} ${settings.zipCode}</p>
      <p class="meta">Phone: ${settings.phone} • Employer EIN: ${settings.ein}</p>
    </div>
    <div style="text-align: right;">
      <div class="title-badge">OFFICIAL PAYROLL STATEMENT</div>
      <p class="meta" style="font-weight: bold; margin-top: 4px;">Pay Date: ${targetWeek} (Friday)</p>
      <p class="meta">Period: ${formatWorkWeekRange(targetWeek, 'en')}</p>
    </div>
  </div>

  <div class="emp-card">
    <div><div class="label">Employee Name</div><div class="val">${rec.employeeName}</div></div>
    <div><div class="label">Employee ID</div><div class="val">${rec.employeeId}</div></div>
    <div><div class="label">Branch / Group</div><div class="val">${grp.name}</div></div>
    <div><div class="label">Department / Role</div><div class="val">${rec.department} • ${rec.position}</div></div>
    <div><div class="label">Hourly Rate</div><div class="val" style="color: #047857;">$${rec.hourlyWage.toFixed(2)}/hr</div></div>
  </div>

  <div class="grid">
    <div class="table-box">
      <div class="table-title">EARNINGS SUMMARY</div>
      <table>
        <thead><tr><th>Description</th><th class="text-right">Hours</th><th class="text-right">Rate</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          <tr><td>Regular Pay (기본)</td><td class="text-right">${rec.regularHours.toFixed(2)}h</td><td class="text-right">$${rec.hourlyWage.toFixed(2)}</td><td class="text-right font-bold">$${rec.regularPay.toFixed(2)}</td></tr>
          <tr><td>Overtime Pay (1.5x)</td><td class="text-right">${rec.overtimeHours.toFixed(2)}h</td><td class="text-right">$${(rec.hourlyWage * 1.5).toFixed(2)}</td><td class="text-right font-bold">$${rec.overtimePay.toFixed(2)}</td></tr>
          <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;"><td>GROSS EARNINGS</td><td class="text-right">${(rec.regularHours + rec.overtimeHours).toFixed(2)}h</td><td></td><td class="text-right font-bold">$${rec.grossPay.toFixed(2)}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="table-box">
      <div class="table-title">TAXES & DEDUCTIONS</div>
      <table>
        <thead><tr><th>Deduction Item</th><th class="text-right">Rate / Basis</th><th class="text-right">Withheld Amount</th></tr></thead>
        <tbody>
          <tr><td>Federal Withholding (연방소득세)</td><td class="text-right">IRS Pub 15-T</td><td class="text-right" style="color: #b91c1c;">-$${rec.federalWithholding.toFixed(2)}</td></tr>
          <tr><td>Virginia State Tax (VA 주소득세)</td><td class="text-right">VA 5.75% bracket</td><td class="text-right" style="color: #b91c1c;">-$${rec.vaWithholding.toFixed(2)}</td></tr>
          <tr><td>Social Security Tax (사회보장세)</td><td class="text-right">6.20%</td><td class="text-right" style="color: #b91c1c;">-$${rec.socialSecurityTax.toFixed(2)}</td></tr>
          <tr><td>Medicare Tax (메디케어)</td><td class="text-right">1.45%</td><td class="text-right" style="color: #b91c1c;">-$${rec.medicareTax.toFixed(2)}</td></tr>
          ${(rec.insuranceDeduction + rec.otherDeductions) > 0 ? `<tr><td>Insurance / Other Deductions</td><td class="text-right">Pre/Post tax</td><td class="text-right" style="color: #b91c1c;">-$${(rec.insuranceDeduction + rec.otherDeductions).toFixed(2)}</td></tr>` : ''}
          <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;"><td>TOTAL TAXES & DEDUCTIONS</td><td></td><td class="text-right" style="color: #b91c1c; font-weight: bold;">-$${rec.totalTaxes.toFixed(2)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-banner">
    <div>
      <div class="net-title">NET PAY (실지급액) — Friday Disbursement</div>
      <div style="font-size: 11px; color: #166534; margin-top: 2px;">Gross Pay ($${rec.grossPay.toFixed(2)}) - Total Deductions ($${rec.totalTaxes.toFixed(2)})</div>
    </div>
    <div class="net-amount">$${rec.netPay.toFixed(2)}</div>
  </div>

  <div class="footer-notes">
    <strong>Notice to Employee:</strong> This statement complies with Virginia Code § 40.1-29 and the Fair Labor Standards Act (FLSA). It itemizes hours worked, hourly rates of pay, gross earnings, and all deductions for the stated weekly pay period.
  </div>

  <div class="sig-area">
    <div>Employer Representative: <span class="sig-line"></span></div>
    <div>Employee Acknowledgement: <span class="sig-line"></span></div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download standalone printable HTML for Weekly Payroll Register
  const handleDownloadRegisterHtml = (weekYmd: string, targetGroup: string, recsList: PayrollRecord[]) => {
    const targetRecords = recsList.filter((r) => {
      if (targetGroup === 'ALL') return true;
      return getRecGroup(r).id === targetGroup;
    });

    const grpObj = targetGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === targetGroup) : null;
    const grpName = grpObj ? grpObj.shortName.replace(/\\s+/g, '_') : 'All_Branches';
    const filename = `Culmore_Payroll_Register_${grpName}_${weekYmd}.html`;

    const totalRegHours = targetRecords.reduce((s, r) => s + r.regularHours, 0);
    const totalOtHours = targetRecords.reduce((s, r) => s + r.overtimeHours, 0);
    const totalGross = targetRecords.reduce((s, r) => s + r.grossPay, 0);
    const totalFed = targetRecords.reduce((s, r) => s + r.federalWithholding, 0);
    const totalVa = targetRecords.reduce((s, r) => s + r.vaWithholding, 0);
    const totalFica = targetRecords.reduce((s, r) => s + (r.socialSecurityTax + r.medicareTax), 0);
    const totalTaxes = targetRecords.reduce((s, r) => s + r.totalTaxes, 0);
    const totalNet = targetRecords.reduce((s, r) => s + r.netPay, 0);

    const rowsHtml = targetRecords.map((r, idx) => {
      const g = getRecGroup(r);
      return `<tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>${r.employeeName}</strong></td>
        <td>${r.employeeId}</td>
        <td>${g.shortName}</td>
        <td>${r.department}</td>
        <td style="text-align: right;">$${r.hourlyWage.toFixed(2)}</td>
        <td style="text-align: right;">${r.regularHours.toFixed(1)}</td>
        <td style="text-align: right;">${r.overtimeHours > 0 ? '+' + r.overtimeHours.toFixed(1) : '-'}</td>
        <td style="text-align: right; font-weight: bold;">$${r.grossPay.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${r.federalWithholding.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${r.vaWithholding.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${(r.socialSecurityTax + r.medicareTax).toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c; font-weight: bold;">$${r.totalTaxes.toFixed(2)}</td>
        <td style="text-align: right; font-weight: 900; color: #047857;">$${r.netPay.toFixed(2)}</td>
        <td style="border-bottom: 1px solid #cbd5e1; min-width: 80px;"></td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Payroll Register - ${weekYmd}</title>
  <style>
    @page { size: landscape; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 15px; font-size: 11px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .company { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0; }
    .meta { font-size: 10px; color: #475569; margin: 2px 0 0; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; }
    .card-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; }
    .card-val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0f172a; color: white; padding: 6px 4px; text-align: left; font-size: 9px; text-transform: uppercase; }
    td { padding: 5px 4px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; }
    tfoot td { background: #f1f5f9; font-weight: 900; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
    .no-print { margin-bottom: 12px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="background: #0f172a; color: white; padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <strong>MANAGEMENT OF CULMORE — 공식 주간 급여 대장 (Payroll Register)</strong>
    <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 5px 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">지금 바로 인쇄 (Print)</button>
  </div>

  <div class="header">
    <div>
      <h1 class="company">${displayStoreName}</h1>
      <p class="meta">4210 John Marr Dr, Annandale, VA 22003 • EIN: ${settings.ein} • Phone: ${settings.phone}</p>
      <p class="meta" style="font-weight: bold; color: #047857; margin-top: 3px;">
        공식 주간 급여 대장 (Weekly Payroll Summary Register) — ${grpObj ? grpObj.name : '전체 5개 사업장 (All Branches)'}
      </p>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 900; font-size: 12px;">지급일 (Pay Date): ${weekYmd} (금요일)</div>
      <div class="meta">급여 정산 기간: ${formatWorkWeekRange(weekYmd, 'ko')}</div>
      <div class="meta">출력일자: ${new Date().toLocaleDateString('ko-KR')}</div>
    </div>
  </div>

  <div class="summary-cards">
    <div class="card"><div class="card-label">대상 인원</div><div class="card-val">${targetRecords.length}명</div></div>
    <div class="card"><div class="card-label">총 지급액 (Gross)</div><div class="card-val">$${totalGross.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">총 공제액 (Taxes)</div><div class="card-val" style="color: #b91c1c;">-$${totalTaxes.toFixed(2)}</div></div>
    <div class="card"><div class="card-label">총 실지급액 (Net)</div><div class="card-val" style="color: #047857;">$${totalNet.toFixed(2)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">No</th>
        <th>직원명</th>
        <th>사번</th>
        <th>사업장</th>
        <th>부서</th>
        <th style="text-align: right;">시급</th>
        <th style="text-align: right;">기본h</th>
        <th style="text-align: right;">연장h</th>
        <th style="text-align: right;">총급여(Gross)</th>
        <th style="text-align: right;">연방세</th>
        <th style="text-align: right;">주소득세</th>
        <th style="text-align: right;">FICA세</th>
        <th style="text-align: right;">공제합계</th>
        <th style="text-align: right;">실지급액(Net)</th>
        <th>수령인 서명</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="font-family: sans-serif; text-transform: uppercase;">합계 (TOTAL - ${targetRecords.length}명)</td>
        <td></td>
        <td style="text-align: right;">${totalRegHours.toFixed(1)}h</td>
        <td style="text-align: right;">${totalOtHours.toFixed(1)}h</td>
        <td style="text-align: right;">$${totalGross.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${totalFed.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${totalVa.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${totalFica.toFixed(2)}</td>
        <td style="text-align: right; color: #b91c1c;">$${totalTaxes.toFixed(2)}</td>
        <td style="text-align: right; color: #047857; font-size: 11px;">$${totalNet.toFixed(2)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #475569;">
    <div>급여 작성자: __________________________ (서명)</div>
    <div>총괄 매니저 승인: __________________________ (서명)</div>
    <div>대표자 승인: __________________________ (서명)</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (payrollRecords.length === 0) return;

    const headers = [
      'Store Name',
      'EIN',
      'Pay Period Start',
      'Pay Period End',
      'Employee ID',
      'Employee Name',
      'Department',
      'Position',
      'Hourly Wage ($)',
      'Regular Hours',
      'Overtime Hours',
      'Regular Pay ($)',
      'Overtime Pay ($)',
      'Gross Pay ($)',
      'Federal Withholding ($)',
      'Virginia State Withholding ($)',
      'Social Security Tax 6.2% ($)',
      'Medicare Tax 1.45% ($)',
      'Total Taxes ($)',
      'Other Deductions ($)',
      'Net Pay ($)',
    ];

    const rows = payrollRecords.map((r) => [
      `"${settings.storeName}"`,
      settings.ein,
      payrollPeriod?.weekStartDate || currentWeekFriday,
      payrollPeriod?.weekEndDate || '',
      r.employeeId,
      `"${r.employeeName}"`,
      `"${r.department}"`,
      `"${r.position}"`,
      r.hourlyWage.toFixed(2),
      r.regularHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      r.regularPay.toFixed(2),
      r.overtimePay.toFixed(2),
      r.grossPay.toFixed(2),
      r.federalWithholding.toFixed(2),
      r.vaWithholding.toFixed(2),
      r.socialSecurityTax.toFixed(2),
      r.medicareTax.toFixed(2),
      r.totalTaxes.toFixed(2),
      (r.insuranceDeduction + r.otherDeductions).toFixed(2),
      r.netPay.toFixed(2),
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Culmore_Paystub_Report_${currentWeekFriday}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered employees for Paystub view: strictly limited to employees who actually worked / have payroll in this period
  const displayedEmployeesForPaystub = employees.filter((emp) => {
    // 1. Must have an active working payroll record with hours/pay
    const rec = activeWorkingRecords.find((r) => r.employeeId === emp.employeeId);
    if (!rec) return false;

    // 2. Must match selected business group
    const grp = getRecGroup(rec);
    if (selectedGroup !== 'ALL' && grp.id !== selectedGroup) return false;

    // 3. Search query filter
    if (paystubSearchTerm.trim()) {
      const q = paystubSearchTerm.toLowerCase();
      const mName = emp.fullName.toLowerCase().includes(q);
      const mKo = (emp.fullNameKo || '').toLowerCase().includes(q);
      const mId = emp.employeeId.toLowerCase().includes(q);
      const mPos = emp.position.toLowerCase().includes(q);
      const mDept = emp.department.toLowerCase().includes(q);
      if (!mName && !mKo && !mId && !mPos && !mDept) return false;
    }
    return true;
  });

  const filteredRecords = payrollRecords.filter((r) => {
    const term = searchFilter.toLowerCase();
    return (
      r.employeeName.toLowerCase().includes(term) ||
      r.employeeId.toLowerCase().includes(term) ||
      r.department.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-navigation (hidden during print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('reportsTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ko'
              ? '개별 직원 주간 급여명세서(Paystub) 출력, 사업장별 종합 급여 보고서, 회계용 CSV 내보내기'
              : 'Individual printable pay vouchers, branch-specific weekly summaries, Excel CSV exports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direct One-Click New-Tab Print Link (100% bypasses iframe sandbox) */}
          {activeReportTab === 'paystub' && selectedEmployeeId && (
            <a
              href={getPaystubPrintUrl(selectedEmployeeId, currentWeekFriday)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title={language === 'ko' ? '새 창에서 급여명세서를 바로 인쇄합니다' : 'Print Paystub in New Tab'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'ko' ? '명세서 바로 인쇄 (새 창)' : 'Print Paystub'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          )}

          {activeReportTab === 'summary' && (
            <a
              href={getPayrollRegisterPrintUrl(currentWeekFriday, selectedGroup)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title={language === 'ko' ? '새 창에서 주간 급여 대장을 바로 인쇄합니다' : 'Print Register in New Tab'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'ko' ? '급여 대장 인쇄 (새 창)' : 'Print Register'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          )}

          {activeReportTab === 'historical' && (
            <a
              href={getPayrollRegisterPrintUrl(selectedHistoricalFriday, selectedGroup)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title={language === 'ko' ? '선택 주차 급여 대장을 새 창에서 바로 인쇄합니다' : 'Print Historical Register in New Tab'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === 'ko' ? '선택 주차 대장 인쇄 (새 창)' : 'Print Week Register'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          )}

          {/* Sync with Schedule and Employee Wages button */}
          {onSyncWithSchedule && (
            <button
              type="button"
              onClick={onSyncWithSchedule}
              className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
              title={language === 'ko' ? '직원관리의 최신 시급 및 주간 스케줄의 근무시간을 급여명세서와 실시간 동기화합니다' : 'Sync latest schedule hours & staff wages with paystubs'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
              <span>{language === 'ko' ? '스케줄·시급 실시간 동기화' : 'Sync Schedule & Staff'}</span>
            </button>
          )}

          {/* Open Print & Export Modal Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={language === 'ko' ? '인쇄 옵션 및 HTML 다운로드 창 열기' : 'Print Options & Export'}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>{language === 'ko' ? '인쇄 옵션 / 다운로드' : 'Print Options'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t('exportPaystubsCsv')}</span>
          </button>
        </div>
      </div>

      {/* Report Tabs (hidden during print) */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 no-print">
        <button
          onClick={() => setActiveReportTab('paystub')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReportTab === 'paystub'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('paystubTitle')}
        </button>

        <button
          onClick={() => setActiveReportTab('summary')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReportTab === 'summary'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('summaryReportTitle')}
        </button>

        <button
          onClick={() => setActiveReportTab('historical')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeReportTab === 'historical'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('historicalSearch')}
        </button>
      </div>

      {/* Business Group Tabs Bar (Divided by Group for Paystub & Reports) - Hidden during print */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2 no-print">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {language === 'ko' ? '사업장 그룹별 보기 및 필터링' : 'Filter by Business Group'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {language === 'ko' ? '원하는 사업장을 선택하면 해당 그룹 소속 직원만 필터링됩니다.' : 'Select a group to isolate staff & reports.'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {/* ALL Groups Button */}
          <button
            type="button"
            onClick={() => handleSelectGroup('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 border ${
              selectedGroup === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{language === 'ko' ? '🏢 전체 사업장 (All 5)' : '🏢 All 5 Branches'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              selectedGroup === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {employees.length}명
            </span>
            <span className={`text-[10px] font-mono font-bold ${
              selectedGroup === 'ALL' ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              ({formatCurrency(grandTotalNet)})
            </span>
          </button>

          {/* 5 Group Tabs */}
          {groupMetrics.map((grp) => {
            const isSelected = selectedGroup === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                onClick={() => handleSelectGroup(grp.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 border ${
                  isSelected
                    ? `${grp.badgeBg} ring-2 ring-emerald-600 shadow-xs font-black`
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black bg-white/80 border border-slate-300 text-slate-700">
                  <Store className="w-3 h-3 text-emerald-700" />
                </span>
                <span>{grp.shortName}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  isSelected ? 'bg-white/60 text-slate-900' : 'bg-slate-100 text-slate-600'
                }`}>
                  {grp.empCount}명
                </span>
                {grp.totalNet > 0 && (
                  <span className="text-[10px] font-mono font-bold text-emerald-800">
                    {formatCurrency(grp.totalNet)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: INDIVIDUAL EMPLOYEE PAYSTUB */}
      {activeReportTab === 'paystub' && (
        <div className="space-y-4">
          {/* Employee Selector Bar & Quick Pick Chips (no-print) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
            {/* Top row: search filter, dropdown selector, workweek label */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs flex-1">
                {/* Search input */}
                <div className="relative min-w-[200px] max-w-[280px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={paystubSearchTerm}
                    onChange={(e) => setPaystubSearchTerm(e.target.value)}
                    placeholder={language === 'ko' ? '직원명, ID, 파트 검색...' : 'Search staff by name, ID...'}
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-500"
                  />
                  {paystubSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setPaystubSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Grouped Select Dropdown */}
                <div className="flex items-center space-x-1.5 flex-1 max-w-md">
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500"
                  >
                    {displayedEmployeesForPaystub.length === 0 ? (
                      <option value="" disabled>
                        {language === 'ko'
                          ? '해당 조건에 부합하는 급여명세서 대상 직원이 없습니다.'
                          : 'No eligible payroll records found.'}
                      </option>
                    ) : selectedGroup === 'ALL' ? (
                      BUSINESS_GROUPS.map((grp) => {
                        const groupEmps = displayedEmployeesForPaystub.filter(
                          (e) => getEmpGroup(e).id === grp.id
                        );
                        if (groupEmps.length === 0) return null;
                        return (
                          <optgroup key={grp.id} label={`🏢 ${grp.name}`}>
                            {groupEmps.map((emp) => {
                              const isCashier = isCashierEmployee(emp.department, emp.position);
                              return (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                  {emp.fullName} {emp.fullNameKo ? `(${emp.fullNameKo})` : ''} [{emp.employeeId}] — {emp.position} ({isCashier ? '캐셔' : '일반'})
                                </option>
                              );
                            })}
                          </optgroup>
                        );
                      })
                    ) : (
                      displayedEmployeesForPaystub.map((emp) => {
                        const grp = getEmpGroup(emp);
                        const isCashier = isCashierEmployee(emp.department, emp.position);
                        return (
                          <option key={emp.employeeId} value={emp.employeeId}>
                            [{grp.shortName}] {emp.fullName} {emp.fullNameKo ? `(${emp.fullNameKo})` : ''} [{emp.employeeId}] — {emp.position} ({isCashier ? '캐셔' : '일반'})
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono">
                  Workweek: {formatWorkWeekRange(currentWeekFriday, language)}
                </span>
              </div>
            </div>
          </div>

          {/* Paystub Quick Print Action Bar */}
          {selectedRecord && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-2xl shadow-sm no-print max-w-4xl mx-auto">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-bold">
                  {selectedRecord.employeeName} ({selectedRecord.employeeId})
                </span>
                <span className="text-[11px] text-slate-300 font-mono hidden sm:inline">
                  • {formatWorkWeekRange(currentWeekFriday, 'en')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 100% Guaranteed Top-Level New Tab Print Button */}
                <a
                  href={getPaystubPrintUrl(selectedRecord.employeeId, currentWeekFriday)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="새 창에서 열어 브라우저 인쇄 창을 바로 띄웁니다"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? '지금 바로 인쇄하기 (새 창)' : 'Print Paystub (New Tab)'}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                {/* Download Standalone HTML */}
                <button
                  type="button"
                  onClick={() => handleDownloadPaystubHtml(selectedRecord, selectedEmployee, currentWeekFriday)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="오프라인 보관 및 인쇄용 HTML 파일 다운로드"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">{language === 'ko' ? 'HTML 다운로드' : 'Download HTML'}</span>
                </button>

                {/* Print Options */}
                <button
                  type="button"
                  onClick={() => handleOpenPrintModal('paystub', selectedRecord.employeeId, currentWeekFriday)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title="인쇄 옵션 및 안내"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">{language === 'ko' ? '옵션' : 'Options'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Printable Official Paystub Document */}
          {selectedRecord ? (
            <div className="bg-white p-8 rounded-2xl border-2 border-slate-300 shadow-md max-w-4xl mx-auto printable-document">
              {/* Store & Paystub Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {selectedEmpGroup ? selectedEmpGroup.name : displayStoreName}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium">
                    {displayStoreName} • {selectedEmpGroup?.name || displayStoreNameKo} • {settings.address}, {settings.city}, {settings.state} {settings.zipCode}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Phone: {settings.phone} • Employer EIN: {settings.ein}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs uppercase">
                    Payroll Statement
                  </span>
                  <p className="text-xs text-slate-600 mt-1 font-semibold">
                    Pay Date: Friday disbursement
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Period: {formatWorkWeekRange(currentWeekFriday, 'en')}
                  </p>
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedRecord.employeeName}</span>
                  {selectedEmployee?.fullNameKo && (
                    <span className="text-slate-500 block text-[11px]">{selectedEmployee.fullNameKo}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee ID</span>
                  <span className="font-bold text-slate-800">{selectedRecord.employeeId}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Branch / Group</span>
                  <span className="font-bold text-slate-900 block truncate">
                    {getBusinessGroup(selectedRecord.businessGroup || selectedRecord.groupNumber || selectedEmployee?.businessGroup || selectedEmployee?.groupNumber).name}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {getBusinessGroup(selectedRecord.businessGroup || selectedRecord.groupNumber || selectedEmployee?.businessGroup || selectedEmployee?.groupNumber).shortName}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Department / Role</span>
                  <span className="font-bold text-slate-800">{selectedRecord.department}</span>
                  <span className="text-[10px] text-slate-500 block">{selectedRecord.position}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Hourly Rate</span>
                  <span className="font-bold text-emerald-700 text-sm">${selectedRecord.hourlyWage.toFixed(2)}/hr</span>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Earnings Section */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    {t('earningsSummary')}
                  </div>
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-2 text-right">Hours</th>
                        <th className="py-2 px-2 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">Regular Pay (≤40h)</td>
                        <td className="py-2.5 px-2 text-right">{selectedRecord.regularHours.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right">${selectedRecord.hourlyWage.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(selectedRecord.regularPay)}
                        </td>
                      </tr>
                      {selectedRecord.overtimeHours > 0 && (
                        <tr className="bg-amber-50/50">
                          <td className="py-2.5 px-3 font-semibold text-amber-900">Overtime Pay (1.5x)</td>
                          <td className="py-2.5 px-2 text-right font-bold text-amber-800">
                            {selectedRecord.overtimeHours.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            ${(selectedRecord.hourlyWage * 1.5).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-900">
                            {formatCurrency(selectedRecord.overtimePay)}
                          </td>
                        </tr>
                      )}
                      {/* Individual Registered Adjustments itemized in Earnings Table */}
                      {selectedRecord.adjustments && selectedRecord.adjustments.length > 0 ? (
                        selectedRecord.adjustments.map((adj, idx) => (
                          <tr key={adj.id || idx} className="bg-blue-50/70 border-t border-blue-100">
                            <td className="py-2.5 px-3 text-blue-950 font-medium">
                              <div className="flex items-center space-x-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-200 text-blue-900">
                                  {language === 'ko' ? '급여 조정' : 'ADJUSTMENT'}
                                </span>
                                <span className="font-bold text-slate-900">{adj.reason}</span>
                              </div>
                              <div className="text-[10px] text-blue-700 mt-0.5 font-sans">
                                {adj.timestamp?.slice(0, 10)} • Auth: {adj.adminEmail}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-400 font-mono">-</td>
                            <td className="py-2.5 px-2 text-right text-slate-400 font-mono">-</td>
                            <td className={`py-2.5 px-3 text-right font-bold font-mono ${adj.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {adj.amount >= 0 ? `+${formatCurrency(adj.amount)}` : `-${formatCurrency(Math.abs(adj.amount))}`}
                            </td>
                          </tr>
                        ))
                      ) : selectedRecord.isAdjusted ? (
                        <tr className="bg-blue-50/70 border-t border-blue-100">
                          <td className="py-2.5 px-3 font-semibold text-blue-900" colSpan={3}>
                            {language === 'ko' ? '급여 조정 및 특별 수당' : 'Adjustments & Discretionary'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-blue-900 font-mono">
                            {formatCurrency(
                              selectedRecord.grossPay -
                                (selectedRecord.regularPay + selectedRecord.overtimePay)
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 uppercase text-[11px]">Total Gross Earnings</td>
                        <td className="py-2.5 px-3 text-right text-sm">
                          {formatCurrency(selectedRecord.grossPay)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Deductions Section */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>{t('deductionsSummary')}</span>
                      {selectedRecord.isManualTax && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {language === 'ko' ? '직접 입력 공제 적용' : 'Manual Tax'}
                        </span>
                      )}
                    </div>
                    {onSavePaymentAndTaxes && (
                      <button
                        type="button"
                        onClick={() => handleOpenPaystubTaxModal(selectedRecord)}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{language === 'ko' ? '세금공제 직접 입력/수정' : 'Edit Tax Deductions'}</span>
                      </button>
                    )}
                  </div>
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-2 text-right">Rate / Basis</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 px-3 text-slate-700">Federal Withholding (FIT)</td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {selectedRecord.withholdFederal !== false ? `${settings.federalTaxDefaultRate}% est.` : 'Exempt ($0)'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(selectedRecord.federalWithholding)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-700">Virginia State Income Tax (SIT)</td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {selectedRecord.withholdVirginia !== false ? `${settings.vaTaxDefaultRate}% standard` : 'Exempt ($0)'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(selectedRecord.vaWithholding)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-700">FICA Social Security (OASDI)</td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {selectedRecord.withholdSocialSecurity !== false ? `${settings.socialSecurityRate}% law` : 'Exempt ($0)'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(selectedRecord.socialSecurityTax)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-700">FICA Medicare (Hospital)</td>
                        <td className="py-2 px-2 text-right text-slate-500">
                          {selectedRecord.withholdMedicare !== false ? `${settings.medicareRate}% law` : 'Exempt ($0)'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(selectedRecord.medicareTax)}
                        </td>
                      </tr>
                      {(selectedRecord.insuranceDeduction > 0 || selectedRecord.otherDeductions > 0) && (
                        <tr>
                          <td className="py-2 px-3 text-slate-700">Insurance & Voluntary</td>
                          <td className="py-2 px-2 text-right text-slate-500">Plan</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(selectedRecord.insuranceDeduction + selectedRecord.otherDeductions)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-rose-800">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">Total Deductions</td>
                        <td className="py-2.5 px-3 text-right text-sm">
                          -{formatCurrency(selectedRecord.totalDeductions)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Registered Adjustments Detail Banner on Paystub */}
              {((selectedRecord.adjustments && selectedRecord.adjustments.length > 0) || selectedRecord.isAdjusted) && (
                <div className="mt-6 p-4 rounded-xl bg-blue-50/90 border border-blue-200 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200 mb-2.5">
                    <div className="flex items-center space-x-2 text-blue-900 font-bold">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span className="uppercase tracking-wider text-[11px]">
                        {language === 'ko' ? '등록된 급여 조정 내역 (Adjustments Audit Detail)' : 'Registered Payroll Adjustments Audit Detail'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-200/70 text-blue-800 text-[10px] font-bold">
                      {selectedRecord.adjustments?.length || 1} Item(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedRecord.adjustments && selectedRecord.adjustments.length > 0 ? (
                      selectedRecord.adjustments.map((adj, i) => (
                        <div key={adj.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-2.5 rounded-lg border border-blue-100 gap-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                              #{i + 1}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{adj.reason}</p>
                              <p className="text-[10px] text-slate-500">
                                {adj.timestamp?.slice(0, 10)} • Authorized by: {adj.adminEmail}
                              </p>
                            </div>
                          </div>
                          <div className="text-right font-mono font-black text-sm">
                            <span className={adj.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {adj.amount >= 0 ? `+${formatCurrency(adj.amount)}` : `-${formatCurrency(Math.abs(adj.amount))}`}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="font-bold text-slate-800">
                          {language === 'ko' ? '관리자 수기 조정 반영' : 'Manual Discretionary Adjustment'}
                        </span>
                        <span className="font-mono font-bold text-blue-800">
                          {formatCurrency(selectedRecord.grossPay - (selectedRecord.regularPay + selectedRecord.overtimePay))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Net Pay Grand Total Banner with Real-time KRW Equivalent */}
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase font-extrabold text-emerald-900 tracking-wider block">
                    {t('netPaySummary')} (Take-Home Disbursement)
                  </span>
                  <span className="text-xs text-emerald-700">
                    Gross Earnings ${selectedRecord.grossPay.toFixed(2)} minus Total Deductions ${selectedRecord.totalDeductions.toFixed(2)}
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-3xl font-black text-emerald-900 font-mono block">
                    {formatCurrency(selectedRecord.netPay)}
                  </span>
                  {usdToKrwRate > 0 && (
                    <span className="text-xs font-mono font-bold text-emerald-700 inline-block mt-0.5">
                      ≈ ₩{Math.round(selectedRecord.netPay * usdToKrwRate).toLocaleString()} <span className="text-[10px] text-emerald-600 font-normal">(실시간 환율 $1 = ₩{usdToKrwRate.toFixed(1)})</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Signature Line */}
              <div className="mt-10 pt-6 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
                <p>{t('employeeSignature')}</p>
                <p className="font-mono text-[10px]">Document generated by MANAGEMENT OF CULMORE Admin System</p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
              {language === 'ko'
                ? '선택된 직원의 급여 데이터가 없습니다. 먼저 급여 탭에서 주간 급여를 정산해주세요.'
                : 'No payroll record generated for this employee yet. Please compile payroll in the Payroll tab first.'}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STORE-WIDE / GROUP WEEKLY PAYROLL SUMMARY */}
      {activeReportTab === 'summary' && (() => {
        const displayedSummaryRecords = activeWorkingRecords.filter((r) => {
          if (selectedGroup === 'ALL') return true;
          return getRecGroup(r).id === selectedGroup;
        });

        const sumRegHours = displayedSummaryRecords.reduce((sum, r) => sum + r.regularHours, 0);
        const sumOtHours = displayedSummaryRecords.reduce((sum, r) => sum + r.overtimeHours, 0);
        const sumGross = displayedSummaryRecords.reduce((sum, r) => sum + r.grossPay, 0);
        const sumTaxes = displayedSummaryRecords.reduce((sum, r) => sum + r.totalTaxes, 0);
        const sumNet = displayedSummaryRecords.reduce((sum, r) => sum + r.netPay, 0);

        return (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <span>{t('summaryReportTitle')}</span>
                    {selectedGroup !== 'ALL' && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getBusinessGroup(selectedGroup).badgeBg}`}>
                        {getBusinessGroup(selectedGroup).name}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Workweek: {formatWorkWeekRange(currentWeekFriday, language)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={getPayrollRegisterPrintUrl(currentWeekFriday, selectedGroup)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title={language === 'ko' ? '주간 급여 대장을 새 창에서 바로 인쇄합니다' : 'Print Weekly Payroll Register'}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ko' ? '급여 대장 인쇄 (새 창)' : 'Print Register'}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDownloadRegisterHtml(currentWeekFriday, selectedGroup, payrollRecords)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                    title={language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download Printable HTML'}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">HTML</span>
                  </button>

                  <span className="font-mono font-bold text-slate-600 hidden sm:inline">
                    {displayedSummaryRecords.length} staff
                  </span>
                  <span className="font-mono font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    Net Total: {formatCurrency(sumNet)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">{t('employeeId')}</th>
                      <th className="py-2.5 px-3">{t('fullName')}</th>
                      <th className="py-2.5 px-3">{language === 'ko' ? '사업장/그룹' : 'Business Group'}</th>
                      <th className="py-2.5 px-3">{t('department')}</th>
                      <th className="py-2.5 px-2 text-right">{t('tableRegHours')}</th>
                      <th className="py-2.5 px-2 text-right">{t('tableOtHours')}</th>
                      <th className="py-2.5 px-3 text-right">{t('tableGrossPay')}</th>
                      <th className="py-2.5 px-3 text-right">{t('tableTotalTaxes')}</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950 font-black">
                        {t('tableNetPay')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {displayedSummaryRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                          {language === 'ko'
                            ? '선택된 사업장 그룹에 정산된 급여 데이터가 없습니다.'
                            : 'No payroll records found for this business group.'}
                        </td>
                      </tr>
                    ) : (
                      displayedSummaryRecords.map((r) => {
                        const emp = employees.find((e) => e.employeeId === r.employeeId);
                        const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
                        const isCashier = isCashierEmployee(r.department, r.position);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{r.employeeId}</td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                              <div className="flex items-center space-x-1.5">
                                <span>{r.employeeName}</span>
                                {isCashier && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    캐셔
                                  </span>
                                )}
                                {r.isAdjusted && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800" title="Has registered adjustments">
                                    {language === 'ko' ? '조정' : 'Adj'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${grp.badgeBg}`}>
                                {grp.shortName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600">{r.department}</td>
                            <td className="py-2.5 px-2 text-right text-slate-800">{r.regularHours.toFixed(1)}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                              {r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(r.grossPay)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-700">
                              {formatCurrency(r.totalTaxes)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black bg-emerald-50 text-emerald-800 text-sm">
                              {formatCurrency(r.netPay)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {displayedSummaryRecords.length > 0 && (
                    <tfoot className="bg-slate-100/80 font-bold border-t-2 border-slate-300 font-mono text-slate-900">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 uppercase font-sans font-black text-xs text-slate-800">
                          {selectedGroup === 'ALL'
                            ? (language === 'ko' ? '전체 사업장 합계 (Total 5 Branches)' : 'Grand Total (All Branches)')
                            : `${getBusinessGroup(selectedGroup).shortName} 소계 (Subtotal)`}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-900">{sumRegHours.toFixed(1)}</td>
                        <td className="py-3 px-2 text-right text-amber-800">
                          {sumOtHours > 0 ? `+${sumOtHours.toFixed(1)}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900">{formatCurrency(sumGross)}</td>
                        <td className="py-3 px-3 text-right text-rose-800">{formatCurrency(sumTaxes)}</td>
                        <td className="py-3 px-3 text-right font-black bg-emerald-100/80 text-emerald-950 text-sm">
                          {formatCurrency(sumNet)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 3: HISTORICAL PAYROLL RECORDS BY PAY DATE */}
      {activeReportTab === 'historical' && (() => {
        // Filter historical records by selected business group & search
        const displayedHistoricalRecords = historicalRecords.filter((r) => {
          const hasWork =
            r.regularHours > 0 ||
            r.overtimeHours > 0 ||
            r.grossPay > 0 ||
            (r.adjustments && r.adjustments.length > 0);
          if (!hasWork) return false;

          if (selectedGroup !== 'ALL') {
            const emp = employees.find((e) => e.employeeId === r.employeeId);
            const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
            if (grp.id !== selectedGroup) return false;
          }
          if (searchFilter.trim()) {
            const term = searchFilter.toLowerCase();
            const mName = r.employeeName.toLowerCase().includes(term);
            const mId = r.employeeId.toLowerCase().includes(term);
            const mDept = r.department.toLowerCase().includes(term);
            const mPos = (r.position || '').toLowerCase().includes(term);
            if (!mName && !mId && !mDept && !mPos) return false;
          }
          return true;
        });

        // Historical subtotal metrics
        const histRegHours = displayedHistoricalRecords.reduce((sum, r) => sum + r.regularHours, 0);
        const histOtHours = displayedHistoricalRecords.reduce((sum, r) => sum + r.overtimeHours, 0);
        const histGross = displayedHistoricalRecords.reduce((sum, r) => sum + r.grossPay, 0);
        const histTaxes = displayedHistoricalRecords.reduce((sum, r) => sum + r.totalTaxes, 0);
        const histNet = displayedHistoricalRecords.reduce((sum, r) => sum + r.netPay, 0);

        // Selected single historical paystub
        const histRecord = historicalRecords.find((r) => r.employeeId === selectedHistoricalEmpId);
        const histEmployee = employees.find((e) => e.employeeId === selectedHistoricalEmpId);
        const histEmpGroup = getEmpGroup(histEmployee);

        const handleExportHistoricalCsv = () => {
          if (historicalRecords.length === 0) return;

          const headers = [
            'Store Name',
            'EIN',
            'Pay Period Start (Friday)',
            'Pay Period End (Thursday)',
            'Pay Date',
            'Employee ID',
            'Employee Name',
            'Business Group',
            'Department',
            'Position',
            'Hourly Wage ($)',
            'Regular Hours',
            'Overtime Hours',
            'Regular Pay ($)',
            'Overtime Pay ($)',
            'Gross Pay ($)',
            'Federal Withholding ($)',
            'Virginia State Withholding ($)',
            'Social Security Tax 6.2% ($)',
            'Medicare Tax 1.45% ($)',
            'Total Taxes ($)',
            'Other Deductions ($)',
            'Net Pay ($)',
          ];

          const rows = historicalRecords.map((r) => {
            const emp = employees.find((e) => e.employeeId === r.employeeId);
            const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
            return [
              `"${settings.storeName}"`,
              settings.ein,
              selectedHistoricalFriday,
              historicalPeriod?.weekEndDate || getWorkWeekThursday(selectedHistoricalFriday),
              selectedHistoricalFriday,
              r.employeeId,
              `"${r.employeeName}"`,
              `"${grp.name}"`,
              `"${r.department}"`,
              `"${r.position}"`,
              r.hourlyWage.toFixed(2),
              r.regularHours.toFixed(2),
              r.overtimeHours.toFixed(2),
              r.regularPay.toFixed(2),
              r.overtimePay.toFixed(2),
              r.grossPay.toFixed(2),
              r.federalWithholding.toFixed(2),
              r.vaWithholding.toFixed(2),
              r.socialSecurityTax.toFixed(2),
              r.medicareTax.toFixed(2),
              r.totalTaxes.toFixed(2),
              ((r.insuranceDeduction || 0) + (r.otherDeductions || 0)).toFixed(2),
              r.netPay.toFixed(2),
            ].join(',');
          });

          const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `Culmore_Payroll_Register_${selectedHistoricalFriday}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        // If viewing an individual historical paystub
        if (historicalViewMode === 'paystub' && histRecord) {
          return (
            <div className="space-y-4">
              {/* Back Bar & Print Button (hidden during print) */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between no-print">
                <button
                  type="button"
                  onClick={() => setHistoricalViewMode('table')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? '과거 급여 내역 목록으로 돌아가기' : 'Back to Historical Payroll Table'}</span>
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    Pay Date: {selectedHistoricalFriday} (Friday)
                  </span>
                  <a
                    href={getPaystubPrintUrl(selectedHistoricalEmpId, selectedHistoricalFriday)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                    title={language === 'ko' ? '새 창에서 급여명세서를 바로 인쇄합니다' : 'Print This Paystub in New Tab'}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{language === 'ko' ? '이 명세서 인쇄 (새 창)' : 'Print This Paystub'}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                  {histRecord && (
                    <button
                      type="button"
                      onClick={() => handleDownloadPaystubHtml(histRecord, histEmployee, selectedHistoricalFriday)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                      title={language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download Printable HTML'}
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">HTML</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Printable Historical Paystub Document */}
              <div className="bg-white p-8 rounded-2xl border-2 border-slate-300 shadow-md max-w-4xl mx-auto printable-document">
                <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      {histEmpGroup ? histEmpGroup.name : displayStoreName}
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">
                      {displayStoreName} • {histEmpGroup?.name || displayStoreNameKo} • {settings.address}, {settings.city}, {settings.state} {settings.zipCode}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Phone: {settings.phone} • Employer EIN: {settings.ein}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs uppercase">
                      Payroll Statement (Historical)
                    </span>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">
                      Pay Date: {selectedHistoricalFriday} (Friday)
                    </p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Period: {formatWorkWeekRange(selectedHistoricalFriday, 'en')}
                    </p>
                  </div>
                </div>

                {/* Employee Summary Card */}
                <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee Name</span>
                    <span className="font-black text-slate-900 text-sm">{histRecord.employeeName}</span>
                    {histEmployee?.fullNameKo && (
                      <span className="text-slate-500 block text-[11px]">{histEmployee.fullNameKo}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee ID</span>
                    <span className="font-bold text-slate-800">{histRecord.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Branch / Group</span>
                    <span className="font-bold text-slate-900 block truncate">
                      {histEmpGroup.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {histEmpGroup.shortName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Department / Role</span>
                    <span className="font-bold text-slate-800">{histRecord.department}</span>
                    <span className="text-[10px] text-slate-500 block">{histRecord.position}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold block">Hourly Rate</span>
                    <span className="font-bold text-emerald-700 text-sm">${histRecord.hourlyWage.toFixed(2)}/hr</span>
                  </div>
                </div>

                {/* Earnings & Deductions Tables */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Earnings */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      {t('earningsSummary')}
                    </div>
                    <table className="w-full text-left font-mono">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-2 text-right">Hours</th>
                          <th className="py-2 px-2 text-right">Rate</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">Regular Pay (≤40h)</td>
                          <td className="py-2.5 px-2 text-right">{histRecord.regularHours.toFixed(2)}</td>
                          <td className="py-2.5 px-2 text-right">${histRecord.hourlyWage.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(histRecord.regularPay)}
                          </td>
                        </tr>
                        {histRecord.overtimeHours > 0 && (
                          <tr className="bg-amber-50/50">
                            <td className="py-2.5 px-3 font-semibold text-amber-900">Overtime Pay (1.5x)</td>
                            <td className="py-2.5 px-2 text-right font-bold text-amber-800">
                              {histRecord.overtimeHours.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              ${(histRecord.hourlyWage * 1.5).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-900">
                              {formatCurrency(histRecord.overtimePay)}
                            </td>
                          </tr>
                        )}
                        {histRecord.adjustments && histRecord.adjustments.length > 0 && (
                          histRecord.adjustments.map((adj, idx) => (
                            <tr key={adj.id || idx} className="bg-blue-50/70 border-t border-blue-100">
                              <td className="py-2 px-3 text-blue-950 font-medium">
                                <span className="font-bold">{adj.reason}</span>
                              </td>
                              <td className="py-2 px-2 text-right text-slate-400 font-mono">-</td>
                              <td className="py-2 px-2 text-right text-slate-400 font-mono">-</td>
                              <td className={`py-2 px-3 text-right font-bold font-mono ${adj.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {adj.amount >= 0 ? `+${formatCurrency(adj.amount)}` : `-${formatCurrency(Math.abs(adj.amount))}`}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 uppercase text-[11px]">Total Gross Earnings</td>
                          <td className="py-2.5 px-3 text-right text-sm">
                            {formatCurrency(histRecord.grossPay)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Deductions */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      {t('deductionsSummary')}
                    </div>
                    <table className="w-full text-left font-mono">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-2 text-right">Rate / Basis</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-2 px-3 text-slate-700">Federal Withholding (FIT)</td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {histRecord.withholdFederal !== false ? `${settings.federalTaxDefaultRate}% est.` : 'Exempt'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(histRecord.federalWithholding)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-700">Virginia State Income Tax (SIT)</td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {histRecord.withholdVirginia !== false ? `${settings.vaTaxDefaultRate}% std` : 'Exempt'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(histRecord.vaWithholding)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-700">FICA Social Security (6.2%)</td>
                          <td className="py-2 px-2 text-right text-slate-500">6.2%</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(histRecord.socialSecurityTax)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-700">FICA Medicare (1.45%)</td>
                          <td className="py-2 px-2 text-right text-slate-500">1.45%</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(histRecord.medicareTax)}
                          </td>
                        </tr>
                        {(histRecord.insuranceDeduction > 0 || histRecord.otherDeductions > 0) && (
                          <tr>
                            <td className="py-2 px-3 text-slate-700">Insurance & Voluntary</td>
                            <td className="py-2 px-2 text-right text-slate-500">Plan</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatCurrency((histRecord.insuranceDeduction || 0) + (histRecord.otherDeductions || 0))}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-rose-800">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">Total Deductions</td>
                          <td className="py-2.5 px-3 text-right text-sm">
                            -{formatCurrency(histRecord.totalDeductions)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Net Pay Grand Total Banner with Real-time KRW */}
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase font-extrabold text-emerald-900 tracking-wider block">
                      {t('netPaySummary')} (Net Take-Home)
                    </span>
                    <span className="text-xs text-emerald-700">
                      Gross ${histRecord.grossPay.toFixed(2)} minus Taxes & Deductions ${histRecord.totalDeductions.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-3xl font-black text-emerald-900 font-mono block">
                      {formatCurrency(histRecord.netPay)}
                    </span>
                    {usdToKrwRate > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-700 inline-block mt-0.5">
                        ≈ ₩{Math.round(histRecord.netPay * usdToKrwRate).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Signature Line */}
                <div className="mt-10 pt-6 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
                  <p>{t('employeeSignature')}</p>
                  <p className="font-mono text-[10px]">MANAGEMENT OF CULMORE Payroll Archive</p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {/* 1. WEEKLY PAY DATE SELECTOR & ACTIONS TOOLBAR (hidden during print) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
              {/* Row 1: Weekly Pay Date Picker & Prev/Next Week buttons */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-black text-slate-800 flex items-center space-x-1.5 shrink-0">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ko' ? '주급 날짜(지급일) 선택:' : 'Select Weekly Pay Date:'}</span>
                </span>

                {/* Dropdown of recorded pay periods */}
                <select
                  value={selectedHistoricalFriday}
                  onChange={(e) => {
                    setSelectedHistoricalFriday(e.target.value);
                    setHistoricalViewMode('table');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 text-xs focus:outline-hidden focus:border-emerald-500 max-w-sm cursor-pointer"
                >
                  {allRecordedPeriods.map((p) => {
                    const isCur = p.weekStartDate === currentWeekFriday;
                    return (
                      <option key={p.id || p.weekStartDate} value={p.weekStartDate}>
                        [지급일: {p.weekStartDate} (금)] {p.weekStartDate} ~ {p.weekEndDate} {isCur ? '★ 현재' : ''} • {p.status === 'finalized' ? '마감완료' : '작성중'} • Net ${p.totalNetPay.toLocaleString()}
                      </option>
                    );
                  })}
                  {!allRecordedPeriods.some((p) => p.weekStartDate === selectedHistoricalFriday) && (
                    <option value={selectedHistoricalFriday}>
                      [선택일: {selectedHistoricalFriday} (금)]
                    </option>
                  )}
                </select>

                {/* Direct Calendar Date Input */}
                <div className="flex items-center space-x-1">
                  <span className="text-[11px] text-slate-400">달력:</span>
                  <input
                    type="date"
                    value={selectedHistoricalFriday}
                    onChange={(e) => {
                      if (e.target.value) {
                        const fri = getWorkWeekFriday(new Date(e.target.value + 'T12:00:00'));
                        setSelectedHistoricalFriday(fri);
                        setHistoricalViewMode('table');
                      }
                    }}
                    className="px-2 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800 focus:outline-hidden cursor-pointer"
                    title={language === 'ko' ? '임의의 날짜를 선택하면 해당 주간의 금요일로 자동 계산됩니다' : 'Select any date to snap to its workweek Friday'}
                  />
                </div>

                {/* Stepper buttons (< 이전 주 / 다음 주 >) */}
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = getPreviousWeekFriday(selectedHistoricalFriday);
                      setSelectedHistoricalFriday(prev);
                      setHistoricalViewMode('table');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                    title="1주 전으로 이동"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{language === 'ko' ? '이전 주' : 'Prev Week'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = getNextWeekFriday(selectedHistoricalFriday);
                      setSelectedHistoricalFriday(next);
                      setHistoricalViewMode('table');
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                    title="1주 후로 이동"
                  >
                    <span>{language === 'ko' ? '다음 주' : 'Next Week'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Return to Current Week Button */}
                {selectedHistoricalFriday !== currentWeekFriday && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHistoricalFriday(currentWeekFriday);
                      setHistoricalViewMode('table');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{language === 'ko' ? '현재 주차 복귀' : 'Current Week'}</span>
                  </button>
                )}
              </div>

              {/* Row 2: Print Week Register & CSV Export buttons moved below the week navigation buttons */}
              <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={getPayrollRegisterPrintUrl(selectedHistoricalFriday, selectedGroup)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title={language === 'ko' ? '선택된 주차의 종합 급여 대장을 새 창에서 바로 인쇄합니다' : 'Print Historical Register in New Tab'}
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ko' ? '선택 주차 급여 대장 인쇄 (새 창)' : 'Print Week Register'}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDownloadRegisterHtml(selectedHistoricalFriday, selectedGroup, historicalRecords)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title={language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download Printable HTML'}
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">{language === 'ko' ? 'HTML 저장' : 'Save HTML'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportHistoricalCsv}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{language === 'ko' ? 'CSV 내보내기' : 'Export CSV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPrintModal('payroll_register', undefined, selectedHistoricalFriday, selectedGroup)}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title={language === 'ko' ? '인쇄 옵션 창 열기' : 'Print Options'}
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">{language === 'ko' ? '옵션' : 'Options'}</span>
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  {language === 'ko'
                    ? `선택 주차 [지급일: ${selectedHistoricalFriday}]의 급여 대장 인쇄 및 CSV 내보내기`
                    : `Actions for selected pay date: ${selectedHistoricalFriday}`}
                </span>
              </div>

              {/* Search input & Group indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={language === 'ko' ? '과거 기록 검색 (이름, 사번, 부서, 직책)...' : 'Search records by name, ID...'}
                    className="w-full pl-8 pr-4 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  {selectedGroup !== 'ALL' && (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getBusinessGroup(selectedGroup).badgeBg}`}>
                      {getBusinessGroup(selectedGroup).name}
                    </span>
                  )}
                  <span className="font-mono text-slate-500">
                    조회된 직원: {displayedHistoricalRecords.length}명
                  </span>
                </div>
              </div>
            </div>

            {/* 2. SELECTED PERIOD KPI OVERVIEW BANNER */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {language === 'ko' ? '주급 지급일 (Pay Date)' : 'Pay Date (Friday)'}
                </span>
                <span className="text-sm font-black text-slate-900 font-mono block mt-0.5">
                  {selectedHistoricalFriday}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {formatWorkWeekRange(selectedHistoricalFriday, language)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {language === 'ko' ? '마감 상태 / 인원' : 'Status / Headcount'}
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    historicalPeriod?.status === 'finalized'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {historicalPeriod?.status === 'finalized'
                      ? (language === 'ko' ? '마감 완료 (Locked)' : 'Finalized')
                      : (language === 'ko' ? '작성 중 (Draft)' : 'Draft')}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {displayedHistoricalRecords.length}명
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  총 {histRegHours.toFixed(1)}h (OT +{histOtHours.toFixed(1)}h)
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {language === 'ko' ? '총급여 (Gross Earnings)' : 'Gross Earnings'}
                </span>
                <span className="text-sm font-black text-slate-900 font-mono block mt-0.5">
                  {formatCurrency(histGross)}
                </span>
                <span className="text-[10px] text-rose-600 font-mono block">
                  세금 공제 -{formatCurrency(histTaxes)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-extrabold text-emerald-800 block">
                  {language === 'ko' ? '실지급액 합계 (Net Disbursement)' : 'Net Disbursement'}
                </span>
                <span className="text-base font-black text-emerald-900 font-mono block mt-0.5">
                  {formatCurrency(histNet)}
                </span>
                {usdToKrwRate > 0 && (
                  <span className="text-[10px] text-emerald-700 font-mono font-bold block truncate">
                    ≈ ₩{Math.round(histNet * usdToKrwRate).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* 3. HISTORICAL PAYROLL REGISTER TABLE (Screen View) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden no-print">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <th className="py-2.5 px-3">사번 (ID)</th>
                      <th className="py-2.5 px-3">직원명 (Employee)</th>
                      <th className="py-2.5 px-3">사업장 (Group)</th>
                      <th className="py-2.5 px-3">부서 / 직책</th>
                      <th className="py-2.5 px-2 text-right">정규시간</th>
                      <th className="py-2.5 px-2 text-right">연장시간</th>
                      <th className="py-2.5 px-3 text-right">총급여 ($)</th>
                      <th className="py-2.5 px-3 text-right">세금 합계 ($)</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950 font-black">
                        실수령액 ($)
                      </th>
                      <th className="py-2.5 px-3 text-center">출력 / 상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {isLoadingHistorical ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                          {language === 'ko' ? '과거 급여 데이터를 불러오는 중입니다...' : 'Loading historical payroll data...'}
                        </td>
                      </tr>
                    ) : displayedHistoricalRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                          {language === 'ko'
                            ? `[지급일: ${selectedHistoricalFriday}] 해당 주차에는 생성된 급여 데이터가 없습니다.`
                            : `No payroll records compiled for ${selectedHistoricalFriday}.`}
                        </td>
                      </tr>
                    ) : (
                      displayedHistoricalRecords.map((r) => {
                        const emp = employees.find((e) => e.employeeId === r.employeeId);
                        const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
                        const isCashier = isCashierEmployee(r.department, r.position);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">{r.employeeId}</td>
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                              <div className="flex items-center space-x-1.5">
                                <span>{r.employeeName}</span>
                                {isCashier && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    캐셔
                                  </span>
                                )}
                                {r.isAdjusted && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-800" title="Has adjustments">
                                    {language === 'ko' ? '조정' : 'Adj'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${grp.badgeBg}`}>
                                {grp.shortName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-600">
                              <span>{r.department}</span>
                              <span className="text-slate-400 text-[10px] ml-1">({r.position})</span>
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-800">{r.regularHours.toFixed(1)}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                              {r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(r.grossPay)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-700">
                              {formatCurrency(r.totalTaxes)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black bg-emerald-50 text-emerald-800 text-sm">
                              {formatCurrency(r.netPay)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedHistoricalEmpId(r.employeeId);
                                  setHistoricalViewMode('paystub');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-sans font-bold shadow-2xs transition-colors cursor-pointer flex items-center space-x-1 mx-auto"
                                title="이 직원의 과거 급여명세서를 확인하고 바로 인쇄합니다"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{language === 'ko' ? '명세서 인쇄' : 'Paystub'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {displayedHistoricalRecords.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 font-mono text-slate-900">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 uppercase font-sans font-black text-xs text-slate-800">
                          {selectedGroup === 'ALL'
                            ? (language === 'ko' ? '전체 사업장 합계 (Total 5 Branches)' : 'Grand Total (All Branches)')
                            : `${getBusinessGroup(selectedGroup).shortName} 소계 (Subtotal)`}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-900">{histRegHours.toFixed(1)}</td>
                        <td className="py-3 px-2 text-right text-amber-800">
                          {histOtHours > 0 ? `+${histOtHours.toFixed(1)}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900">{formatCurrency(histGross)}</td>
                        <td className="py-3 px-3 text-right text-rose-800">{formatCurrency(histTaxes)}</td>
                        <td className="py-3 px-3 text-right font-black bg-emerald-100 text-emerald-950 text-sm">
                          {formatCurrency(histNet)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* 4. PRINT-ONLY DEDICATED HISTORICAL WEEKLY PAYROLL REGISTER DOCUMENT */}
            <div className="hidden print:block printable-document bg-white p-6">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {displayStoreName}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    {selectedGroup !== 'ALL' ? `${getBusinessGroup(selectedGroup).name} • ` : 'All 5 Branches • '}
                    {settings.address}, {settings.city}, {settings.state} {settings.zipCode} • EIN: {settings.ein}
                  </p>
                </div>
                <div className="text-right">
                  <h2 className="text-sm font-black uppercase text-slate-900">
                    WEEKLY PAYROLL REGISTER (급여 대장)
                  </h2>
                  <p className="text-xs text-slate-700 font-mono font-bold">
                    Pay Date: {selectedHistoricalFriday} (Friday)
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Period: {formatWorkWeekRange(selectedHistoricalFriday, 'en')}
                  </p>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="my-3 p-3 bg-slate-50 border border-slate-300 rounded text-xs flex justify-between items-center font-mono">
                <div>
                  <span className="font-sans font-bold text-slate-600 mr-1">Headcount:</span>
                  <span className="font-black text-slate-900">{displayedHistoricalRecords.length} staff</span>
                </div>
                <div>
                  <span className="font-sans font-bold text-slate-600 mr-1">Hours:</span>
                  <span className="font-black text-slate-900">{histRegHours.toFixed(1)}h reg + {histOtHours.toFixed(1)}h OT</span>
                </div>
                <div>
                  <span className="font-sans font-bold text-slate-600 mr-1">Gross:</span>
                  <span className="font-black text-slate-900">{formatCurrency(histGross)}</span>
                </div>
                <div>
                  <span className="font-sans font-bold text-slate-600 mr-1">Taxes:</span>
                  <span className="font-black text-rose-700">-{formatCurrency(histTaxes)}</span>
                </div>
                <div>
                  <span className="font-sans font-black text-emerald-900 mr-1">Net Disbursement:</span>
                  <span className="font-black text-emerald-950 text-sm">{formatCurrency(histNet)}</span>
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full text-left border-collapse text-[11px] font-mono mt-3">
                <thead>
                  <tr className="border-b-2 border-slate-900 font-bold uppercase text-[10px]">
                    <th className="py-1 px-1">ID</th>
                    <th className="py-1 px-1">Employee Name</th>
                    <th className="py-1 px-1">Branch</th>
                    <th className="py-1 px-1">Dept/Role</th>
                    <th className="py-1 px-1 text-right">Reg H</th>
                    <th className="py-1 px-1 text-right">OT H</th>
                    <th className="py-1 px-1 text-right">Gross ($)</th>
                    <th className="py-1 px-1 text-right">FIT ($)</th>
                    <th className="py-1 px-1 text-right">SIT ($)</th>
                    <th className="py-1 px-1 text-right">FICA ($)</th>
                    <th className="py-1 px-1 text-right font-black">Net Pay ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedHistoricalRecords.map((r) => {
                    const emp = employees.find((e) => e.employeeId === r.employeeId);
                    const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
                    return (
                      <tr key={r.id}>
                        <td className="py-1 px-1 font-bold">{r.employeeId}</td>
                        <td className="py-1 px-1 font-sans font-bold">{r.employeeName}</td>
                        <td className="py-1 px-1 font-sans">{grp.shortName}</td>
                        <td className="py-1 px-1 font-sans">{r.department}</td>
                        <td className="py-1 px-1 text-right">{r.regularHours.toFixed(1)}</td>
                        <td className="py-1 px-1 text-right">{r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}` : '-'}</td>
                        <td className="py-1 px-1 text-right font-bold">{formatCurrency(r.grossPay)}</td>
                        <td className="py-1 px-1 text-right text-slate-700">{formatCurrency(r.federalWithholding)}</td>
                        <td className="py-1 px-1 text-right text-slate-700">{formatCurrency(r.vaWithholding)}</td>
                        <td className="py-1 px-1 text-right text-slate-700">{formatCurrency(r.socialSecurityTax + r.medicareTax)}</td>
                        <td className="py-1 px-1 text-right font-black text-slate-950">{formatCurrency(r.netPay)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-slate-900 font-bold bg-slate-100">
                  <tr>
                    <td colSpan={4} className="py-1.5 px-1 uppercase font-sans font-black">Total</td>
                    <td className="py-1.5 px-1 text-right">{histRegHours.toFixed(1)}</td>
                    <td className="py-1.5 px-1 text-right">{histOtHours.toFixed(1)}</td>
                    <td className="py-1.5 px-1 text-right font-black">{formatCurrency(histGross)}</td>
                    <td colSpan={3} className="py-1.5 px-1 text-right text-rose-800">Taxes: -{formatCurrency(histTaxes)}</td>
                    <td className="py-1.5 px-1 text-right font-black text-slate-950 text-xs">{formatCurrency(histNet)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Employer Certification and Signatures */}
              <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-600 font-sans">
                <div>
                  <p className="font-bold text-slate-800 mb-6">Prepared by: _________________________________</p>
                  <p className="text-[10px] text-slate-500">Payroll Specialist / System Record Administrator</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800 mb-6">Authorized Approval: ___________________________</p>
                  <p className="text-[10px] text-slate-500">Store General Manager / Store Owner (MANAGEMENT OF CULMORE)</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Comprehensive Print & Export Modal */}
      {isPrintModalOpen && (() => {
        const modalRec =
          printModalType === 'paystub'
            ? (printModalTargetWeek === currentWeekFriday
                ? payrollRecords.find((r) => r.employeeId === printModalTargetEmpId)
                : historicalRecords.find((r) => r.employeeId === printModalTargetEmpId)) ||
              payrollRecords.find((r) => r.employeeId === printModalTargetEmpId) ||
              historicalRecords.find((r) => r.employeeId === printModalTargetEmpId)
            : null;

        const modalEmp = employees.find((e) => e.employeeId === printModalTargetEmpId);

        const currentPrintUrl =
          printModalType === 'paystub'
            ? getPaystubPrintUrl(printModalTargetEmpId, printModalTargetWeek)
            : getPayrollRegisterPrintUrl(printModalTargetWeek, printModalTargetGroup);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {language === 'ko' ? '급여명세서 및 보고서 인쇄' : 'Print Paystubs & Payroll Reports'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      MANAGEMENT OF CULMORE • {language === 'ko' ? '브라우저 인쇄 & 독립 HTML 다운로드' : 'Browser Print & HTML Export'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Document Type Selector Tabs */}
              <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center space-x-2 bg-slate-100/50">
                <button
                  type="button"
                  onClick={() => setPrintModalType('paystub')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    printModalType === 'paystub'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? '개인별 급여명세서 (Paystub)' : 'Individual Paystub'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintModalType('payroll_register')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    printModalType === 'payroll_register'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? '주간 종합 급여 대장 (Register)' : 'Weekly Payroll Register'}</span>
                </button>
              </div>

              {/* Modal Configuration Body */}
              <div className="p-6 space-y-4 overflow-y-auto">
                {/* Configuration Fields */}
                {printModalType === 'paystub' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '인쇄 대상 직원 선택' : 'Select Employee'}
                      </label>
                      <select
                        value={printModalTargetEmpId}
                        onChange={(e) => setPrintModalTargetEmpId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500"
                      >
                        {BUSINESS_GROUPS.map((grp) => {
                          const targetRecords =
                            printModalTargetWeek === currentWeekFriday ? activeWorkingRecords : historicalRecords;
                          const grpEmps = employees.filter((e) => {
                            if (getEmpGroup(e).id !== grp.id) return false;
                            return targetRecords.some(
                              (r) =>
                                r.employeeId === e.employeeId &&
                                (r.regularHours > 0 ||
                                  r.overtimeHours > 0 ||
                                  r.grossPay > 0 ||
                                  (r.adjustments && r.adjustments.length > 0))
                            );
                          });
                          if (grpEmps.length === 0) return null;
                          return (
                            <optgroup key={grp.id} label={`${grp.name}`}>
                              {grpEmps.map((emp) => (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                  {emp.fullName} {emp.fullNameKo ? `(${emp.fullNameKo})` : ''} [{emp.employeeId}] — {emp.position}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '지급일 (주급 날짜)' : 'Pay Date (Friday)'}
                      </label>
                      <select
                        value={printModalTargetWeek}
                        onChange={(e) => setPrintModalTargetWeek(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500 font-mono"
                      >
                        <option value={currentWeekFriday}>
                          {currentWeekFriday} (이번 주 — {formatWorkWeekRange(currentWeekFriday, 'ko')})
                        </option>
                        {allRecordedPeriods
                          .filter((p) => p.weekStartDate !== currentWeekFriday)
                          .map((p) => (
                            <option key={p.id} value={p.weekStartDate}>
                              {p.weekStartDate} (과거 주차 — {formatWorkWeekRange(p.weekStartDate, 'ko')})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '출력 대상 사업장 (그룹)' : 'Target Business Group'}
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setPrintModalTargetGroup('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            printModalTargetGroup === 'ALL'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {language === 'ko' ? '전체 사업장 (통합)' : 'All Branches'}
                        </button>
                        {BUSINESS_GROUPS.map((grp) => (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => setPrintModalTargetGroup(grp.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              printModalTargetGroup === grp.id
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {grp.shortName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '지급일 (주급 날짜)' : 'Pay Date (Friday)'}
                      </label>
                      <select
                        value={printModalTargetWeek}
                        onChange={(e) => setPrintModalTargetWeek(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500 font-mono"
                      >
                        <option value={currentWeekFriday}>
                          {currentWeekFriday} (이번 주 — {formatWorkWeekRange(currentWeekFriday, 'ko')})
                        </option>
                        {allRecordedPeriods
                          .filter((p) => p.weekStartDate !== currentWeekFriday)
                          .map((p) => (
                            <option key={p.id} value={p.weekStartDate}>
                              {p.weekStartDate} (과거 주차 — {formatWorkWeekRange(p.weekStartDate, 'ko')})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Browser Sandbox Print Explanation */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{language === 'ko' ? '인쇄 정상 작동 안내' : 'Printing Information'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {language === 'ko'
                      ? '웹 프리뷰(iframe) 환경에서는 브라우저 보안 규정에 의해 화면 내 직접 인쇄가 차단될 수 있습니다. 아래 [새 창에서 열어 바로 인쇄하기 (추천)]를 누르시면 상단 탭에서 브라우저 인쇄 대화상자가 100% 정상 실행됩니다.'
                      : 'Inside iframe sandboxes, direct in-page print calls may be blocked by your browser. Use the "Print in New Tab" button to open the top-level print dialog.'}
                  </p>
                </div>

                {/* Target Summary Snapshot */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    {language === 'ko' ? '인쇄 문서 정보:' : 'Document Summary:'}
                  </div>
                  {printModalType === 'paystub' ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                      <div>직원: <strong className="text-slate-900">{modalEmp?.fullName || printModalTargetEmpId}</strong></div>
                      <div>지급일: <strong className="text-slate-900">{printModalTargetWeek}</strong></div>
                      <div>총지급액: <strong className="text-slate-900">{modalRec ? formatCurrency(modalRec.grossPay) : '-'}</strong></div>
                      <div>실지급액: <strong className="text-emerald-700 font-bold">{modalRec ? formatCurrency(modalRec.netPay) : '-'}</strong></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                      <div>사업장: <strong className="text-slate-900">{printModalTargetGroup === 'ALL' ? '전체 5개 사업장' : BUSINESS_GROUPS.find(g => g.id === printModalTargetGroup)?.name}</strong></div>
                      <div>지급일: <strong className="text-slate-900">{printModalTargetWeek}</strong></div>
                    </div>
                  )}
                </div>

                {/* Print Feedback Message */}
                {printFeedback && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{printFeedback}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrintFeedback(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold ml-2 underline cursor-pointer"
                    >
                      {language === 'ko' ? '확인' : 'OK'}
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* HTML file download button */}
                <button
                  type="button"
                  onClick={() => {
                    if (printModalType === 'paystub' && modalRec) {
                      handleDownloadPaystubHtml(modalRec, modalEmp, printModalTargetWeek);
                    } else {
                      const recs = printModalTargetWeek === currentWeekFriday ? payrollRecords : historicalRecords;
                      handleDownloadRegisterHtml(printModalTargetWeek, printModalTargetGroup, recs);
                    }
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  title="오프라인 보관용 HTML 파일 다운로드"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download HTML'}</span>
                </button>

                <div className="flex flex-wrap items-center space-x-2 w-full sm:w-auto justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>

                  {/* Primary Anchor Link: 100% Guaranteed to open top-level tab and pop print dialog */}
                  <a
                    href={currentPrintUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title="새 창에서 열어 바로 인쇄"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{language === 'ko' ? '새 창에서 열어 바로 인쇄하기 (추천)' : 'Print Now (New Tab)'}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>

                  {/* Direct In-Page Trigger Fallback */}
                  <button
                    type="button"
                    onClick={() => {
                      if (printModalType === 'paystub') {
                        handleDirectPrintPaystub(printModalTargetEmpId, printModalTargetWeek);
                      } else {
                        handleDirectPrintRegister(printModalTargetWeek, printModalTargetGroup);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title="현재 화면에서 인쇄 시도"
                  >
                    <span>{language === 'ko' ? '직접 호출' : 'Call Dialog'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Paystub Direct Tax Modal (Item 4) */}
      {isPaystubTaxModalOpen && taxTargetRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '급여명세서 세금공제 직접 입력' : 'Direct Paystub Tax Deduction'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {taxTargetRecord.employeeName} ({taxTargetRecord.employeeId}) • 총 급여: {formatCurrency(taxTargetRecord.grossPay)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaystubTaxModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaystubTaxes} className="space-y-4">
              {/* Toggle Mode */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === 'ko' ? '세금 공제 방식 선택' : 'Tax Deduction Method'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualTax(false);
                      setManualFedStr((taxTargetRecord.withholdFederal !== false ? (taxTargetRecord.grossPay * settings.federalTaxDefaultRate) / 100 : 0).toFixed(2));
                      setManualVaStr((taxTargetRecord.withholdVirginia !== false ? (taxTargetRecord.grossPay * settings.vaTaxDefaultRate) / 100 : 0).toFixed(2));
                      setManualSsStr((taxTargetRecord.withholdSocialSecurity !== false ? (taxTargetRecord.grossPay * settings.socialSecurityRate) / 100 : 0).toFixed(2));
                      setManualMedStr((taxTargetRecord.withholdMedicare !== false ? (taxTargetRecord.grossPay * settings.medicareRate) / 100 : 0).toFixed(2));
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer ${
                      !isManualTax
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p>{language === 'ko' ? '표준 자동 계산' : 'Standard Auto'}</p>
                    <p className={`text-[10px] mt-0.5 ${!isManualTax ? 'text-slate-300' : 'text-slate-500'}`}>
                      {language === 'ko' ? '설정된 세율 자동 적용' : 'Default Tax Rates'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsManualTax(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer ${
                      isManualTax
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p>{language === 'ko' ? '세금공제 직접 입력' : 'Manual Override'}</p>
                    <p className={`text-[10px] mt-0.5 ${isManualTax ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {language === 'ko' ? '원하는 공제 금액 직접 지정' : 'Custom Tax Amounts'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Tax Deduction Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Federal Withholding (FIT / 연방세) ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!isManualTax}
                      value={manualFedStr}
                      onChange={(e) => setManualFedStr(e.target.value)}
                      className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-hidden ${
                        isManualTax
                          ? 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
                          : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Virginia State Income Tax (SIT / 주세) ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      disabled={!isManualTax}
                      value={manualVaStr}
                      onChange={(e) => setManualVaStr(e.target.value)}
                      className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-hidden ${
                        isManualTax
                          ? 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
                          : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Social Security (FICA) ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={!isManualTax}
                        value={manualSsStr}
                        onChange={(e) => setManualSsStr(e.target.value)}
                        className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-hidden ${
                          isManualTax
                            ? 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
                            : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Medicare (FICA) ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        disabled={!isManualTax}
                        value={manualMedStr}
                        onChange={(e) => setManualMedStr(e.target.value)}
                        className={`w-full pl-7 pr-3 py-2 rounded-xl border text-xs font-mono font-bold focus:outline-hidden ${
                          isManualTax
                            ? 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
                            : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Calculation Summary */}
              {(() => {
                const fed = isManualTax ? parseFloat(manualFedStr) || 0 : taxTargetRecord.federalWithholding;
                const va = isManualTax ? parseFloat(manualVaStr) || 0 : taxTargetRecord.vaWithholding;
                const ss = isManualTax ? parseFloat(manualSsStr) || 0 : taxTargetRecord.socialSecurityTax;
                const med = isManualTax ? parseFloat(manualMedStr) || 0 : taxTargetRecord.medicareTax;
                const other = (taxTargetRecord.insuranceDeduction || 0) + (taxTargetRecord.otherDeductions || 0);
                const totDed = fed + va + ss + med + other;
                const net = Math.max(0, taxTargetRecord.grossPay - totDed);

                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-600">
                      <span>총 공제 세금 (Total Taxes):</span>
                      <span className="font-bold text-rose-700">-{formatCurrency(totDed)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-1.5">
                      <span>실 지급액 (Net Pay):</span>
                      <span className="text-emerald-700">{formatCurrency(net)}</span>
                    </div>
                  </div>
                );
              })()}

              {taxSaveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ko' ? '세금 공제가 성공적으로 저장되었습니다.' : 'Taxes updated successfully!'}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaystubTaxModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingTax}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingTax ? (language === 'ko' ? '저장 중...' : 'Saving...') : (language === 'ko' ? '저장 및 급여명세서 반영' : 'Save & Update Paystub')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
