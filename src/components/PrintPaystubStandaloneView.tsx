import React, { useEffect, useState } from 'react';
import { Printer, X, Download, AlertCircle } from 'lucide-react';
import { Employee, PayrollRecord, StoreSettings, getBusinessGroup } from '../types';
import { formatCurrency } from '../utils/calculations';
import { formatWorkWeekRange } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';
import { useExchangeRate } from '../context/ExchangeRateContext';
import { fetchPayrollRecords } from '../firebase/dataService';
import { useAuth } from '../context/AuthContext';

interface PrintPaystubStandaloneViewProps {
  weekFriday: string;
  employeeId: string;
  employees: Employee[];
  settings: StoreSettings;
  payrollRecords: PayrollRecord[];
}

export const PrintPaystubStandaloneView: React.FC<PrintPaystubStandaloneViewProps> = ({
  weekFriday,
  employeeId,
  employees,
  settings,
  payrollRecords,
}) => {
  const { language, t } = useLanguage();
  const { usdToKrwRate } = useExchangeRate();
  const { isDemoMode } = useAuth();

  const [record, setRecord] = useState<PayrollRecord | null>(
    payrollRecords.find((r) => r.employeeId === employeeId) || null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!record);

  const employee = employees.find((e) => e.employeeId === employeeId);
  const grp = getBusinessGroup(record?.businessGroup || record?.groupNumber || employee?.businessGroup || employee?.groupNumber);

  // Resolves business name reliably
  const displayStoreName =
    settings.storeName && !settings.storeName.includes('Hanaro') && !settings.storeName.includes('CMORE')
      ? settings.storeName
      : 'MANAGEMENT OF CULMORE';

  // If record is not in props, fetch from Firestore / LocalStorage
  useEffect(() => {
    let isMounted = true;
    if (record) return;

    const loadRecord = async () => {
      setIsLoading(true);
      try {
        const periodId = `period_${weekFriday}`;
        const records = await fetchPayrollRecords(isDemoMode, periodId);
        if (isMounted) {
          const found = records.find((r) => r.employeeId === employeeId);
          setRecord(found || null);
        }
      } catch (err) {
        console.error('Failed to load standalone paystub record:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRecord();
    return () => {
      isMounted = false;
    };
  }, [weekFriday, employeeId, isDemoMode, record]);

  // Auto trigger print once loaded (top-level window)
  useEffect(() => {
    if (!record || isLoading) return;
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn('Auto print failed:', err);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [record, isLoading]);

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
              {displayStoreName} — {language === 'ko' ? '직원 급여명세서 인쇄 모드' : 'Paystub Print Mode'}
            </h1>
            <p className="text-xs text-slate-400">
              {record?.employeeName} ({employeeId}) • Pay Date: {weekFriday} (Friday)
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
          {language === 'ko' ? '급여명세서 데이터를 불러오는 중입니다...' : 'Loading paystub document...'}
        </div>
      ) : !record ? (
        <div className="p-12 text-center text-rose-500 font-bold bg-rose-50 rounded-2xl border border-rose-200 max-w-lg mx-auto">
          {language === 'ko'
            ? '해당 직원의 급여명세서 기록을 찾을 수 없습니다.'
            : 'Paystub record not found for this employee and date.'}
        </div>
      ) : (
        /* Printable Official Paystub Document */
        <div className="bg-white p-8 rounded-2xl border-2 border-slate-300 shadow-md max-w-4xl mx-auto printable-document">
          {/* Store & Paystub Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {grp.name || displayStoreName}
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                {displayStoreName} • {grp.name} • {settings.address}, {settings.city}, {settings.state} {settings.zipCode}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Phone: {settings.phone} • Employer EIN: {settings.ein}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs uppercase">
                Official Payroll Statement
              </span>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                Pay Date: {weekFriday} (Friday disbursement)
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Period: {formatWorkWeekRange(weekFriday, 'en')}
              </p>
            </div>
          </div>

          {/* Employee Summary Card */}
          <div className="my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee Name</span>
              <span className="font-black text-slate-900 text-sm">{record.employeeName}</span>
              {employee?.fullNameKo && (
                <span className="text-slate-500 block text-[11px]">{employee.fullNameKo}</span>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Employee ID</span>
              <span className="font-bold text-slate-800">{record.employeeId}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Branch / Group</span>
              <span className="font-bold text-slate-900 block truncate">{grp.name}</span>
              <span className="text-[10px] text-slate-500 block">{grp.shortName}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Department / Role</span>
              <span className="font-bold text-slate-800">{record.department}</span>
              <span className="text-[10px] text-slate-500 block">{record.position}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-bold block">Hourly Rate</span>
              <span className="font-bold text-emerald-700 text-sm">${record.hourlyWage.toFixed(2)}/hr</span>
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
                    <td className="py-2.5 px-2 text-right">{record.regularHours.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-right">${record.hourlyWage.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(record.regularPay)}
                    </td>
                  </tr>
                  {record.overtimeHours > 0 && (
                    <tr className="bg-amber-50/50">
                      <td className="py-2.5 px-3 font-semibold text-amber-900">Overtime Pay (1.5x)</td>
                      <td className="py-2.5 px-2 text-right font-bold text-amber-800">
                        {record.overtimeHours.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right">${(record.hourlyWage * 1.5).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-900">
                        {formatCurrency(record.overtimePay)}
                      </td>
                    </tr>
                  )}
                  {record.adjustments && record.adjustments.length > 0 && (
                    record.adjustments.map((adj, idx) => (
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
                    <td className="py-2.5 px-3 text-right text-sm">{formatCurrency(record.grossPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Deductions Section */}
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
                      {record.withholdFederal !== false ? `${settings.federalTaxDefaultRate}% est.` : 'Exempt'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(record.federalWithholding)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700">Virginia State Income Tax (SIT)</td>
                    <td className="py-2 px-2 text-right text-slate-500">
                      {record.withholdVirginia !== false ? `${settings.vaTaxDefaultRate}% std` : 'Exempt'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(record.vaWithholding)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700">FICA Social Security (6.2%)</td>
                    <td className="py-2 px-2 text-right text-slate-500">6.2%</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(record.socialSecurityTax)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700">FICA Medicare (1.45%)</td>
                    <td className="py-2 px-2 text-right text-slate-500">1.45%</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(record.medicareTax)}
                    </td>
                  </tr>
                  {(record.insuranceDeduction > 0 || record.otherDeductions > 0) && (
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Insurance & Voluntary</td>
                      <td className="py-2 px-2 text-right text-slate-500">Plan</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {formatCurrency((record.insuranceDeduction || 0) + (record.otherDeductions || 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-rose-800">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">Total Deductions</td>
                    <td className="py-2.5 px-3 text-right text-sm">-{formatCurrency(record.totalDeductions)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net Pay Grand Total Banner with Real-time KRW */}
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-extrabold text-emerald-900 tracking-wider block">
                {t('netPaySummary')} (Net Take-Home Disbursement)
              </span>
              <span className="text-xs text-emerald-700">
                Gross Earnings ${record.grossPay.toFixed(2)} minus Total Deductions ${record.totalDeductions.toFixed(2)}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-black text-emerald-900 font-mono block">
                {formatCurrency(record.netPay)}
              </span>
              {usdToKrwRate > 0 && (
                <span className="text-xs font-mono font-bold text-emerald-700 inline-block mt-0.5">
                  ≈ ₩{Math.round(record.netPay * usdToKrwRate).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Signature Line */}
          <div className="mt-10 pt-6 border-t border-slate-300 flex justify-between items-center text-xs text-slate-500">
            <p>{t('employeeSignature')}</p>
            <p className="font-mono text-[10px]">Document authorized by MANAGEMENT OF CULMORE Payroll System</p>
          </div>
        </div>
      )}
    </div>
  );
};
