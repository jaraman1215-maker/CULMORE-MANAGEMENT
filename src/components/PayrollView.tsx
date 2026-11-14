import React, { useState } from 'react';
import {
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  ShieldAlert,
  Sliders,
  History,
  SlidersHorizontal,
  Check,
  X,
  Building,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  Employee,
  Shift,
  PayrollPeriod,
  PayrollRecord,
  StoreSettings,
  PayrollAdjustment,
  BUSINESS_GROUPS,
  getBusinessGroup,
  PaymentMethod,
} from '../types';
import { TaxWithholdingSelections, PaymentAndTaxUpdates } from '../firebase/dataService';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  formatWorkWeekRange,
  getPreviousWeekFriday,
  getNextWeekFriday,
  getWorkWeekFriday,
} from '../utils/dateUtils';
import { formatCurrency } from '../utils/calculations';

interface PayrollViewProps {
  currentWeekFriday: string;
  onChangeWeek: (fridayYmd: string) => void;
  employees: Employee[];
  shifts: Shift[];
  payrollPeriod: PayrollPeriod | null;
  payrollRecords: PayrollRecord[];
  settings: StoreSettings;
  onGeneratePayroll: () => Promise<void>;
  onFinalizePayroll: (periodId: string) => Promise<void>;
  onReopenPayroll: (periodId: string, reason: string) => Promise<void>;
  onAddAdjustment: (recordId: string, adjustment: PayrollAdjustment) => Promise<void>;
  onSaveAdjustments?: (recordId: string, adjustments: PayrollAdjustment[], note?: string) => Promise<void>;
  onUpdateTaxSelections?: (recordId: string, taxSelections: TaxWithholdingSelections) => Promise<void>;
  onBatchUpdateTaxSelections?: (periodId: string, taxSelections: TaxWithholdingSelections) => Promise<void>;
  onSavePaymentAndTaxes?: (recordId: string, updates: PaymentAndTaxUpdates) => Promise<void>;
}

export const PayrollView: React.FC<PayrollViewProps> = ({
  currentWeekFriday,
  onChangeWeek,
  employees,
  shifts,
  payrollPeriod,
  payrollRecords,
  settings,
  onGeneratePayroll,
  onFinalizePayroll,
  onReopenPayroll,
  onAddAdjustment,
  onSaveAdjustments,
  onUpdateTaxSelections,
  onBatchUpdateTaxSelections,
  onSavePaymentAndTaxes,
}) => {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();

  const isFinalized = payrollPeriod?.status === 'finalized';

  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // Strict active registered employees filter
  const activeEmpIds = new Set(employees.filter((e) => e.active).map((e) => e.employeeId));
  const validRecords = payrollRecords.filter((r) => {
    if (!activeEmpIds.has(r.employeeId)) return false;
    return (
      r.regularHours > 0 ||
      r.overtimeHours > 0 ||
      r.grossPay > 0 ||
      (r.adjustments && r.adjustments.length > 0)
    );
  });

  // Filter records by business group and ensure only registered active working employees are displayed
  const displayedRecords = validRecords.filter((r) => {
    if (selectedGroup === 'ALL') return true;
    const emp = employees.find((e) => e.employeeId === r.employeeId);
    const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
    return grp.id === selectedGroup;
  });

  // Modals
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Adjustment Manager State
  const [adjustmentTargetRecord, setAdjustmentTargetRecord] = useState<PayrollRecord | null>(null);
  const [editingAdjId, setEditingAdjId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'bonus' | 'deduction'>('bonus');
  const [adjustmentAmountStr, setAdjustmentAmountStr] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  const [showTaxExplainer, setShowTaxExplainer] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    try {
      setIsProcessing(true);
      await onGeneratePayroll();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmFinalize = async () => {
    if (!payrollPeriod) return;
    try {
      setIsProcessing(true);
      await onFinalizePayroll(payrollPeriod.id);
      setShowFinalizeModal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollPeriod) return;
    if (!reopenReason.trim()) {
      setReopenError(
        language === 'ko'
          ? '마감 해제 사유를 반드시 입력해야 감사 로그에 기록됩니다.'
          : 'A detailed justification is required for the audit trail.'
      );
      return;
    }

    try {
      setIsProcessing(true);
      await onReopenPayroll(payrollPeriod.id, reopenReason.trim());
      setShowReopenModal(false);
      setReopenReason('');
      setReopenError(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartEditAdjustment = (adj: PayrollAdjustment) => {
    setEditingAdjId(adj.id);
    setAdjustmentType(adj.amount < 0 ? 'deduction' : 'bonus');
    setAdjustmentAmountStr(Math.abs(adj.amount).toFixed(2));
    setAdjustmentReason(adj.reason);
    setAdjustmentError(null);
  };

  const handleCancelEdit = () => {
    setEditingAdjId(null);
    setAdjustmentType('bonus');
    setAdjustmentAmountStr('');
    setAdjustmentReason('');
    setAdjustmentError(null);
  };

  const handleDeleteAdjustment = async (adjId: string) => {
    if (!adjustmentTargetRecord) return;
    const currentList = adjustmentTargetRecord.adjustments || [];
    const updatedList = currentList.filter((a) => a.id !== adjId);

    try {
      setIsProcessing(true);
      if (onSaveAdjustments) {
        await onSaveAdjustments(
          adjustmentTargetRecord.id,
          updatedList,
          `Adjustment deleted: ${adjId}`
        );
      }
      setAdjustmentTargetRecord({
        ...adjustmentTargetRecord,
        adjustments: updatedList,
      });
      if (editingAdjId === adjId) {
        handleCancelEdit();
      }
    } catch (err: unknown) {
      setAdjustmentError(err instanceof Error ? err.message : 'Error deleting adjustment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentTargetRecord) return;
    if (!adjustmentReason.trim()) {
      setAdjustmentError(
        language === 'ko' ? '조정 사유를 입력해주세요.' : 'Reason for adjustment is required.'
      );
      return;
    }

    const rawVal = parseFloat(adjustmentAmountStr);
    if (isNaN(rawVal) || rawVal === 0) {
      setAdjustmentError(
        language === 'ko' ? '0이 아닌 유효한 금액을 입력해주세요.' : 'Enter a non-zero adjustment amount.'
      );
      return;
    }

    let finalAmt = Math.abs(rawVal);
    if (adjustmentType === 'deduction' || rawVal < 0) {
      finalAmt = -finalAmt;
    }
    finalAmt = Math.round(finalAmt * 100) / 100;

    const currentAdjustments = [...(adjustmentTargetRecord.adjustments || [])];

    if (editingAdjId) {
      // Editing existing adjustment
      const updatedList = currentAdjustments.map((a) =>
        a.id === editingAdjId
          ? {
              ...a,
              reason: adjustmentReason.trim(),
              amount: finalAmt,
              adminEmail: currentUser?.email || 'admin@culmorecorp.com',
              timestamp: new Date().toISOString(),
            }
          : a
      );

      try {
        setIsProcessing(true);
        if (onSaveAdjustments) {
          await onSaveAdjustments(
            adjustmentTargetRecord.id,
            updatedList,
            `Adjustment updated: ${adjustmentReason.trim()} (${finalAmt})`
          );
        }
        setAdjustmentTargetRecord({
          ...adjustmentTargetRecord,
          adjustments: updatedList,
        });
        handleCancelEdit();
      } catch (err: unknown) {
        setAdjustmentError(err instanceof Error ? err.message : 'Error updating adjustment');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Adding new adjustment
      const newAdj: PayrollAdjustment = {
        id: `adj_${Date.now()}`,
        reason: adjustmentReason.trim(),
        amount: finalAmt,
        adminEmail: currentUser?.email || 'admin@culmorecorp.com',
        timestamp: new Date().toISOString(),
      };
      const updatedList = [...currentAdjustments, newAdj];

      try {
        setIsProcessing(true);
        if (onSaveAdjustments) {
          await onSaveAdjustments(
            adjustmentTargetRecord.id,
            updatedList,
            `Adjustment added: ${adjustmentReason.trim()} (${finalAmt})`
          );
        } else {
          await onAddAdjustment(adjustmentTargetRecord.id, newAdj);
        }
        setAdjustmentTargetRecord({
          ...adjustmentTargetRecord,
          adjustments: updatedList,
        });
        setAdjustmentAmountStr('');
        setAdjustmentReason('');
        setAdjustmentError(null);
      } catch (err: unknown) {
        setAdjustmentError(err instanceof Error ? err.message : 'Error adding adjustment');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Withholding Tax Selection State & Handlers
  const [taxTargetRecord, setTaxTargetRecord] = useState<PayrollRecord | null>(null);
  const [empWithholdFed, setEmpWithholdFed] = useState(true);
  const [empWithholdVA, setEmpWithholdVA] = useState(true);
  const [empWithholdSS, setEmpWithholdSS] = useState(true);
  const [empWithholdMed, setEmpWithholdMed] = useState(true);
  const [taxError, setTaxError] = useState<string | null>(null);

  const [showBatchTaxModal, setShowBatchTaxModal] = useState(false);
  const [batchWithholdFed, setBatchWithholdFed] = useState(true);
  const [batchWithholdVA, setBatchWithholdVA] = useState(true);
  const [batchWithholdSS, setBatchWithholdSS] = useState(true);
  const [batchWithholdMed, setBatchWithholdMed] = useState(true);
  const [batchTaxError, setBatchTaxError] = useState<string | null>(null);

  const handleOpenTaxModal = (record: PayrollRecord) => {
    setTaxTargetRecord(record);
    setEmpWithholdFed(record.withholdFederal ?? true);
    setEmpWithholdVA(record.withholdVirginia ?? true);
    setEmpWithholdSS(record.withholdSocialSecurity ?? true);
    setEmpWithholdMed(record.withholdMedicare ?? true);
    setTaxError(null);
  };

  const handleSaveTaxSelections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxTargetRecord || !onUpdateTaxSelections) return;
    try {
      setIsProcessing(true);
      await onUpdateTaxSelections(taxTargetRecord.id, {
        withholdFederal: empWithholdFed,
        withholdVirginia: empWithholdVA,
        withholdSocialSecurity: empWithholdSS,
        withholdMedicare: empWithholdMed,
      });
      setTaxTargetRecord(null);
    } catch (err: unknown) {
      setTaxError(err instanceof Error ? err.message : 'Error updating tax selections');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveBatchTaxSelections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payrollPeriod || !onBatchUpdateTaxSelections) return;
    try {
      setIsProcessing(true);
      await onBatchUpdateTaxSelections(payrollPeriod.id, {
        withholdFederal: batchWithholdFed,
        withholdVirginia: batchWithholdVA,
        withholdSocialSecurity: batchWithholdSS,
        withholdMedicare: batchWithholdMed,
      });
      setShowBatchTaxModal(false);
    } catch (err: unknown) {
      setBatchTaxError(err instanceof Error ? err.message : 'Error applying batch tax selections');
    } finally {
      setIsProcessing(false);
    }
  };

  // Payment & Tax Configuration Modal State (Items 4 & 5)
  const [paymentTargetRecord, setPaymentTargetRecord] = useState<PayrollRecord | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('ALL_CHECK');
  const [taxableHoursStr, setTaxableHoursStr] = useState<string>('40');
  const [cashHoursStr, setCashHoursStr] = useState<string>('0');
  const [checkAmountStr, setCheckAmountStr] = useState<string>('');
  const [cashAmountStr, setCashAmountStr] = useState<string>('');
  const [lastEditedSplitSide, setLastEditedSplitSide] = useState<'check' | 'cash'>('check');
  const [isManualTax, setIsManualTax] = useState<boolean>(false);
  const [manualFedStr, setManualFedStr] = useState<string>('');
  const [manualVaStr, setManualVaStr] = useState<string>('');
  const [manualSsStr, setManualSsStr] = useState<string>('');
  const [manualMedStr, setManualMedStr] = useState<string>('');
  const [payModalError, setPayModalError] = useState<string | null>(null);

  const computeLiveModalNetPay = (
    rec: PayrollRecord,
    manualEnabled: boolean,
    fedStr: string,
    vaStr: string,
    ssStr: string,
    medStr: string
  ): number => {
    const baseNonTax = (rec.insuranceDeduction || 0) + (rec.otherDeductions || 0);
    const taxes = manualEnabled
      ? (parseFloat(fedStr) || 0) +
        (parseFloat(vaStr) || 0) +
        (parseFloat(ssStr) || 0) +
        (parseFloat(medStr) || 0)
      : rec.totalTaxes;
    return Math.max(0, Math.round((rec.grossPay - taxes - baseNonTax) * 100) / 100);
  };

  const syncAmountsWithNetPay = (
    newNet: number,
    method: PaymentMethod,
    anchorSide: 'check' | 'cash',
    currentCheckStr: string,
    currentCashStr: string
  ) => {
    if (method === 'ALL_CHECK') {
      setCheckAmountStr(newNet.toFixed(2));
      setCashAmountStr('0.00');
    } else if (method === 'ALL_CASH') {
      setCheckAmountStr('0.00');
      setCashAmountStr(newNet.toFixed(2));
    } else if (anchorSide === 'cash') {
      const csh = Math.max(0, Math.min(newNet, parseFloat(currentCashStr) || 0));
      setCashAmountStr(csh.toFixed(2));
      setCheckAmountStr(Math.max(0, Math.round((newNet - csh) * 100) / 100).toFixed(2));
    } else {
      const chk = Math.max(0, Math.min(newNet, parseFloat(currentCheckStr) || 0));
      setCheckAmountStr(chk.toFixed(2));
      setCashAmountStr(Math.max(0, Math.round((newNet - chk) * 100) / 100).toFixed(2));
    }
  };

  const handleOpenPaymentModal = (record: PayrollRecord) => {
    setPaymentTargetRecord(record);
    const method = record.paymentMethod || 'ALL_CHECK';
    setPayMethod(method);
    const totalHrs = record.regularHours + record.overtimeHours;
    const tHrs = record.taxableHours !== undefined ? record.taxableHours : (method === 'ALL_CASH' ? 0 : Math.min(40, totalHrs));
    setTaxableHoursStr(tHrs.toString());
    setCashHoursStr((record.cashHours !== undefined ? record.cashHours : Math.max(0, totalHrs - tHrs)).toString());
    const initCheck = record.checkAmount !== undefined ? record.checkAmount : (method === 'ALL_CASH' ? 0 : record.netPay);
    const initCash =
      record.cashAmount !== undefined
        ? record.cashAmount
        : method === 'ALL_CHECK'
        ? 0
        : method === 'ALL_CASH'
        ? record.netPay
        : Math.max(0, Math.round((record.netPay - initCheck) * 100) / 100);
    setCheckAmountStr(initCheck.toFixed(2));
    setCashAmountStr(initCash.toFixed(2));
    setLastEditedSplitSide('check');
    setIsManualTax(record.isManualTax ?? false);
    setManualFedStr((record.manualFederalWithholding !== undefined ? record.manualFederalWithholding : record.federalWithholding).toFixed(2));
    setManualVaStr((record.manualVaWithholding !== undefined ? record.manualVaWithholding : record.vaWithholding).toFixed(2));
    setManualSsStr((record.manualSocialSecurityTax !== undefined ? record.manualSocialSecurityTax : record.socialSecurityTax).toFixed(2));
    setManualMedStr((record.manualMedicareTax !== undefined ? record.manualMedicareTax : record.medicareTax).toFixed(2));
    setPayModalError(null);
  };

  const handleSavePaymentModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetRecord || !onSavePaymentAndTaxes) return;

    const liveNet = computeLiveModalNetPay(
      paymentTargetRecord,
      isManualTax,
      manualFedStr,
      manualVaStr,
      manualSsStr,
      manualMedStr
    );

    const tHrs = parseFloat(taxableHoursStr) || 0;
    const cHrs = parseFloat(cashHoursStr) || 0;
    let chkAmt = Math.max(0, Math.min(liveNet, parseFloat(checkAmountStr) || 0));
    let cshAmt = Math.max(0, Math.round((liveNet - chkAmt) * 100) / 100);
    if (lastEditedSplitSide === 'cash' && payMethod === 'SPLIT') {
      cshAmt = Math.max(0, Math.min(liveNet, parseFloat(cashAmountStr) || 0));
      chkAmt = Math.max(0, Math.round((liveNet - cshAmt) * 100) / 100);
    }
    if (payMethod === 'ALL_CHECK') {
      chkAmt = liveNet;
      cshAmt = 0;
    } else if (payMethod === 'ALL_CASH') {
      chkAmt = 0;
      cshAmt = liveNet;
    }

    const fed = parseFloat(manualFedStr) || 0;
    const va = parseFloat(manualVaStr) || 0;
    const ss = parseFloat(manualSsStr) || 0;
    const med = parseFloat(manualMedStr) || 0;

    try {
      setIsProcessing(true);
      await onSavePaymentAndTaxes(paymentTargetRecord.id, {
        paymentMethod: payMethod,
        taxableHours: tHrs,
        cashHours: cHrs,
        checkAmount: chkAmt,
        cashAmount: cshAmt,
        isManualTax,
        manualFederalWithholding: isManualTax ? fed : undefined,
        manualVaWithholding: isManualTax ? va : undefined,
        manualSocialSecurityTax: isManualTax ? ss : undefined,
        manualMedicareTax: isManualTax ? med : undefined,
      });
      setPaymentTargetRecord(null);
    } catch (err: unknown) {
      setPayModalError(err instanceof Error ? err.message : 'Error saving payment settings');
    } finally {
      setIsProcessing(false);
    }
  };

  // CSV Export for payroll (strictly registered active employees)
  const handleExportCsv = () => {
    if (displayedRecords.length === 0) return;

    const headers = [
      'Pay Period Start (Friday)',
      'Pay Period End (Thursday)',
      'Employee ID',
      'Name',
      'Department',
      'Position',
      'Hourly Wage',
      'Regular Hours (<=40h)',
      'Overtime Hours (>40h)',
      'Regular Pay ($)',
      'Overtime Pay (1.5x) ($)',
      'Gross Pay ($)',
      'Federal Withholding ($)',
      'Virginia State Tax ($)',
      'Social Security (6.2%) ($)',
      'Medicare (1.45%) ($)',
      'Total Taxes ($)',
      'Insurance & Other Deductions ($)',
      'Net Pay ($)',
      'Is Adjusted',
    ];

    const rows = displayedRecords.map((r) => [
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
      r.isAdjusted ? 'YES' : 'NO',
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Culmore_Payroll_${currentWeekFriday}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summary totals strictly for registered active employees (respecting group filter)
  const totalGross = displayedRecords.reduce((sum, r) => sum + r.grossPay, 0);
  const totalTaxes = displayedRecords.reduce((sum, r) => sum + r.totalTaxes, 0);
  const totalNet = displayedRecords.reduce((sum, r) => sum + r.netPay, 0);
  const totalOtHours = displayedRecords.reduce((sum, r) => sum + r.overtimeHours, 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t('payrollTitle')}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isFinalized
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {isFinalized ? `🔒 ${language === 'ko' ? '마감 및 잠금됨' : 'Finalized & Locked'}` : `📝 ${language === 'ko' ? '작성 중 (DRAFT)' : 'Draft'}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ko'
              ? '연방 공정근로기준법(FLSA) 주 40시간 초과분 1.5배, 버지니아 주세 원천징수, 사회보장세(6.20%), 메디케어(1.45%) 자동 산출'
              : 'FLSA 40-hour overtime rules, Virginia state tax withholding, and FICA statutory tax calculations.'}
          </p>
        </div>

        {/* Period Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            <button
              onClick={() => onChangeWeek(getPreviousWeekFriday(currentWeekFriday))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title={t('prevWeek')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 min-w-36 text-center">
              {formatWorkWeekRange(currentWeekFriday, language)}
            </span>
            <button
              onClick={() => onChangeWeek(getNextWeekFriday(currentWeekFriday))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              title={t('nextWeek')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowTaxExplainer(true)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5"
            title="Tax Rate Disclaimers & Rules"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'ko' ? '세율 안내' : 'Tax Info'}</span>
          </button>

          {validRecords.length > 0 && !isFinalized && (
            <button
              onClick={() => {
                setShowBatchTaxModal(true);
                setBatchTaxError(null);
              }}
              className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100/70 text-blue-800 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
              title={language === 'ko' ? '원천징수 세목 일괄 적용' : 'Batch select withholding taxes'}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'ko' ? '원천징수 일괄 선택' : 'Batch Taxes'}</span>
            </button>
          )}

          {/* Business Group Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-xs">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">
                {language === 'ko' ? `전체 사업장/그룹 (${validRecords.length}건)` : `All Business Groups (${validRecords.length})`}
              </option>
              {BUSINESS_GROUPS.map((grp) => {
                const count = validRecords.filter((r) => {
                  const emp = employees.find((e) => e.employeeId === r.employeeId);
                  return getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber).id === grp.id;
                }).length;
                return (
                  <option key={grp.id} value={grp.id}>
                    {grp.name} ({count}{language === 'ko' ? '건' : ''})
                  </option>
                );
              })}
            </select>
          </div>

          {displayedRecords.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('exportCsv')}</span>
            </button>
          )}

          {/* Action buttons depending on Lock status */}
          {!isFinalized ? (
            <div className="flex items-center space-x-2">
              {/* Real-time Schedule & Staff Sync Button (Item 6) */}
              <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                title={language === 'ko' ? '직원관리의 최신 시급과 주간 스케줄의 근무시간을 급여 및 세금계산서로 실시간 동기화합니다.' : 'Sync latest staff wages and weekly schedule hours with payroll'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>
                  {language === 'ko' ? '스케줄 & 직원 연동 동기화' : 'Sync Schedule & Staff'}
                </span>
              </button>

              {validRecords.length > 0 && (
                <button
                  onClick={() => setShowFinalizeModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('finalizePayroll')}</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowReopenModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{t('reopenPayroll')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Lock Status Notification Banner */}
      {isFinalized ? (
        <div className="p-4 rounded-2xl bg-emerald-950 text-emerald-100 border border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                {t('periodFinalizedBanner')}
              </p>
              <p className="text-xs text-emerald-300">
                {payrollPeriod.finalizedBy ? `Authorized by ${payrollPeriod.finalizedBy}` : 'Audited and locked'} • {payrollPeriod.finalizedAt?.slice(0, 10)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReopenModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-xs font-bold text-emerald-200 border border-emerald-700 transition-colors"
          >
            {t('reopenPayroll')}
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">{t('periodDraftBanner')}</p>
              <p className="opacity-90">{t('autoCalculatedBanner')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Banner */}
      {displayedRecords.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Gross Payroll</span>
            <span className="text-lg font-black text-slate-900">{formatCurrency(totalGross)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{displayedRecords.length} staff processed</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Overtime Hours</span>
            <span className={`text-lg font-black ${totalOtHours > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {totalOtHours.toFixed(1)} hrs
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">1.5x FLSA rate</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Withholding & Taxes</span>
            <span className="text-lg font-black text-rose-700">{formatCurrency(totalTaxes)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">FICA + Fed + VA</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Net Employee Pay</span>
            <span className="text-lg font-black text-emerald-800">{formatCurrency(totalNet)}</span>
            <span className="text-[10px] text-emerald-700 block mt-0.5">Disbursement sum</span>
          </div>
        </div>
      )}

      {/* Main Payroll Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {displayedRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3.5">{t('tableEmp')}</th>
                  <th className="py-3 px-2 text-right">{t('tableRate')}</th>
                  <th className="py-3 px-2 text-right">{t('tableRegHours')}</th>
                  <th className="py-3 px-2 text-right">{t('tableOtHours')}</th>
                  <th className="py-3 px-2 text-right">{t('tableGrossPay')}</th>
                  <th className="py-3 px-2 text-right" title="Estimated Federal Withholding (10%)">
                    {t('tableFedTax')}
                  </th>
                  <th className="py-3 px-2 text-right" title="Virginia State Income Tax (5.0%)">
                    {t('tableVaTax')}
                  </th>
                  <th className="py-3 px-2 text-right" title="FLSA Social Security (6.20%)">
                    {t('tableSsTax')}
                  </th>
                  <th className="py-3 px-2 text-right" title="FLSA Medicare (1.45%)">
                    {t('tableMedTax')}
                  </th>
                  <th className="py-3 px-2 text-right">{t('tableTotalTaxes')}</th>
                  <th className="py-3 px-3 text-right bg-emerald-50/40 text-emerald-950 font-black">
                    {t('tableNetPay')}
                  </th>
                  <th className="py-3 px-3 text-center">{t('tableActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRecords.map((r) => {
                  const emp = employees.find((e) => e.employeeId === r.employeeId);
                  const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
                  const isFedWithheld = r.withholdFederal !== false;
                  const isVaWithheld = r.withholdVirginia !== false;
                  const isSsWithheld = r.withholdSocialSecurity !== false;
                  const isMedWithheld = r.withholdMedicare !== false;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5">
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-40">
                            {r.employeeName}
                          </span>
                          <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap gap-y-1">
                            <span className="font-mono text-[10px] text-slate-400">{r.employeeId}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${grp.badgeBg} truncate max-w-28`}
                              title={grp.name}
                            >
                              {grp.name}
                            </span>
                            <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600">{r.position}</span>
                            {/* Payment Method Badge (Item 5) */}
                            {r.paymentMethod === 'ALL_CASH' ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                {language === 'ko' ? '전체 현금' : '100% Cash'}
                              </span>
                            ) : r.paymentMethod === 'SPLIT' ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 font-bold border border-indigo-300">
                                {language === 'ko' ? `체크 $${r.checkAmount?.toFixed(0)} + 현금 $${r.cashAmount?.toFixed(0)}` : `Split: Chk $${r.checkAmount?.toFixed(0)} / Cash $${r.cashAmount?.toFixed(0)}`}
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                                {language === 'ko' ? '전체 체크' : '100% Check'}
                              </span>
                            )}
                            {/* Manual Tax Badge (Item 4) */}
                            {r.isManualTax && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-bold border border-purple-300">
                                {language === 'ko' ? '수동 세금' : 'Manual Tax'}
                              </span>
                            )}
                            {r.isAdjusted && (
                              <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold">
                                Adjusted
                              </span>
                            )}
                          </div>
                          {/* Tax Selection Badges */}
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className={`text-[9px] px-1 rounded font-mono ${
                                isFedWithheld
                                  ? 'bg-blue-50 text-blue-700 font-semibold'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                              title={isFedWithheld ? 'Federal Tax Withheld' : 'Federal Tax Exempt ($0)'}
                            >
                              Fed
                            </span>
                            <span
                              className={`text-[9px] px-1 rounded font-mono ${
                                isVaWithheld
                                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                              title={isVaWithheld ? 'VA State Tax Withheld' : 'VA State Tax Exempt ($0)'}
                            >
                              VA
                            </span>
                            <span
                              className={`text-[9px] px-1 rounded font-mono ${
                                isSsWithheld
                                  ? 'bg-purple-50 text-purple-700 font-semibold'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                              title={isSsWithheld ? 'Social Security Withheld' : 'Social Security Exempt ($0)'}
                            >
                              SS
                            </span>
                            <span
                              className={`text-[9px] px-1 rounded font-mono ${
                                isMedWithheld
                                  ? 'bg-teal-50 text-teal-700 font-semibold'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                              title={isMedWithheld ? 'Medicare Withheld' : 'Medicare Exempt ($0)'}
                            >
                              Med
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 text-right font-mono font-medium text-slate-700">
                        ${r.hourlyWage.toFixed(2)}
                      </td>

                      <td className="py-3 px-2 text-right font-mono text-slate-800">
                        {r.regularHours.toFixed(1)}
                      </td>

                      <td className="py-3 px-2 text-right font-mono font-bold text-amber-700">
                        {r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}` : '-'}
                      </td>

                      <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(r.grossPay)}
                      </td>

                      <td className="py-3 px-2 text-right font-mono">
                        {isFedWithheld ? (
                          <span className="text-slate-600">{formatCurrency(r.federalWithholding)}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] line-through font-normal" title="Exempt ($0.00)">
                            $0.00
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono">
                        {isVaWithheld ? (
                          <span className="text-slate-600">{formatCurrency(r.vaWithholding)}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] line-through font-normal" title="Exempt ($0.00)">
                            $0.00
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono">
                        {isSsWithheld ? (
                          <span className="text-slate-600">{formatCurrency(r.socialSecurityTax)}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] line-through font-normal" title="Exempt ($0.00)">
                            $0.00
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono">
                        {isMedWithheld ? (
                          <span className="text-slate-600">{formatCurrency(r.medicareTax)}</span>
                        ) : (
                          <span className="text-slate-400 text-[10px] line-through font-normal" title="Exempt ($0.00)">
                            $0.00
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right font-mono font-bold text-rose-700">
                        {formatCurrency(r.totalTaxes)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black text-sm bg-emerald-50/50 text-emerald-800">
                        {formatCurrency(r.netPay)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {!isFinalized ? (
                          <div className="flex items-center justify-center space-x-1.5">
                            {/* Payment Method & Manual Tax Settings Button (Items 4 & 5) */}
                            <button
                              onClick={() => handleOpenPaymentModal(r)}
                              className="px-2 py-1 rounded-lg border border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-[11px] font-bold text-emerald-800 transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title={language === 'ko' ? '지급 방식(체크/현금) 및 세금공제 직접 설정' : 'Payment Method & Tax Configuration'}
                            >
                              <DollarSign className="w-3 h-3 text-emerald-700" />
                              <span>{language === 'ko' ? '지급/세금' : 'Pay/Tax'}</span>
                            </button>

                            <button
                              onClick={() => handleOpenTaxModal(r)}
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/70 text-[11px] font-semibold text-blue-700 transition-colors flex items-center space-x-1 cursor-pointer"
                              title={language === 'ko' ? '원천징수 세목 선택' : 'Configure Withholdings'}
                            >
                              <SlidersHorizontal className="w-3 h-3 text-blue-600" />
                              <span>{language === 'ko' ? '세목' : 'Taxes'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setAdjustmentTargetRecord(r);
                                handleCancelEdit();
                              }}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                                r.adjustments && r.adjustments.length > 0
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-bold'
                                  : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50 text-slate-700'
                              }`}
                              title={language === 'ko' ? '추가 지급 및 공제 조정 관리' : 'Manage adjustments (bonus/deduction)'}
                            >
                              <Sliders className="w-3 h-3 text-emerald-600" />
                              <span>{language === 'ko' ? '조정' : 'Adjust'}</span>
                              {r.adjustments && r.adjustments.length > 0 && (
                                <span className="px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                                  {r.adjustments.length}
                                </span>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {language === 'ko' ? '이번 주 급여 미정산' : 'No Payroll Generated for this Workweek'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {language === 'ko'
                ? '스케줄표에 등록된 근무 시간을 바탕으로 주 40시간 초과 오버타임(1.5배)과 버지니아 원천징수 세금을 자동 정산합니다.'
                : 'Click below to compile regular hours, 1.5x overtime, statutory FICA taxes, and net disbursements.'}
            </p>
            <button
              onClick={handleGenerate}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-700/20 inline-flex items-center space-x-2 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{t('generatePayroll')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tax Rates Transparency Modal */}
      {showTaxExplainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {t('taxSettingsNotice')}
                </h3>
              </div>
              <button
                onClick={() => setShowTaxExplainer(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>{t('taxExplanationText')}</p>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Social Security Tax (OASDI):</span>
                  <span className="text-emerald-700 font-bold">6.20% (FLSA Statutory)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Medicare Tax (Hospital Ins):</span>
                  <span className="text-emerald-700 font-bold">1.45% (FLSA Statutory)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Virginia State Withholding:</span>
                  <span className="text-slate-800 font-bold">{settings.vaTaxDefaultRate}% (Editable Estimate)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Federal Income Tax:</span>
                  <span className="text-slate-800 font-bold">{settings.federalTaxDefaultRate}% (Editable Estimate)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800">Overtime Multiplier:</span>
                  <span className="text-amber-700 font-bold">{settings.overtimeMultiplier}x rate (Hours &gt; 40)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Rates can be adjusted in the "Store Settings & Compliance" tab by an authorized administrator.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowTaxExplainer(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize & Lock Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-slate-900 mb-3">
              <Lock className="w-6 h-6 text-emerald-600" />
              <h3 className="text-base font-bold">{t('finalizeModalTitle')}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {t('finalizeModalDesc')}
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 mb-5 space-y-1">
              <p>Period: {formatWorkWeekRange(currentWeekFriday, language)}</p>
              <p>Total Gross: {formatCurrency(totalGross)}</p>
              <p>Net Disbursement: {formatCurrency(totalNet)}</p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmFinalize}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isProcessing ? 'Locking...' : t('confirmFinalize')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Finalized Payroll Modal (Requires Justification for Audit Trail) */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-amber-600 mb-3">
              <Unlock className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">{t('reopenModalTitle')}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {t('reopenModalDesc')}
            </p>

            <form onSubmit={handleConfirmReopen} className="space-y-3">
              {reopenError && (
                <p className="text-xs text-rose-600 font-bold">{reopenError}</p>
              )}
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder={t('reopenReasonPlaceholder')}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Authorizing...' : t('confirmReopen')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustments Manager Modal (Supports Negative Deductions, Editing, and Deletion) */}
      {adjustmentTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '급여 조정 항목 관리' : 'Payroll Adjustments Manager'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {adjustmentTargetRecord.employeeName} ({adjustmentTargetRecord.employeeId}) • {adjustmentTargetRecord.position}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAdjustmentTargetRecord(null);
                  handleCancelEdit();
                }}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {adjustmentError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{adjustmentError}</span>
                </div>
              )}

              {/* 1. Existing Adjustments Roster */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                    {language === 'ko' ? '등록된 조정 내역' : 'Registered Adjustments'}
                    {adjustmentTargetRecord.adjustments && adjustmentTargetRecord.adjustments.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px]">
                        {adjustmentTargetRecord.adjustments.length}
                      </span>
                    )}
                  </h4>

                  {adjustmentTargetRecord.adjustments && adjustmentTargetRecord.adjustments.length > 0 && (
                    <div className="text-[11px] font-mono font-bold">
                      <span className="text-slate-500 mr-1">{language === 'ko' ? '조정 합계' : 'Net Sum'}:</span>
                      <span
                        className={
                          adjustmentTargetRecord.adjustments.reduce((sum, a) => sum + a.amount, 0) >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }
                      >
                        {formatCurrency(adjustmentTargetRecord.adjustments.reduce((sum, a) => sum + a.amount, 0))}
                      </span>
                    </div>
                  )}
                </div>

                {adjustmentTargetRecord.adjustments && adjustmentTargetRecord.adjustments.length > 0 ? (
                  <div className="space-y-2">
                    {adjustmentTargetRecord.adjustments.map((adj) => {
                      const isNegative = adj.amount < 0;
                      const isCurrentlyEditing = editingAdjId === adj.id;

                      return (
                        <div
                          key={adj.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isCurrentlyEditing
                              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5 flex-1 pr-2">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-mono font-black text-xs ${
                                    isNegative
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {isNegative ? `-${formatCurrency(Math.abs(adj.amount))}` : `+${formatCurrency(adj.amount)}`}
                                </span>
                                <span className="font-bold text-slate-900 text-xs">{adj.reason}</span>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                {new Date(adj.timestamp).toLocaleString()} • {adj.adminEmail}
                              </p>
                            </div>

                            {/* Actions: Edit & Delete */}
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditAdjustment(adj)}
                                disabled={isProcessing}
                                className={`p-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                                  isCurrentlyEditing
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600'
                                }`}
                                title={language === 'ko' ? '조정 항목 수정' : 'Edit Adjustment'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAdjustment(adj.id)}
                                disabled={isProcessing}
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-colors"
                                title={language === 'ko' ? '조정 항목 삭제' : 'Delete Adjustment'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-400">
                    {language === 'ko'
                      ? '등록된 추가 지급 또는 공제 차감 내역이 없습니다.'
                      : 'No adjustments recorded for this employee yet.'}
                  </div>
                )}
              </div>

              {/* 2. Adjustment Form (Add / Edit) */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                    {editingAdjId ? (
                      <>
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-700">{language === 'ko' ? '조정 항목 내용 수정' : 'Edit Adjustment'}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{language === 'ko' ? '새 조정 항목 등록' : 'Add New Adjustment'}</span>
                      </>
                    )}
                  </h4>

                  {editingAdjId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                    >
                      {language === 'ko' ? '수정 취소' : 'Cancel Edit'}
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveAdjustment} className="space-y-3.5">
                  {/* Plus / Minus Type Selector */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '조정 유형 선택' : 'Adjustment Type'} *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdjustmentType('bonus')}
                        className={`p-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                          adjustmentType === 'bonus'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === 'ko' ? '+ 추가 지급 (Bonus / 성과급)' : '+ Addition (Bonus)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdjustmentType('deduction')}
                        className={`p-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                          adjustmentType === 'deduction'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>—</span>
                        <span>{language === 'ko' ? '— 공제 차감 (Deduction / 차감)' : '— Deduction (Reduction)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input with sign support */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '조정 금액 ($ USD, - 입력 가능)' : 'Amount ($ USD, negative supported)'} *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold font-mono text-slate-400">
                        {adjustmentType === 'deduction' ? '-$' : '+$'}
                      </span>
                      <input
                        type="text"
                        required
                        value={adjustmentAmountStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdjustmentAmountStr(val);
                          // If user explicitly typed a minus sign, automatically set to deduction
                          if (val.trim().startsWith('-')) {
                            setAdjustmentType('deduction');
                          }
                        }}
                        placeholder="50.00"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    {/* Quick amount shortcuts */}
                    <div className="flex items-center space-x-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">{language === 'ko' ? '빠른 입력:' : 'Quick:'}</span>
                      {['25.00', '50.00', '100.00', '150.00'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAdjustmentAmountStr(amt)}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-mono font-bold text-slate-600"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason Input */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      {t('adjustmentReason')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder={
                        adjustmentType === 'deduction'
                          ? (language === 'ko' ? '예: 유니폼 보증금 공제, 식대 차감, 결근 환수' : 'e.g. Uniform deposit, meal allowance deduction')
                          : (language === 'ko' ? '예: 추석 특별 보너스, 소급 근무 수당' : 'e.g. Holiday performance bonus, retroactive pay')
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] text-slate-400">
                      {language === 'ko'
                        ? '모든 조정 및 수정 내역은 감사 로그와 급여 명세서(Paystub)에 영구 기록됩니다.'
                        : 'All adjustments and modifications are recorded in the audit trail & paystubs.'}
                    </p>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className={`px-5 py-2 rounded-xl font-bold text-white shadow-xs transition-colors shrink-0 ${
                        editingAdjId
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : adjustmentType === 'deduction'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isProcessing
                        ? 'Saving...'
                        : editingAdjId
                        ? (language === 'ko' ? '수정 내용 저장' : 'Update Adjustment')
                        : (language === 'ko' ? '조정 항목 추가' : 'Add Adjustment')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {language === 'ko' ? '조정 사항은 급여 총액 및 세금/실수령액에 실시간 반영됩니다.' : 'Reflected in Gross, Taxes and Net Pay immediately.'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdjustmentTargetRecord(null);
                  handleCancelEdit();
                }}
                className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs"
              >
                {language === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Employee Withholding Tax Modal */}
      {taxTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '원천징수 세목 선택' : 'Withholding Tax Selections'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {taxTargetRecord.employeeName} ({taxTargetRecord.employeeId}) • {taxTargetRecord.position}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTaxTargetRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTaxSelections} className="space-y-4 text-xs">
              {taxError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  {taxError}
                </div>
              )}

              <p className="text-slate-600 leading-relaxed">
                {language === 'ko'
                  ? '해당 직원의 이번 주 급여에서 공제할 세목을 선택하십시오. 체크 해제된 항목은 $0.00으로 면제 계산되어 실수령액에 반영됩니다.'
                  : 'Select which withholding taxes apply to this employee for this pay period. Unchecked taxes calculate to $0.00.'}
              </p>

              {/* Quick Preset Buttons */}
              <div className="flex items-center space-x-2 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmpWithholdFed(true);
                    setEmpWithholdVA(true);
                    setEmpWithholdSS(true);
                    setEmpWithholdMed(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  {language === 'ko' ? '모두 공제 (기본)' : 'Select All (Full)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmpWithholdFed(false);
                    setEmpWithholdVA(false);
                    setEmpWithholdSS(false);
                    setEmpWithholdMed(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  {language === 'ko' ? '모두 면제 (0원)' : 'Deselect All (Exempt)'}
                </button>
              </div>

              {/* Tax Checkbox Cards */}
              <div className="space-y-2.5">
                <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={empWithholdFed}
                    onChange={(e) => setEmpWithholdFed(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{t('applyFederalTax')}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {settings.federalTaxDefaultRate}% (Est. {formatCurrency(taxTargetRecord.grossPay * (settings.federalTaxDefaultRate / 100))})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '연방 소득세 원천징수 (IRS W-4 기준)' : 'Federal Income Tax withholding per W-4'}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={empWithholdVA}
                    onChange={(e) => setEmpWithholdVA(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{t('applyVaTax')}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {settings.vaTaxDefaultRate}% (Est. {formatCurrency(taxTargetRecord.grossPay * (settings.vaTaxDefaultRate / 100))})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '버지니아주 개인소득세 (VA-4 기준 5.0%)' : 'Virginia state income tax withholding'}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={empWithholdSS}
                    onChange={(e) => setEmpWithholdSS(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{t('applySocialSecurity')}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        6.20% (FLSA {formatCurrency(taxTargetRecord.grossPay * 0.062)})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '사회보장세 FICA OASDI 법정 필수분' : 'FICA Social Security statutory tax'}
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={empWithholdMed}
                    onChange={(e) => setEmpWithholdMed(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{t('applyMedicare')}</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        1.45% (FLSA {formatCurrency(taxTargetRecord.grossPay * 0.0145)})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '메디케어 병원보험 FICA 법정 필수분' : 'FICA Medicare hospital insurance tax'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTaxTargetRecord(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  {isProcessing ? 'Saving...' : t('saveTaxOptions')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Method & Manual Tax Deduction Modal (Items 4 & 5) */}
      {paymentTargetRecord && (() => {
        const liveModalNetPay = computeLiveModalNetPay(
          paymentTargetRecord,
          isManualTax,
          manualFedStr,
          manualVaStr,
          manualSsStr,
          manualMedStr
        );

        const handleManualTaxChange = (
          field: 'fed' | 'va' | 'ss' | 'med',
          val: string
        ) => {
          const nextFed = field === 'fed' ? val : manualFedStr;
          const nextVa = field === 'va' ? val : manualVaStr;
          const nextSs = field === 'ss' ? val : manualSsStr;
          const nextMed = field === 'med' ? val : manualMedStr;
          if (field === 'fed') setManualFedStr(val);
          if (field === 'va') setManualVaStr(val);
          if (field === 'ss') setManualSsStr(val);
          if (field === 'med') setManualMedStr(val);
          const nextNet = computeLiveModalNetPay(
            paymentTargetRecord,
            isManualTax,
            nextFed,
            nextVa,
            nextSs,
            nextMed
          );
          syncAmountsWithNetPay(nextNet, payMethod, lastEditedSplitSide, checkAmountStr, cashAmountStr);
        };

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '급여 지급 방식 및 세금공제 직접 설정' : 'Payment Method & Tax Deduction Settings'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {paymentTargetRecord.employeeName} ({paymentTargetRecord.employeeId}) • {language === 'ko' ? '시급: ' : 'Wage: '}${paymentTargetRecord.hourlyWage.toFixed(2)}/h • {language === 'ko' ? '총근무: ' : 'Total: '}{(paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours).toFixed(1)}{language === 'ko' ? '시간' : ' hrs'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentTargetRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePaymentModal} className="space-y-4 text-xs">
              {payModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  {payModalError}
                </div>
              )}

              {/* Live Net Pay Banner */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 block">
                    {language === 'ko' ? '실지급 총액 (Check + Cash 합계 기준)' : 'Total Net Payroll (Check + Cash Total)'}
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    {language === 'ko'
                      ? 'Check 또는 Cash 한쪽 금액을 입력하면 나머지 금액이 자동 계산됩니다.'
                      : 'Enter either Check or Cash amount — the counterpart updates automatically.'}
                  </span>
                </div>
                <span className="text-lg font-black font-mono text-emerald-900">
                  {formatCurrency(liveModalNetPay)}
                </span>
              </div>

              {/* 1. Payment Method Selection (Item 5) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-900 block text-xs">
                  {language === 'ko' ? '1. 급여 지급 방식 선택' : '1. Select Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPayMethod('ALL_CHECK');
                      const total = paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours;
                      setTaxableHoursStr(total.toString());
                      setCashHoursStr('0');
                      setCheckAmountStr(liveModalNetPay.toFixed(2));
                      setCashAmountStr('0.00');
                      setLastEditedSplitSide('check');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      payMethod === 'ALL_CHECK'
                        ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-xs">{language === 'ko' ? '전체 체크' : '100% Check'}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{language === 'ko' ? '전액 체크 발행' : 'Full Check'}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPayMethod('ALL_CASH');
                      const total = paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours;
                      setTaxableHoursStr('0');
                      setCashHoursStr(total.toString());
                      setCheckAmountStr('0.00');
                      setCashAmountStr(liveModalNetPay.toFixed(2));
                      setLastEditedSplitSide('cash');
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      payMethod === 'ALL_CASH'
                        ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-xs">{language === 'ko' ? '전체 현금' : '100% Cash'}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{language === 'ko' ? '전액 현금 지급' : 'Full Cash'}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPayMethod('SPLIT');
                      const total = paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours;
                      const standardTaxable = Math.min(40, total);
                      setTaxableHoursStr(standardTaxable.toString());
                      setCashHoursStr(Math.max(0, total - standardTaxable).toString());
                      syncAmountsWithNetPay(liveModalNetPay, 'SPLIT', lastEditedSplitSide, checkAmountStr, cashAmountStr);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      payMethod === 'SPLIT'
                        ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-xs">{language === 'ko' ? '체크 + 현금 분할' : 'Check + Cash'}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{language === 'ko' ? '시간 및 금액 분할' : 'Split Pay'}</p>
                  </button>
                </div>
              </div>

              {/* 2. Taxable Hours & Cash Hours (Item 5) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 block text-xs">
                    {language === 'ko' ? '2. 세금공제 시간 및 현금/체크 분할 시간' : '2. Taxable Hours & Split'}
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">
                    {language === 'ko' ? `주간 총 근무: ${(paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours).toFixed(1)}시간` : `Total: ${(paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours).toFixed(1)}h`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '세금 공제 대상 시간 (Taxable Hours)' : 'Taxable Hours'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={taxableHoursStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaxableHoursStr(val);
                        const num = parseFloat(val) || 0;
                        const total = paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours;
                        setCashHoursStr(Math.max(0, total - num).toFixed(1));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '원천징수 세금이 차감되는 체크 대상 시간' : 'Hours subject to payroll taxes'}
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '현금 대상 시간 (Cash Hours)' : 'Cash Hours'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={cashHoursStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCashHoursStr(val);
                        const num = parseFloat(val) || 0;
                        const total = paymentTargetRecord.regularHours + paymentTargetRecord.overtimeHours;
                        setTaxableHoursStr(Math.max(0, total - num).toFixed(1));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {language === 'ko' ? '세금 공제 없이 현금으로 정산할 시간' : 'Hours disbursed directly in cash'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '체크 지급액 ($ Check Amount)' : 'Check Amount ($)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={liveModalNetPay}
                        value={checkAmountStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCheckAmountStr(val);
                          setLastEditedSplitSide('check');
                          const raw = parseFloat(val);
                          const chk = isNaN(raw) ? 0 : Math.max(0, Math.min(liveModalNetPay, raw));
                          const autoCash = Math.max(0, Math.round((liveModalNetPay - chk) * 100) / 100);
                          setCashAmountStr(autoCash.toFixed(2));
                          if (payMethod !== 'SPLIT') setPayMethod('SPLIT');
                        }}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {language === 'ko' ? '현금 지급액 ($ Cash Amount)' : 'Cash Amount ($)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={liveModalNetPay}
                        value={cashAmountStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCashAmountStr(val);
                          setLastEditedSplitSide('cash');
                          const raw = parseFloat(val);
                          const csh = isNaN(raw) ? 0 : Math.max(0, Math.min(liveModalNetPay, raw));
                          const autoCheck = Math.max(0, Math.round((liveModalNetPay - csh) * 100) / 100);
                          setCheckAmountStr(autoCheck.toFixed(2));
                          if (payMethod !== 'SPLIT') setPayMethod('SPLIT');
                        }}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-amber-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Manual Tax Deductions Override (Item 4) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-900 text-xs">
                    <input
                      type="checkbox"
                      checked={isManualTax}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsManualTax(checked);
                        const nextNet = computeLiveModalNetPay(
                          paymentTargetRecord,
                          checked,
                          manualFedStr,
                          manualVaStr,
                          manualSsStr,
                          manualMedStr
                        );
                        syncAmountsWithNetPay(nextNet, payMethod, lastEditedSplitSide, checkAmountStr, cashAmountStr);
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                    <span>{language === 'ko' ? '3. 세금 공제액 직접 수기 입력 (Manual Tax Override)' : '3. Direct Manual Tax Deductions'}</span>
                  </label>
                  <span className="text-[10px] text-purple-700 font-bold">
                    {isManualTax ? (language === 'ko' ? '직접 입력 활성화됨' : 'Manual Enabled') : (language === 'ko' ? '법정 자동 계산 사용' : 'Automatic')}
                  </span>
                </div>

                {isManualTax ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '연방 소득세 (Federal Tax)' : 'Federal Income Tax'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={manualFedStr}
                          onChange={(e) => handleManualTaxChange('fed', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '버지니아 주세 (Virginia State Tax)' : 'Virginia State Tax'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={manualVaStr}
                          onChange={(e) => handleManualTaxChange('va', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '사회보장세 (Social Security 6.2%)' : 'Social Security (6.2%)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={manualSsStr}
                          onChange={(e) => handleManualTaxChange('ss', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">
                        {language === 'ko' ? '메디케어 (Medicare 1.45%)' : 'Medicare (1.45%)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={manualMedStr}
                          onChange={(e) => handleManualTaxChange('med', e.target.value)}
                          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {language === 'ko' ? '체크박스를 활성화하면 원천징수 세금 금액(연방세, 주세, FICA)을 원하는 값으로 직접 입력하여 공제할 수 있습니다.' : 'Check this box to manually enter federal, state, and FICA deductions directly.'}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentTargetRecord(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {isProcessing ? 'Saving...' : (language === 'ko' ? '설정 저장 및 급여 반영' : 'Save & Update Payroll')}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Batch Withholding Tax Modal */}
      {showBatchTaxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t('batchWithholdingTitle')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ko'
                      ? `현재 주차 총 ${payrollRecords.length}명의 급여 명세에 일괄 적용`
                      : `Batch apply to all ${payrollRecords.length} payroll records in this period`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchTaxModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBatchTaxSelections} className="space-y-4 text-xs">
              {batchTaxError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  {batchTaxError}
                </div>
              )}

              <p className="text-slate-600 leading-relaxed">
                {t('batchWithholdingDesc')}
              </p>

              {/* Quick Presets */}
              <div className="flex items-center space-x-2 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setBatchWithholdFed(true);
                    setBatchWithholdVA(true);
                    setBatchWithholdSS(true);
                    setBatchWithholdMed(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  {language === 'ko' ? '전체 공제 적용' : 'Apply All'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBatchWithholdFed(false);
                    setBatchWithholdVA(false);
                    setBatchWithholdSS(false);
                    setBatchWithholdMed(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                >
                  {language === 'ko' ? '전체 면제 설정' : 'Exempt All'}
                </button>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2.5">
                <label className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={batchWithholdFed}
                    onChange={(e) => setBatchWithholdFed(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{t('applyFederalTax')}</span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ko' ? '연방 소득세 원천징수 (표준 10%)' : 'Federal Income Tax withholding (Standard 10%)'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={batchWithholdVA}
                    onChange={(e) => setBatchWithholdVA(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{t('applyVaTax')}</span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ko' ? '버지니아주 소득세 원천징수 (5.0%)' : 'Virginia state income tax withholding (5.0%)'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={batchWithholdSS}
                    onChange={(e) => setBatchWithholdSS(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{t('applySocialSecurity')}</span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ko' ? '사회보장세 FICA (6.20%)' : 'FICA Social Security (6.20%)'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={batchWithholdMed}
                    onChange={(e) => setBatchWithholdMed(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{t('applyMedicare')}</span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ko' ? '메디케어 병원보험 FICA (1.45%)' : 'FICA Medicare hospital insurance (1.45%)'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                {t('taxExemptNotice')}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchTaxModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors"
                >
                  {isProcessing ? 'Applying...' : language === 'ko' ? '전체 적용' : 'Apply to All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
