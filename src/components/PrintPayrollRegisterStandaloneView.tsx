import React, { useEffect, useState } from 'react';
import { Printer, X, Download, AlertCircle } from 'lucide-react';
import { Employee, PayrollRecord, PayrollPeriod, StoreSettings, BUSINESS_GROUPS, getBusinessGroup } from '../types';
import { formatCurrency, isCashierEmployee } from '../utils/calculations';
import { formatWorkWeekRange } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';
import { fetchPayrollRecords, fetchPayrollPeriod } from '../firebase/dataService';
import { useAuth } from '../context/AuthContext';

interface PrintPayrollRegisterStandaloneViewProps {
  weekFriday: string;
  selectedGroup: string;
  employees: Employee[];
  settings: StoreSettings;
  payrollRecords: PayrollRecord[];
  payrollPeriod: PayrollPeriod | null;
}

export const PrintPayrollRegisterStandaloneView: React.FC<PrintPayrollRegisterStandaloneViewProps> = ({
  weekFriday,
  selectedGroup,
  employees,
  settings,
  payrollRecords,
  payrollPeriod,
}) => {
  const { language } = useLanguage();
  const { isDemoMode } = useAuth();

  const [records, setRecords] = useState<PayrollRecord[]>(payrollRecords);
  const [period, setPeriod] = useState<PayrollPeriod | null>(payrollPeriod);
  const [isLoading, setIsLoading] = useState<boolean>(payrollRecords.length === 0);

  // Resolves business name reliably
  const displayStoreName =
    settings.storeName && !settings.storeName.includes('Hanaro') && !settings.storeName.includes('CMORE')
      ? settings.storeName
      : 'MANAGEMENT OF CULMORE';

  // Load records from Firestore / LocalStorage if not in props
  useEffect(() => {
    let isMounted = true;
    if (payrollRecords.length > 0 && period) {
      setRecords(payrollRecords);
      setPeriod(payrollPeriod);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const periodId = `period_${weekFriday}`;
        const [p, r] = await Promise.all([
          fetchPayrollPeriod(isDemoMode, periodId),
          fetchPayrollRecords(isDemoMode, periodId),
        ]);
        if (isMounted) {
          setPeriod(p || null);
          setRecords(r || []);
        }
      } catch (err) {
        console.error('Failed to load payroll register for printing:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [weekFriday, isDemoMode, payrollRecords, payrollPeriod, period]);

  // Filter records by selectedGroup and ensure only working employees with hours/pay are displayed
  const displayedRecords = records.filter((r) => {
    const hasWork =
      r.regularHours > 0 ||
      r.overtimeHours > 0 ||
      r.grossPay > 0 ||
      (r.adjustments && r.adjustments.length > 0);
    if (!hasWork) return false;
    if (selectedGroup === 'ALL') return true;
    const emp = employees.find((e) => e.employeeId === r.employeeId);
    const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
    return grp.id === selectedGroup;
  });

  const sumRegHours = displayedRecords.reduce((sum, r) => sum + r.regularHours, 0);
  const sumOtHours = displayedRecords.reduce((sum, r) => sum + r.overtimeHours, 0);
  const sumGross = displayedRecords.reduce((sum, r) => sum + r.grossPay, 0);
  const sumFIT = displayedRecords.reduce((sum, r) => sum + r.federalWithholding, 0);
  const sumSIT = displayedRecords.reduce((sum, r) => sum + r.vaWithholding, 0);
  const sumFICA = displayedRecords.reduce((sum, r) => sum + (r.socialSecurityTax + r.medicareTax), 0);
  const sumTaxes = displayedRecords.reduce((sum, r) => sum + r.totalTaxes, 0);
  const sumNet = displayedRecords.reduce((sum, r) => sum + r.netPay, 0);

  const selectedGrpObj = selectedGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === selectedGroup) : null;
  const branchHeader = selectedGrpObj
    ? selectedGrpObj.name
    : language === 'ko'
    ? '전체 사업장 통합 (All Branches)'
    : 'All Branches';

  // Auto trigger print on top-level window
  useEffect(() => {
    if (isLoading || displayedRecords.length === 0) return;
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('Auto print failed:', err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [isLoading, displayedRecords.length]);

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-6 print:p-0 font-sans">
      {/* Floating Action Bar (Hidden on print) */}
      <div className="no-print mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 sticky top-4 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm">
              {displayStoreName} — {language === 'ko' ? '주간 급여 대장 인쇄 모드' : 'Payroll Register Print Mode'}
            </h1>
            <p className="text-xs text-slate-400">
              {branchHeader} • Pay Date: {weekFriday} (Friday)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ko' ? '지금 바로 인쇄하기 (Print)' : 'Print Now'}</span>
          </button>

          <button
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.search = '';
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{language === 'ko' ? '닫기 / 돌아가기' : 'Close'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 font-medium">
          {language === 'ko' ? '급여 대장 데이터를 불러오는 중입니다...' : 'Loading payroll register...'}
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="p-12 text-center text-rose-500 font-bold bg-rose-50 rounded-2xl border border-rose-200 max-w-lg mx-auto">
          {language === 'ko'
            ? '해당 주차 및 사업장에 생성된 급여 데이터가 없습니다.'
            : 'No payroll records compiled for this week and group.'}
        </div>
      ) : (
        /* Printable Official Payroll Register Document */
        <div className="bg-white p-6 border-2 border-slate-300 rounded-xl max-w-6xl mx-auto printable-document">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {displayStoreName}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {branchHeader} • {settings.address}, {settings.city}, {settings.state} {settings.zipCode}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Phone: {settings.phone} • Employer EIN: {settings.ein}
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-sm font-black uppercase text-slate-900">
                OFFICIAL WEEKLY PAYROLL REGISTER (주간 급여 대장)
              </h2>
              <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">
                Pay Date: {weekFriday} (Friday)
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Period: {formatWorkWeekRange(weekFriday, 'en')}
              </p>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="my-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs flex flex-wrap justify-between items-center font-mono gap-2">
            <div>
              <span className="font-sans font-bold text-slate-600 mr-1">Headcount:</span>
              <span className="font-black text-slate-900">{displayedRecords.length} staff</span>
            </div>
            <div>
              <span className="font-sans font-bold text-slate-600 mr-1">Hours:</span>
              <span className="font-black text-slate-900">{sumRegHours.toFixed(1)}h reg + {sumOtHours.toFixed(1)}h OT</span>
            </div>
            <div>
              <span className="font-sans font-bold text-slate-600 mr-1">Gross Earnings:</span>
              <span className="font-black text-slate-900">{formatCurrency(sumGross)}</span>
            </div>
            <div>
              <span className="font-sans font-bold text-slate-600 mr-1">Total Taxes:</span>
              <span className="font-black text-rose-700">-{formatCurrency(sumTaxes)}</span>
            </div>
            <div>
              <span className="font-sans font-black text-emerald-900 mr-1">Net Disbursement:</span>
              <span className="font-black text-emerald-950 text-sm">{formatCurrency(sumNet)}</span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left border-collapse text-[11px] font-mono mt-3">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase text-[10px] text-slate-800">
                <th className="py-1.5 px-2">ID</th>
                <th className="py-1.5 px-2">Employee Name</th>
                <th className="py-1.5 px-2">Branch / Group</th>
                <th className="py-1.5 px-2">Department / Position</th>
                <th className="py-1.5 px-1.5 text-right">Reg H</th>
                <th className="py-1.5 px-1.5 text-right">OT H</th>
                <th className="py-1.5 px-2 text-right">Gross ($)</th>
                <th className="py-1.5 px-2 text-right">FIT ($)</th>
                <th className="py-1.5 px-2 text-right">SIT ($)</th>
                <th className="py-1.5 px-2 text-right">FICA ($)</th>
                <th className="py-1.5 px-2 text-right bg-emerald-50 text-emerald-950 font-black">Net Pay ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedRecords.map((r) => {
                const emp = employees.find((e) => e.employeeId === r.employeeId);
                const grp = getBusinessGroup(r.businessGroup || r.groupNumber || emp?.businessGroup || emp?.groupNumber);
                const isCashier = isCashierEmployee(r.department, r.position);

                return (
                  <tr key={r.id}>
                    <td className="py-1.5 px-2 font-bold">{r.employeeId}</td>
                    <td className="py-1.5 px-2 font-sans font-bold text-slate-900">
                      <span>{r.employeeName}</span>
                      {isCashier && (
                        <span className="ml-1 text-[9px] font-bold text-amber-800 bg-amber-100 px-1 py-0.2 rounded">
                          캐셔
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-sans">{grp.shortName}</td>
                    <td className="py-1.5 px-2 font-sans text-slate-600">
                      {r.department} ({r.position})
                    </td>
                    <td className="py-1.5 px-1.5 text-right">{r.regularHours.toFixed(1)}</td>
                    <td className="py-1.5 px-1.5 text-right text-amber-800 font-bold">
                      {r.overtimeHours > 0 ? `+${r.overtimeHours.toFixed(1)}` : '-'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-slate-900">{formatCurrency(r.grossPay)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-700">{formatCurrency(r.federalWithholding)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-700">{formatCurrency(r.vaWithholding)}</td>
                    <td className="py-1.5 px-2 text-right text-slate-700">
                      {formatCurrency(r.socialSecurityTax + r.medicareTax)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-black bg-emerald-50 text-emerald-950 text-xs">
                      {formatCurrency(r.netPay)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-900 font-bold bg-slate-100 text-slate-900">
              <tr>
                <td colSpan={4} className="py-2 px-2 uppercase font-sans font-black">
                  Total Summary ({displayedRecords.length} staff)
                </td>
                <td className="py-2 px-1.5 text-right">{sumRegHours.toFixed(1)}</td>
                <td className="py-2 px-1.5 text-right text-amber-800">
                  {sumOtHours > 0 ? `+${sumOtHours.toFixed(1)}` : '-'}
                </td>
                <td className="py-2 px-2 text-right font-black">{formatCurrency(sumGross)}</td>
                <td className="py-2 px-2 text-right text-slate-800">{formatCurrency(sumFIT)}</td>
                <td className="py-2 px-2 text-right text-slate-800">{formatCurrency(sumSIT)}</td>
                <td className="py-2 px-2 text-right text-slate-800">{formatCurrency(sumFICA)}</td>
                <td className="py-2 px-2 text-right font-black bg-emerald-100 text-emerald-950 text-sm">
                  {formatCurrency(sumNet)}
                </td>
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
      )}
    </div>
  );
};
