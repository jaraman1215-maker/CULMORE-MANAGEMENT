import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Printer,
  FileSpreadsheet,
  Moon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  Sparkles,
  Info,
  Building,
  Users,
  Download,
  X,
  FileText,
  Eye,
  ExternalLink,
  HardDriveDownload,
  Upload,
  History,
  FolderOpen,
} from 'lucide-react';
import { Employee, Shift, WorkWeekDay, BUSINESS_GROUPS, getBusinessGroup, ScheduleBackupFile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  getDaysInWorkWeek,
  getPreviousWeekFriday,
  getNextWeekFriday,
  formatWorkWeekRange,
  getWorkWeekFriday,
} from '../utils/dateUtils';
import {
  calculateShiftHours,
  formatTime12h,
  calculateWeeklyHoursSummary,
  isCashierEmployee,
  calculateEligiblePaidBreak,
  getEffectiveShiftForEmployee,
} from '../utils/calculations';
import { CopyScheduleOptions } from '../firebase/dataService';
import {
  loadScheduleAutoBackups,
  deleteScheduleAutoBackup,
  downloadScheduleBackupToComputer,
  downloadJsonFile,
  parseScheduleBackupJson,
  formatTimestampForFilename,
} from '../utils/backupUtils';

interface ScheduleViewProps {
  currentWeekFriday: string;
  onChangeWeek: (fridayYmd: string) => void;
  employees: Employee[];
  shifts: Shift[];
  onSaveShift: (shift: Shift) => Promise<void>;
  onDeleteShift: (shiftId: string) => Promise<void>;
  onCopyFromPreviousWeek: (sourceFridayYmd: string, targetFridayYmd: string, options?: CopyScheduleOptions) => Promise<void>;
  onRestoreScheduleBackup?: (
    targetWeekFriday: string,
    backupShifts: Shift[],
    mode: 'merge' | 'overwrite'
  ) => Promise<number>;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  currentWeekFriday,
  onChangeWeek,
  employees,
  shifts,
  onSaveShift,
  onDeleteShift,
  onCopyFromPreviousWeek,
  onRestoreScheduleBackup,
}) => {
  const { t, language } = useLanguage();

  const days: WorkWeekDay[] = getDaysInWorkWeek(currentWeekFriday);
  const activeEmployees = employees.filter((e) => e.active);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedCulmorePart, setSelectedCulmorePart] = useState<string>('ALL');

  const activeEmpIds = new Set(activeEmployees.map((e) => e.employeeId));

  // Dynamic effective shifts matching each active registered employee's current work part (department & position)
  const effectiveShifts = shifts
    .filter((s) => activeEmpIds.has(s.employeeId))
    .map((s) => {
      const emp = employees.find((e) => e.employeeId === s.employeeId);
      return getEffectiveShiftForEmployee(s, emp);
    });

  // Filtered active employees by business group and Culmore part
  const displayedEmployees = activeEmployees.filter((emp) => {
    if (selectedGroup !== 'ALL') {
      const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
      if (grp.id !== selectedGroup) return false;
    }
    if (selectedGroup === 'group_2' && selectedCulmorePart !== 'ALL') {
      if (selectedCulmorePart === 'Kitchen & Cooking') {
        return emp.department === 'Kitchen & Cooking' || emp.department === 'Deli & Prepared Foods';
      }
      return emp.department === selectedCulmorePart;
    }
    return true;
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(null);
  const [modalDay, setModalDay] = useState<WorkWeekDay | null>(null);

  // Copy Past Schedule Modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [sourceWeekFriday, setSourceWeekFriday] = useState<string>(() => getPreviousWeekFriday(currentWeekFriday));
  const [copyMode, setCopyMode] = useState<'merge' | 'overwrite'>('merge');
  const [copyDeptFilter, setCopyDeptFilter] = useState<string>('ALL');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Print Modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTargetGroup, setPrintTargetGroup] = useState<string>('ALL');
  const [printDetailMode, setPrintDetailMode] = useState<'compact' | 'detailed'>('compact');

  // Backup & Restore Modal state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [autoBackups, setAutoBackups] = useState<ScheduleBackupFile[]>(() => loadScheduleAutoBackups());
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [uploadedBackup, setUploadedBackup] = useState<ScheduleBackupFile | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  const refreshAutoBackups = () => {
    setAutoBackups(loadScheduleAutoBackups());
  };

  const handleQuickSaveScheduleBackup = () => {
    downloadScheduleBackupToComputer(currentWeekFriday, effectiveShifts, 'manual');
    refreshAutoBackups();
    setBackupFeedback({
      type: 'success',
      text:
        language === 'ko'
          ? `이번 주(${currentWeekFriday}) 스케줄 백업 파일(.json)이 컴퓨터에 저장되었습니다.`
          : `Schedule backup (.json) saved to your computer for ${currentWeekFriday}.`,
    });
  };

  const handleUploadBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseScheduleBackupJson(text);
      setUploadedBackup(parsed);
      setBackupFeedback(null);
    } catch (err) {
      setUploadedBackup(null);
      setBackupFeedback({
        type: 'error',
        text:
          language === 'ko'
            ? '올바른 스케줄 백업 파일(.json)이 아닙니다.'
            : err instanceof Error
            ? err.message
            : 'Invalid schedule backup file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyBackup = async (backup: ScheduleBackupFile) => {
    if (!onRestoreScheduleBackup) return;
    try {
      setIsRestoringBackup(true);
      const appliedCount = await onRestoreScheduleBackup(currentWeekFriday, backup.shifts, restoreMode);
      refreshAutoBackups();
      setBackupFeedback({
        type: 'success',
        text:
          language === 'ko'
            ? `백업 스케줄 적용 완료! (${appliedCount}건의 근무가 ${currentWeekFriday} 주간에 반영되었습니다.)`
            : `Backup applied cleanly! (${appliedCount} shifts restored to ${currentWeekFriday}.)`,
      });
      setUploadedBackup(null);
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to apply backup.',
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  // Form inputs
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:30');
  const [shiftPosition, setShiftPosition] = useState('');
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);

  // Check if current modal employee is Cashier
  const isModalEmpCashier = modalEmployee
    ? isCashierEmployee(modalEmployee.department, modalEmployee.position)
    : false;

  // Live calculation inside modal respecting Cashier and Paid Break rules
  const liveShiftCalc = calculateShiftHours(startTime, endTime, breakMinutes, isModalEmpCashier);

  const openAddModal = (emp: Employee, day: WorkWeekDay) => {
    setEditingShift(null);
    setModalEmployee(emp);
    setModalDay(day);

    const cashier = isCashierEmployee(emp.department, emp.position);

    // Pick sensible default based on department
    let defaultStart = '08:00';
    let defaultEnd = '16:30';
    let defaultNotes = '';

    if (emp.department === 'Grocery & Stocking') {
      defaultStart = '22:00';
      defaultEnd = '06:00';
      defaultNotes = 'Night stocking replenishment';
    } else if (emp.department === 'Bakery') {
      defaultStart = '04:00';
      defaultEnd = '12:30';
      defaultNotes = 'Morning fresh baking';
    }

    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setShiftPosition(emp.position || '');
    setNotes(defaultNotes);

    // Calculate initial paid break to default actual break
    const initialCalc = calculateShiftHours(defaultStart, defaultEnd, undefined, cashier);
    setBreakMinutes(initialCalc.paidBreakMinutes);

    setIsModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    const emp = employees.find((e) => e.employeeId === shift.employeeId) || null;
    const day = days.find((d) => d.date === shift.date) || null;
    setModalEmployee(emp);
    setModalDay(day);

    const cashier = emp ? isCashierEmployee(emp.department, emp.position) : false;

    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setShiftPosition(shift.position || emp?.position || '');

    // If shift has recorded actual break, use it; otherwise use paid break
    const calc = calculateShiftHours(shift.startTime, shift.endTime, undefined, cashier);
    const existingBreak = shift.actualBreakMinutes ?? shift.breakMinutes ?? calc.paidBreakMinutes;
    setBreakMinutes(existingBreak);
    setNotes(shift.notes || '');

    setIsModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmployee || !modalDay) return;

    const cashier = isCashierEmployee(modalEmployee.department, modalEmployee.position);
    const calc = calculateShiftHours(startTime, endTime, breakMinutes, cashier);
    const shiftDocId = editingShift
      ? editingShift.id
      : `shift_${currentWeekFriday}_${modalEmployee.employeeId}_${modalDay.date}`;

    const shiftPayload: Shift = {
      id: shiftDocId,
      scheduleId: currentWeekFriday,
      employeeId: modalEmployee.employeeId,
      employeeName: modalEmployee.fullName,
      position: shiftPosition.trim() || modalEmployee.position || '',
      date: modalDay.date,
      dayOfWeek: modalDay.dayOfWeek,
      startTime,
      endTime,
      breakMinutes: calc.actualBreakMinutes,
      hours: calc.hours,
      rawHours: calc.rawHours,
      paidBreakMinutes: calc.paidBreakMinutes,
      actualBreakMinutes: calc.actualBreakMinutes,
      excessBreakMinutes: calc.excessBreakMinutes,
      isOvernight: calc.isOvernight,
      businessGroup: modalEmployee.businessGroup,
      notes: notes.trim(),
    };

    await onSaveShift(shiftPayload);
    setIsModalOpen(false);
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;
    await onDeleteShift(editingShift.id);
    setIsModalOpen(false);
  };

  const handleExecuteCopySchedule = async () => {
    try {
      setIsCopying(true);
      setCopyFeedback(null);
      await onCopyFromPreviousWeek(sourceWeekFriday, currentWeekFriday, {
        mode: copyMode,
        department: copyDeptFilter,
      });
      setCopyFeedback(t('copySuccessMsg'));
      setTimeout(() => {
        setIsCopyModalOpen(false);
        setCopyFeedback(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setCopyFeedback(err instanceof Error ? err.message : 'Error copying schedule');
    } finally {
      setIsCopying(false);
    }
  };

  // Copy shift to next day in same week
  const handleCopyShiftToNextDay = async () => {
    if (!modalEmployee || !modalDay) return;
    const currentIdx = days.findIndex((d) => d.date === modalDay.date);
    if (currentIdx < 0 || currentIdx >= 6) {
      alert(language === 'ko' ? '주간 마지막 날(목요일) 다음으로는 복사할 수 없습니다.' : 'Cannot copy past Thursday.');
      return;
    }

    const nextDay = days[currentIdx + 1];
    const cashier = isCashierEmployee(modalEmployee.department, modalEmployee.position);
    const calc = calculateShiftHours(startTime, endTime, breakMinutes, cashier);
    const newShiftId = `shift_${currentWeekFriday}_${modalEmployee.employeeId}_${nextDay.date}`;

    const payload: Shift = {
      id: newShiftId,
      scheduleId: currentWeekFriday,
      employeeId: modalEmployee.employeeId,
      employeeName: modalEmployee.fullName,
      date: nextDay.date,
      dayOfWeek: nextDay.dayOfWeek,
      startTime,
      endTime,
      breakMinutes: calc.actualBreakMinutes,
      hours: calc.hours,
      rawHours: calc.rawHours,
      paidBreakMinutes: calc.paidBreakMinutes,
      actualBreakMinutes: calc.actualBreakMinutes,
      excessBreakMinutes: calc.excessBreakMinutes,
      isOvernight: calc.isOvernight,
      businessGroup: modalEmployee.businessGroup,
      notes: notes.trim(),
    };

    await onSaveShift(payload);
    setIsModalOpen(false);
  };

  // CSV Export for schedule
  const handleExportCsv = () => {
    const exportEmps = displayedEmployees;
    const currentGrpObj = selectedGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === selectedGroup) : null;
    const currentGrpName = currentGrpObj ? currentGrpObj.shortName.replace(/\s+/g, '_') : 'All_Branches';

    const headers = [
      'Business Group',
      'Employee ID',
      'Name',
      'Department',
      'Friday (' + days[0].date + ')',
      'Saturday (' + days[1].date + ')',
      'Sunday (' + days[2].date + ')',
      'Monday (' + days[3].date + ')',
      'Tuesday (' + days[4].date + ')',
      'Wednesday (' + days[5].date + ')',
      'Thursday (' + days[6].date + ')',
      'Weekly Total Hours',
      'Overtime Hours (>40h)',
    ];

    const rows = exportEmps.map((emp) => {
      const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
      const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
      const summary = calculateWeeklyHoursSummary(empShifts);

      const dayCells = days.map((d) => {
        const s = empShifts.find((sh) => sh.date === d.date);
        if (!s) return 'OFF';
        return `"${s.startTime}-${s.endTime} (${s.hours}h${s.isOvernight ? ' Overnight' : ''})"`;
      });

      return [
        `"${grp.name}"`,
        emp.employeeId,
        `"${emp.nickname?.trim() || emp.fullName}"`,
        `"${emp.department}"`,
        ...dayCells,
        summary.totalHours.toFixed(2),
        summary.overtimeHours.toFixed(2),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Culmore_Schedule_${currentGrpName}_${currentWeekFriday}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Standalone Printable Schedule HTML Generator
  const generateSchedulePrintHtml = (
    targetGroup: string,
    mode: 'compact' | 'detailed'
  ): string => {
    const printEmps = activeEmployees.filter((emp) => {
      if (targetGroup === 'ALL') return true;
      const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
      return grp.id === targetGroup;
    });

    const selectedGrpObj = targetGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === targetGroup) : null;
    const branchName = selectedGrpObj
      ? selectedGrpObj.name
      : (language === 'ko' ? '전체 5개 사업장 (All Branches)' : 'All 5 Branches');

    const formattedPeriod = formatWorkWeekRange(currentWeekFriday, language);
    const nowStr = new Date().toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US');

    // Groups to render
    const groupsToRender = targetGroup === 'ALL'
      ? BUSINESS_GROUPS
      : BUSINESS_GROUPS.filter((g) => g.id === targetGroup);

    let grandTotalHours = 0;
    let grandTotalOt = 0;
    let grandHeadcount = 0;

    let tablesHtml = '';

    for (const grp of groupsToRender) {
      const grpEmps = printEmps.filter(
        (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
      );
      if (grpEmps.length === 0 && targetGroup === 'ALL') {
        continue;
      }

      grandHeadcount += grpEmps.length;
      let grpHours = 0;
      let grpOt = 0;

      let rowsHtml = '';
      if (grpEmps.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="10" style="padding: 14px; text-align: center; color: #64748b; font-style: italic;">
              ${language === 'ko' ? '선택한 사업장에 등록된 재직 직원이 없습니다.' : 'No active employees in this group.'}
            </td>
          </tr>
        `;
      } else {
        grpEmps.forEach((emp, index) => {
          const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
          const summary = calculateWeeklyHoursSummary(empShifts);
          grpHours += summary.totalHours;
          grpOt += summary.overtimeHours;

          const dayCells = days
            .map((d) => {
              const shift = empShifts.find((s) => s.date === d.date);
              if (!shift) {
                return `<td style="color: #94a3b8; font-size: 13px; font-weight: 600; text-align: center; background: #fafafa;">OFF</td>`;
              }

              const hoursNum = shift.hours.toFixed(1);
              const overnightIcon = shift.isOvernight ? ' 🌙' : '';
              const breakDetail =
                mode === 'detailed' && shift.actualBreakMinutes
                  ? `<div style="font-size: 11px; color: #64748b;">${language === 'ko' ? `휴게 ${shift.actualBreakMinutes}분` : `Break ${shift.actualBreakMinutes}m`}</div>`
                  : '';

              return `
                <td style="text-align: center; padding: 5px 3px; line-height: 1.25;">
                  <div style="font-weight: 700; font-size: 14px; color: #0f172a;">${shift.startTime}</div>
                  <div style="font-weight: 700; font-size: 14px; color: #0f172a;">${shift.endTime}</div>
                  <div style="font-size: 12px; color: #047857; font-weight: 700;">${hoursNum}h (${language === 'ko' ? `휴게 ${shift.paidBreakMinutes || 0}분` : `Break ${shift.paidBreakMinutes || 0}m`})${overnightIcon}</div>
                  ${shift.position ? `<div style="font-size: 12px; color: #4f46e5; font-weight: 700;">${shift.position}</div>` : ''}
                  ${breakDetail}
                </td>
              `;
            })
            .join('');

          const isOt = summary.totalHours > 40;
          const totalStyle = isOt
            ? 'color: #b91c1c; font-weight: 800; background: #fef2f2;'
            : 'color: #047857; font-weight: 700;';
          const empDisplayName = emp.nickname?.trim() || emp.fullName;

          rowsHtml += `
            <tr style="border-bottom: 1px solid #cbd5e1; ${index % 2 === 1 ? 'background: #f8fafc;' : ''}">
              <td style="text-align: center; font-size: 12px; color: #64748b; width: 32px;">${index + 1}</td>
              <td style="text-align: left; padding: 5px 8px; width: 160px;">
                <div style="font-weight: 700; font-size: 15px; color: #0f172a;">${empDisplayName}</div>
                <div style="font-size: 12px; color: #64748b;">${emp.department} • ${emp.position}</div>
              </td>
              ${dayCells}
              <td style="text-align: right; padding: 5px 8px; width: 90px; font-size: 13px; ${totalStyle}">
                <div>${summary.totalHours.toFixed(1)}h</div>
                ${isOt ? `<div style="font-size: 11px; color: #dc2626;">OT +${summary.overtimeHours.toFixed(1)}h</div>` : ''}
              </td>
            </tr>
          `;
        });
      }

      grandTotalHours += grpHours;
      grandTotalOt += grpOt;

      tablesHtml += `
        <div style="margin-bottom: 14px; page-break-inside: avoid;">
          <div style="background: #0f172a; color: #ffffff; padding: 7px 10px; font-weight: 700; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span>${grp.name}</span>
            <span style="font-size: 12px; font-weight: normal; opacity: 0.9;">
              ${language === 'ko' ? '인원' : 'Staff'}: ${grpEmps.length}명 • ${language === 'ko' ? '소계' : 'Subtotal'}: ${grpHours.toFixed(1)}h ${grpOt > 0 ? `(OT: ${grpOt.toFixed(1)}h)` : ''}
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #0f172a; margin-top: -1px;">
            <thead>
              <tr style="background: #f1f5f9; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px 2px; width: 32px; text-align: center; border-right: 1px solid #cbd5e1;">No</th>
                <th style="padding: 6px 8px; width: 160px; text-align: left; border-right: 1px solid #cbd5e1;">${language === 'ko' ? '직원 / 부서' : 'Employee / Dept'}</th>
                ${days
                  .map(
                    (d, i) => `
                  <th style="padding: 5px 2px; text-align: center; border-right: 1px solid #cbd5e1; ${i === 1 || i === 2 ? 'background: #fef3c7; color: #92400e;' : ''}">
                    <div>${language === 'ko' ? d.dayOfWeekKo : d.dayOfWeek}</div>
                    <div style="font-size: 11.5px; opacity: 0.85;">${language === 'ko' ? d.displayDateKo : d.displayDate}</div>
                  </th>
                `
                  )
                  .join('')}
                <th style="padding: 6px 8px; width: 90px; text-align: right;">${language === 'ko' ? '주간 합계' : 'Weekly Total'}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <title>MANAGEMENT OF CULMORE - Weekly Schedule (${currentWeekFriday})</title>
  <style>
    @page {
      size: portrait;
      margin: 6mm 5mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .store-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.3px;
      margin: 0;
      text-transform: uppercase;
      color: #0f172a;
    }
    .store-address {
      font-size: 10px;
      color: #475569;
      margin: 2px 0 4px 0;
    }
    .period-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #047857;
      margin: 0;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.4;
    }
    .grand-summary {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 12px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
    }
    .signature-box {
      margin-top: 14px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #334155;
      page-break-inside: avoid;
    }
    .sig-line {
      display: inline-block;
      width: 130px;
      border-bottom: 1px solid #334155;
      margin-left: 6px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <h1 class="store-title">MANAGEMENT OF CULMORE</h1>
      <p class="store-address">4210 John Marr Dr, Annandale, VA 22003 • (703) 555-0199</p>
      <p class="period-title">
        ${language === 'ko' ? '주간 공식 근무 스케줄표' : 'Official Weekly Work Schedule'}: ${formattedPeriod}
      </p>
      <div style="font-size: 10px; color: #334155; margin-top: 2px;">
        <strong>${language === 'ko' ? '출력 대상' : 'Scope'}:</strong> ${branchName}
      </div>
    </div>
    <div class="meta-box">
      <div><strong>${language === 'ko' ? '인쇄 일시' : 'Printed'}:</strong> ${nowStr}</div>
      <div><strong>FLSA Standard:</strong> Virginia (Fri - Thu / 40h OT)</div>
      <div style="color: #047857; font-weight: bold;">MANAGEMENT OF CULMORE OFFICIAL</div>
    </div>
  </div>

  <div class="grand-summary">
    <div>${language === 'ko' ? '편성 인원' : 'Scheduled Staff'}: <strong>${grandHeadcount}명</strong></div>
    <div>${language === 'ko' ? '주간 총 근무 편성 시간' : 'Total Weekly Hours'}: <strong>${grandTotalHours.toFixed(1)}시간</strong></div>
    <div>${language === 'ko' ? '초과근무(OT >40h)' : 'Overtime (>40h)'}: <strong>${grandTotalOt.toFixed(1)}시간</strong></div>
  </div>

  ${tablesHtml}

  <div class="signature-box">
    <div>${language === 'ko' ? '작성자 (Scheduler)' : 'Prepared By'}: <span class="sig-line"></span></div>
    <div>${language === 'ko' ? '매니저 승인 (Store Manager)' : 'Approved By'}: <span class="sig-line"></span></div>
    <div>${language === 'ko' ? '승인 일자 (Date)' : 'Approval Date'}: <span class="sig-line"></span></div>
  </div>
</body>
</html>`;
  };

  // Standalone print URL for new tab
  const getPrintStandaloneUrl = (targetGroup: string, mode: 'compact' | 'detailed') => {
    return `${window.location.origin}${window.location.pathname}?print=schedule&week=${currentWeekFriday}&group=${targetGroup}&mode=${mode}`;
  };

  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Direct print execution
  const handleDirectPrintSchedule = (targetGroup: string, mode: 'compact' | 'detailed') => {
    const printUrl = getPrintStandaloneUrl(targetGroup, mode);

    // 1. Try opening the standalone print page in a new window/tab via anchor click
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
          ? '새 탭에서 인쇄 페이지가 열렸습니다. 팝업 차단이 되어 있는 경우 [새 창에서 열어 바로 인쇄하기] 버튼을 직접 눌러주세요.'
          : 'Opening print page in a new tab. If popups are blocked, click the direct button.'
      );
    } catch (openErr) {
      console.warn('Failed to open new tab, attempting fallback:', openErr);
    }

    // 2. Also try window.print() if outside iframe
    if (window.self === window.top) {
      try {
        window.print();
      } catch (err) {
        console.warn('window.print() error:', err);
      }
    }
  };

  // Download standalone printable HTML file (guaranteed 100% offline and cross-browser printable)
  const handleDownloadPrintableHtml = (targetGroup: string, mode: 'compact' | 'detailed') => {
    const html = generateSchedulePrintHtml(targetGroup, mode);
    const grpObj = targetGroup !== 'ALL' ? BUSINESS_GROUPS.find((g) => g.id === targetGroup) : null;
    const grpName = grpObj ? grpObj.shortName.replace(/\s+/g, '_') : 'All_Branches';
    const filename = `Culmore_Schedule_Print_${grpName}_${currentWeekFriday}.html`;

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

  // Open the Print Preview Modal
  const handleOpenPrintModal = () => {
    setPrintTargetGroup(selectedGroup);
    setPrintFeedback(null);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t('scheduleTitle')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              {language === 'ko' ? '금요일 ~ 목요일' : 'Friday — Thursday'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ko'
              ? '주 7일 근무 스케줄 편성, 사업장 그룹별 개별 조회, 자정 통과 야간조 자동 계산'
              : '7-day weekly grid, branch group tabs, overnight shifts crossing midnight, and 40-hour overtime highlighting.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selector */}
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
            onClick={() => onChangeWeek(getWorkWeekFriday())}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            {t('currentWeek')}
          </button>

          <button
            onClick={() => {
              setSourceWeekFriday(getPreviousWeekFriday(currentWeekFriday));
              setCopyFeedback(null);
              setIsCopyModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('copyPastSchedule')}</span>
          </button>

          <button
            onClick={handleOpenPrintModal}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('printSchedule')}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t('exportCsv')}</span>
          </button>

          <button
            type="button"
            onClick={handleQuickSaveScheduleBackup}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={language === 'ko' ? '현재 주간 스케줄 백업 파일을 컴퓨터에 저장합니다' : 'Save current schedule backup (.json) to computer'}
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400" />
            <span>{language === 'ko' ? '컴퓨터 백업 저장' : 'Save Backup'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              refreshAutoBackups();
              setBackupFeedback(null);
              setIsBackupModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            title={language === 'ko' ? '자동 백업 내역 및 컴퓨터 파일 불러오기' : 'View auto-backups or load backup file'}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'ko' ? '자동백업 · 불러오기' : 'Backups & Load'}</span>
          </button>
        </div>
      </div>

      {/* Business Group Tabs Bar for Weekly Schedule */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden no-print">
        {/* Tab Header Strip */}
        <div className="flex items-center space-x-1 p-2 bg-slate-100/70 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {/* ALL Branches Tab */}
          <button
            onClick={() => setSelectedGroup('ALL')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center space-x-2 shrink-0 cursor-pointer ${
              selectedGroup === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'ko' ? '전체 사업장 스케줄' : 'All Branches Schedule'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                selectedGroup === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {activeEmployees.length}{language === 'ko' ? '명' : ' staff'}
            </span>
          </button>

          {/* Individual Group Tabs */}
          {BUSINESS_GROUPS.map((grp) => {
            const isSelected = selectedGroup === grp.id;
            const grpEmps = activeEmployees.filter(
              (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
            );
            const grpShifts = effectiveShifts.filter((s) => grpEmps.some((e) => e.employeeId === s.employeeId));
            const totalHours = grpShifts.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);

            return (
              <button
                key={grp.id}
                onClick={() => setSelectedGroup(grp.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap flex items-center space-x-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? `${grp.badgeBg} ${grp.borderClass} border shadow-xs ring-2 ring-emerald-500/20`
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80'
                }`}
              >
                <span>{grp.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                    isSelected ? 'bg-white shadow-2xs font-extrabold text-slate-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {grpEmps.length}{language === 'ko' ? '명' : ''} • {totalHours.toFixed(0)}h
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Branch Overview Banner */}
        {selectedGroup !== 'ALL' ? (() => {
          const currentGrp = BUSINESS_GROUPS.find((g) => g.id === selectedGroup)!;
          const grpEmps = activeEmployees.filter(
            (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === currentGrp.id
          );
          const grpShifts = effectiveShifts.filter((s) => grpEmps.some((e) => e.employeeId === s.employeeId));
          const totalHours = grpShifts.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
          const otHours = grpEmps.reduce((sum, emp) => {
            const eShifts = grpShifts.filter((s) => s.employeeId === emp.employeeId);
            const summ = calculateWeeklyHoursSummary(eShifts);
            return sum + summ.overtimeHours;
          }, 0);
          const overnightCount = grpShifts.filter((s) => s.isOvernight).length;

          return (
            <>
              <div className={`p-4 ${currentGrp.badgeBg} border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-800">
                  <Building className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-slate-900">{currentGrp.name}</h3>
                    <span className="text-[11px] font-bold text-slate-600">({currentGrp.nameKo})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {currentGrp.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs font-medium text-slate-700 shrink-0 flex-wrap gap-y-2">
                <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    {language === 'ko' ? '편성 인원' : 'Staff Count'}
                  </span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {grpEmps.length} {language === 'ko' ? '명' : 'staff'}
                  </span>
                </div>

                <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">
                    {language === 'ko' ? '주간 총 근무시간' : 'Weekly Total Hours'}
                  </span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    {totalHours.toFixed(1)} hrs
                  </span>
                </div>

                {otHours > 0 && (
                  <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-900">
                    <span className="text-[10px] text-amber-600 uppercase block font-bold">
                      {language === 'ko' ? '오버타임 (>40h)' : 'Overtime'}
                    </span>
                    <span className="font-mono font-black text-amber-800 text-sm">
                      +{otHours.toFixed(1)} hrs
                    </span>
                  </div>
                )}

                {overnightCount > 0 && (
                  <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 text-indigo-900">
                    <span className="text-[10px] text-indigo-600 uppercase block font-bold">
                      🌙 {language === 'ko' ? '야간조 (자정넘김)' : 'Overnight'}
                    </span>
                    <span className="font-mono font-black text-indigo-800 text-sm">
                      {overnightCount} {language === 'ko' ? '건' : 'shifts'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Culmore Supermarket Department Parts (Item 3) */}
            {selectedGroup === 'group_2' && (
              <div className="p-2.5 bg-blue-50/70 border-t border-blue-200/80 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-black text-blue-900 uppercase tracking-wider px-2 shrink-0">
                  {language === 'ko' ? '마트 파트:' : 'Parts:'}
                </span>
                {[
                  { id: 'ALL', name: language === 'ko' ? '전체 파트' : 'All Parts', icon: '🛒' },
                  { id: 'Meat & Seafood', name: language === 'ko' ? '정육/수산 (Meat)' : 'Meat & Seafood', icon: '🥩' },
                  { id: 'Cashiers & Front End', name: language === 'ko' ? '캐셔 (Cashier)' : 'Cashiers & Front End', icon: '💳' },
                  { id: 'Kitchen & Cooking', name: language === 'ko' ? '키친/조리 (Kitchen)' : 'Kitchen & Cooking', icon: '🍳' },
                  { id: 'Grocery & Stocking', name: language === 'ko' ? '그로서리 (Grocery)' : 'Grocery & Stocking', icon: '📦' },
                  { id: 'Produce', name: language === 'ko' ? '농산 (Produce)' : 'Produce & Fresh', icon: '🥬' },
                  { id: 'Bakery', name: language === 'ko' ? '베이커리 (Bakery)' : 'Bakery', icon: '🥖' },
                ].map((part) => {
                  const isSelected = selectedCulmorePart === part.id;
                  const count = part.id === 'ALL'
                    ? activeEmployees.filter(e => getBusinessGroup(e.businessGroup || e.groupNumber).id === 'group_2').length
                    : activeEmployees.filter(e => getBusinessGroup(e.businessGroup || e.groupNumber).id === 'group_2' && (e.department === part.id || (part.id === 'Kitchen & Cooking' && e.department === 'Deli & Prepared Foods'))).length;

                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => setSelectedCulmorePart(part.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-blue-700 text-white shadow-xs ring-1 ring-blue-700'
                          : 'bg-white hover:bg-blue-100/70 text-slate-700 border border-blue-200/80'
                      }`}
                    >
                      <span>{part.icon}</span>
                      <span>{part.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
          );
        })() : (
          /* When ALL is selected, show 5-branch summary stat cards */
          <div className="p-3 bg-slate-50/70 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {BUSINESS_GROUPS.map((grp) => {
              const grpEmps = activeEmployees.filter(
                (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
              );
              const grpShifts = effectiveShifts.filter((s) => grpEmps.some((e) => e.employeeId === s.employeeId));
              const totalHours = grpShifts.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
              return (
                <button
                  key={grp.id}
                  onClick={() => setSelectedGroup(grp.id)}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 text-left transition-all cursor-pointer group/stat shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                    <span>{grp.name}</span>
                    <span className="font-mono text-slate-700">{grpEmps.length}{language === 'ko' ? '명' : ' staff'}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-mono font-black text-xs text-slate-900 group-hover/stat:text-emerald-700">
                      {totalHours.toFixed(1)} hrs
                    </span>
                    <span className="text-[9px] text-slate-400 group-hover/stat:text-emerald-600">
                      {language === 'ko' ? '보기 →' : 'View →'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Print-only Header (Visible during printing) */}
      <div className="print-only mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase">
              MANAGEMENT OF CULMORE
            </h1>
            <p className="text-xs text-slate-600">4210 John Marr Dr, Annandale, VA 22003 • (703) 555-0199</p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              Official Weekly Work Schedule: {formatWorkWeekRange(currentWeekFriday, language)}
              {selectedGroup !== 'ALL' && ` — ${BUSINESS_GROUPS.find(g => g.id === selectedGroup)?.name}`}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            Generated: {new Date().toLocaleDateString('en-US')}
          </div>
        </div>
      </div>

      {/* Main 7-Day Weekly Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:overflow-visible print:border-none print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                {/* Employee Info Header */}
                <th className="py-4 px-4 text-left w-72 sticky left-0 z-20 bg-slate-900 border-r border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-base">{t('employeeDirectory')}</span>
                    <span className="text-xs text-slate-400">({displayedEmployees.length})</span>
                  </div>
                </th>

                {/* 7 Days: Friday through Thursday */}
                {days.map((day, idx) => {
                  const isWeekend = idx === 1 || idx === 2; // Sat, Sun peak retail grocery rush
                  return (
                    <th
                      key={day.date}
                      className={`py-3.5 px-2 text-center border-r border-slate-800 min-w-44 ${
                        isWeekend ? 'bg-slate-800/80 text-amber-300' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-lg uppercase tracking-wider font-extrabold">
                          {language === 'ko' ? day.dayOfWeekKo : day.dayOfWeek}
                        </span>
                        <span className="text-sm font-mono opacity-80 mt-0.5">
                          {language === 'ko' ? day.displayDateKo : day.displayDate}
                        </span>
                        {isWeekend && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-normal mt-0.5">
                            Peak Grocery
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {displayedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Building className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">
                      {language === 'ko'
                        ? '선택한 사업장 그룹에 등록된 재직 직원이 없습니다.'
                        : 'No active employees in this business group.'}
                    </p>
                  </td>
                </tr>
              ) : selectedGroup === 'ALL' ? (
                // Group-divided schedule for ALL branches
                BUSINESS_GROUPS.map((grp) => {
                  const grpEmps = displayedEmployees.filter(
                    (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
                  );
                  if (grpEmps.length === 0) return null;

                  const grpShifts = effectiveShifts.filter((s) => grpEmps.some((e) => e.employeeId === s.employeeId));
                  const grpTotalHours = grpShifts.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
                  const grpOtHours = grpEmps.reduce((sum, emp) => {
                    const eShifts = grpShifts.filter((s) => s.employeeId === emp.employeeId);
                    const summ = calculateWeeklyHoursSummary(eShifts);
                    return sum + summ.overtimeHours;
                  }, 0);

                  return (
                    <React.Fragment key={grp.id}>
                      {/* Business Group Divider & Header */}
                      <tr className="bg-slate-100/95 border-y-2 border-slate-300">
                        <td colSpan={9} className="py-2.5 px-4 sticky left-0 z-10 bg-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${grp.badgeBg} border ${grp.borderClass}`}
                              >
                                {grp.name}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px]">
                              <span className="font-semibold text-slate-600 font-mono">
                                {grpEmps.length} {language === 'ko' ? '명 편성' : 'staff'}
                              </span>
                              <span className="font-mono font-bold text-emerald-800">
                                {language === 'ko' ? '주간 총' : 'Total'}: {grpTotalHours.toFixed(1)} hrs
                              </span>
                              {grpOtHours > 0 && (
                                <span className="text-amber-700 font-bold font-mono">
                                  (+{grpOtHours.toFixed(1)}h OT)
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedGroup(grp.id)}
                                className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 font-bold text-[10px] border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                              >
                                {language === 'ko' ? '이 그룹만 보기' : 'Focus'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Group Staff Rows */}
                      {grpEmps.map((emp) => {
                        const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                        const summary = calculateWeeklyHoursSummary(empShifts);
                        const displayName = emp.nickname?.trim() || emp.fullName;

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors group">
                            {/* Employee Profile Cell */}
                            <td className="py-3 px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-slate-900 text-base truncate max-w-48">
                                    {displayName}
                                  </span>
                                  <span className="font-mono text-xs text-slate-400">
                                    {emp.employeeId}
                                  </span>
                                </div>
                                {emp.fullNameKo && (
                                  <p className="text-sm text-slate-500 font-medium">{emp.fullNameKo}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded font-bold border ${grp.badgeBg} truncate max-w-36`}
                                    title={grp.name}
                                  >
                                    {grp.name}
                                  </span>
                                  {/* Total Hours next to group name */}
                                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {language === 'ko' ? '총 ' : 'Total '}{summary.totalHours.toFixed(1)}h{summary.overtimeHours > 0 ? ` (+${summary.overtimeHours.toFixed(1)} OT)` : ''}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold truncate max-w-36">
                                    {emp.department}
                                  </span>
                                  {/* Hourly wage hidden on print */}
                                  <span className="font-mono text-xs text-emerald-700 font-bold ml-auto print:hidden">
                                    ${emp.hourlyWage}/h
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 7 Daily Cells */}
                            {days.map((day) => {
                              const shift = empShifts.find((s) => s.date === day.date);

                              return (
                                <td
                                  key={day.date}
                                  className="py-2 px-2 border-r border-slate-100 text-center align-top min-w-44"
                                >
                                  {shift ? (
                                    <div
                                      onClick={() => openEditModal(shift)}
                                      className={`p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                                        shift.isOvernight
                                          ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800 shadow-xs'
                                          : 'bg-emerald-50 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
                                      }`}
                                    >
                                      {/* Line 1: 시작시간 */}
                                      <div className="flex items-center justify-between text-base font-bold">
                                        <div className="flex items-center space-x-1">
                                          <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {language === 'ko' ? '시작: ' : 'Start: '}
                                          </span>
                                          <span className="font-mono text-base">{shift.startTime}</span>
                                        </div>
                                        {shift.isOvernight && (
                                          <span title={language === 'ko' ? '자정 넘김 야간조' : 'Overnight shift'}>
                                            <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                                          </span>
                                        )}
                                      </div>

                                      {/* Line 2: 끝나는 시간 */}
                                      <div className="flex items-center space-x-1 text-base font-bold mt-0.5">
                                        <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                          {language === 'ko' ? '종료: ' : 'End: '}
                                        </span>
                                        <span className="font-mono text-base">{shift.endTime}</span>
                                      </div>

                                      {/* Line 3: 총 근무시간과 휴게시간 */}
                                      <div className="flex items-center justify-between mt-1.5 text-sm font-medium">
                                        <span className={`font-mono font-bold ${shift.isOvernight ? 'text-emerald-400' : 'text-emerald-800'}`}>
                                          {shift.hours.toFixed(1)} hrs
                                        </span>
                                        {shift.excessBreakMinutes && shift.excessBreakMinutes > 0 ? (
                                          <span
                                            className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-xs"
                                            title={`${shift.actualBreakMinutes ?? shift.breakMinutes}m taken, ${shift.excessBreakMinutes}m excess unpaid`}
                                          >
                                            -{shift.excessBreakMinutes}m {language === 'ko' ? '공제' : 'unpaid'}
                                          </span>
                                        ) : shift.paidBreakMinutes && shift.paidBreakMinutes > 0 ? (
                                          <span
                                            className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded"
                                            title={`${shift.paidBreakMinutes}m break`}
                                          >
                                            {language === 'ko' ? '휴게 ' : 'Break '}{shift.paidBreakMinutes}m
                                          </span>
                                        ) : shift.breakMinutes > 0 ? (
                                          <span className="text-xs text-slate-500">
                                            {shift.breakMinutes}m
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* Line 4: Position */}
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60">
                                        <span
                                          className={`px-2 py-0.5 rounded font-bold text-sm truncate max-w-full block ${
                                            shift.isOvernight ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'
                                          }`}
                                          title={shift.position || emp.position}
                                        >
                                          {shift.position || emp.position || (language === 'ko' ? '파트' : 'Role')}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openAddModal(emp, day)}
                                      className="w-full h-24 rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-700 transition-all opacity-40 hover:opacity-100 group/cell no-print cursor-pointer"
                                    >
                                      <Plus className="w-4 h-4 group-hover/cell:scale-110 transition-transform" />
                                      <span className="text-sm mt-0.5">{t('noShift')}</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : selectedGroup === 'group_2' && selectedCulmorePart === 'ALL' ? (
                // Culmore Supermarket grouped by department parts (Item 3)
                [
                  { id: 'Meat & Seafood', name: '정육 / 수산 (Meat & Seafood)', nameEn: 'Meat & Seafood', icon: '🥩' },
                  { id: 'Cashiers & Front End', name: '캐셔 / 계산원 (Cashiers & Front End)', nameEn: 'Cashiers & Front End', icon: '💳' },
                  { id: 'Kitchen & Cooking', name: '키친 / 델리 / 조리 (Kitchen & Deli)', nameEn: 'Kitchen & Cooking', icon: '🍳' },
                  { id: 'Grocery & Stocking', name: '그로서리 / 진열 (Grocery & Stocking)', nameEn: 'Grocery & Stocking', icon: '📦' },
                  { id: 'Produce', name: '농산 / 야채과일 (Produce & Fresh)', nameEn: 'Produce & Fresh', icon: '🥬' },
                  { id: 'Bakery', name: '베이커리 (Bakery)', nameEn: 'Bakery', icon: '🥖' },
                  { id: 'Management', name: '매니지먼트 / 관리 (Management)', nameEn: 'Management', icon: '💼' },
                ].map((part) => {
                  const partEmps = displayedEmployees.filter((e) => {
                    if (part.id === 'Kitchen & Cooking') {
                      return e.department === 'Kitchen & Cooking' || e.department === 'Deli & Prepared Foods';
                    }
                    if (part.id === 'Management') {
                      return e.department === 'Management' || (e.department !== 'Meat & Seafood' && e.department !== 'Cashiers & Front End' && e.department !== 'Kitchen & Cooking' && e.department !== 'Deli & Prepared Foods' && e.department !== 'Grocery & Stocking' && e.department !== 'Produce' && e.department !== 'Bakery');
                    }
                    return e.department === part.id;
                  });

                  if (partEmps.length === 0) return null;

                  return (
                    <React.Fragment key={part.id}>
                      {/* Part Section Header */}
                      <tr className="bg-blue-50/90 border-y border-blue-200">
                        <td colSpan={8} className="py-2.5 px-4 sticky left-0 z-10 bg-blue-50/90">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{part.icon}</span>
                            <span className="text-blue-950 font-black text-base">
                              {language === 'ko' ? part.name : part.nameEn}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-blue-200 text-blue-800 text-xs font-mono font-bold">
                              {partEmps.length}{language === 'ko' ? '명' : ' staff'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {partEmps.map((emp) => {
                        const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
                        const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                        const summary = calculateWeeklyHoursSummary(empShifts);
                        const displayName = emp.nickname?.trim() || emp.fullName;

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors group">
                            {/* Employee Profile Cell */}
                            <td className="py-3 px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-slate-900 text-base truncate max-w-48">
                                    {displayName}
                                  </span>
                                  <span className="font-mono text-xs text-slate-400">
                                    {emp.employeeId}
                                  </span>
                                </div>
                                {emp.fullNameKo && (
                                  <p className="text-sm text-slate-500 font-medium">{emp.fullNameKo}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded font-bold border ${grp.badgeBg} truncate max-w-36`}
                                    title={grp.name}
                                  >
                                    {grp.name}
                                  </span>
                                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {language === 'ko' ? '총 ' : 'Total '}{summary.totalHours.toFixed(1)}h{summary.overtimeHours > 0 ? ` (+${summary.overtimeHours.toFixed(1)} OT)` : ''}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold truncate max-w-36">
                                    {emp.department}
                                  </span>
                                  <span className="font-mono text-xs text-emerald-700 font-bold ml-auto print:hidden">
                                    ${emp.hourlyWage}/h
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 7 Daily Cells */}
                            {days.map((day) => {
                              const shift = empShifts.find((s) => s.date === day.date);

                              return (
                                <td
                                  key={day.date}
                                  className="py-2 px-2 border-r border-slate-100 text-center align-top min-w-44"
                                >
                                  {shift ? (
                                    <div
                                      onClick={() => openEditModal(shift)}
                                      className={`p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                                        shift.isOvernight
                                          ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800 shadow-xs'
                                          : 'bg-emerald-50 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
                                      }`}
                                    >
                                      {/* Line 1: 시작시간 */}
                                      <div className="flex items-center justify-between text-base font-bold">
                                        <div className="flex items-center space-x-1">
                                          <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {language === 'ko' ? '시작: ' : 'Start: '}
                                          </span>
                                          <span className="font-mono text-base">{shift.startTime}</span>
                                        </div>
                                        {shift.isOvernight && (
                                          <span title={language === 'ko' ? '자정 넘김 야간조' : 'Overnight shift'}>
                                            <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                                          </span>
                                        )}
                                      </div>

                                      {/* Line 2: 끝나는 시간 */}
                                      <div className="flex items-center space-x-1 text-base font-bold mt-0.5">
                                        <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                          {language === 'ko' ? '종료: ' : 'End: '}
                                        </span>
                                        <span className="font-mono text-base">{shift.endTime}</span>
                                      </div>

                                      {/* Line 3: 총 근무시간과 휴게시간 */}
                                      <div className="flex items-center justify-between mt-1.5 text-sm font-medium">
                                        <span className={`font-mono font-bold ${shift.isOvernight ? 'text-emerald-400' : 'text-emerald-800'}`}>
                                          {shift.hours.toFixed(1)} hrs
                                        </span>
                                        {shift.excessBreakMinutes && shift.excessBreakMinutes > 0 ? (
                                          <span
                                            className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-xs"
                                            title={`${shift.actualBreakMinutes ?? shift.breakMinutes}m taken, ${shift.excessBreakMinutes}m excess unpaid`}
                                          >
                                            -{shift.excessBreakMinutes}m {language === 'ko' ? '공제' : 'unpaid'}
                                          </span>
                                        ) : shift.paidBreakMinutes && shift.paidBreakMinutes > 0 ? (
                                          <span
                                            className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded"
                                            title={`${shift.paidBreakMinutes}m break`}
                                          >
                                            {language === 'ko' ? '휴게 ' : 'Break '}{shift.paidBreakMinutes}m
                                          </span>
                                        ) : shift.breakMinutes > 0 ? (
                                          <span className="text-xs text-slate-500">
                                            {shift.breakMinutes}m
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* Line 4: Position */}
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60">
                                        <span
                                          className={`px-2 py-0.5 rounded font-bold text-sm truncate max-w-full block ${
                                            shift.isOvernight ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'
                                          }`}
                                          title={shift.position || emp.position}
                                        >
                                          {shift.position || emp.position || (language === 'ko' ? '파트' : 'Role')}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openAddModal(emp, day)}
                                      className="w-full h-24 rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-700 transition-all opacity-40 hover:opacity-100 group/cell no-print cursor-pointer"
                                    >
                                      <Plus className="w-4 h-4 group-hover/cell:scale-110 transition-transform" />
                                      <span className="text-sm mt-0.5">{t('noShift')}</span>
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              ) : (
                // Focused Single Business Group Schedule or Filtered Part
                displayedEmployees.map((emp) => {
                  const grp = getBusinessGroup(emp.businessGroup || emp.groupNumber);
                  const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                  const summary = calculateWeeklyHoursSummary(empShifts);
                  const displayName = emp.nickname?.trim() || emp.fullName;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Employee Profile Cell */}
                      <td className="py-3 px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-extrabold text-slate-900 text-base truncate max-w-48">
                              {displayName}
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                              {emp.employeeId}
                            </span>
                          </div>
                          {emp.fullNameKo && (
                            <p className="text-sm text-slate-500 font-medium">{emp.fullNameKo}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-bold border ${grp.badgeBg} truncate max-w-36`}
                              title={grp.name}
                            >
                              {grp.name}
                            </span>
                            {/* Total Hours next to group name */}
                            <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {language === 'ko' ? '총 ' : 'Total '}{summary.totalHours.toFixed(1)}h{summary.overtimeHours > 0 ? ` (+${summary.overtimeHours.toFixed(1)} OT)` : ''}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold truncate max-w-36">
                              {emp.department}
                            </span>
                            {/* Hourly wage hidden on print */}
                            <span className="font-mono text-xs text-emerald-700 font-bold ml-auto print:hidden">
                              ${emp.hourlyWage}/h
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 7 Daily Cells */}
                      {days.map((day) => {
                        const shift = empShifts.find((s) => s.date === day.date);

                        return (
                          <td
                            key={day.date}
                            className="py-2 px-2 border-r border-slate-100 text-center align-top min-w-44"
                          >
                            {shift ? (
                              <div
                                onClick={() => openEditModal(shift)}
                                className={`p-2.5 rounded-xl text-left cursor-pointer transition-all border ${
                                  shift.isOvernight
                                    ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800 shadow-xs'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300'
                                }`}
                              >
                                {/* Line 1: 시작시간 */}
                                <div className="flex items-center justify-between text-base font-bold">
                                  <div className="flex items-center space-x-1">
                                    <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                      {language === 'ko' ? '시작: ' : 'Start: '}
                                    </span>
                                    <span className="font-mono text-base">{shift.startTime}</span>
                                  </div>
                                  {shift.isOvernight && (
                                    <span title={language === 'ko' ? '자정 넘김 야간조' : 'Overnight shift'}>
                                      <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                                    </span>
                                  )}
                                </div>

                                {/* Line 2: 끝나는 시간 */}
                                <div className="flex items-center space-x-1 text-base font-bold mt-0.5">
                                  <span className={`text-xs font-semibold ${shift.isOvernight ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {language === 'ko' ? '종료: ' : 'End: '}
                                  </span>
                                  <span className="font-mono text-base">{shift.endTime}</span>
                                </div>

                                {/* Line 3: 총 근무시간과 휴게시간 */}
                                <div className="flex items-center justify-between mt-1.5 text-sm font-medium">
                                  <span className={`font-mono font-bold ${shift.isOvernight ? 'text-emerald-400' : 'text-emerald-800'}`}>
                                    {shift.hours.toFixed(1)} hrs
                                  </span>
                                  {shift.excessBreakMinutes && shift.excessBreakMinutes > 0 ? (
                                    <span
                                      className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-xs"
                                      title={`${shift.actualBreakMinutes ?? shift.breakMinutes}m taken, ${shift.excessBreakMinutes}m excess unpaid`}
                                    >
                                      -{shift.excessBreakMinutes}m {language === 'ko' ? '공제' : 'unpaid'}
                                    </span>
                                  ) : shift.paidBreakMinutes && shift.paidBreakMinutes > 0 ? (
                                    <span
                                      className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded"
                                      title={`${shift.paidBreakMinutes}m break`}
                                    >
                                      {language === 'ko' ? '휴게 ' : 'Break '}{shift.paidBreakMinutes}m
                                    </span>
                                  ) : shift.breakMinutes > 0 ? (
                                    <span className="text-xs text-slate-500">
                                      {shift.breakMinutes}m
                                    </span>
                                  ) : null}
                                </div>

                                {/* Line 4: Position */}
                                <div className="mt-1.5 pt-1.5 border-t border-slate-200/60">
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold text-sm truncate max-w-full block ${
                                      shift.isOvernight ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'
                                    }`}
                                    title={shift.position || emp.position}
                                  >
                                    {shift.position || emp.position || (language === 'ko' ? '파트' : 'Role')}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openAddModal(emp, day)}
                                className="w-full h-24 rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-700 transition-all opacity-40 hover:opacity-100 group/cell no-print cursor-pointer"
                              >
                                <Plus className="w-4 h-4 group-hover/cell:scale-110 transition-transform" />
                                <span className="text-sm mt-0.5">{t('noShift')}</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Shift Modal */}
      {isModalOpen && modalEmployee && modalDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingShift ? t('editShift') : t('addShift')}
                </h2>
                <p className="text-xs text-slate-500">
                  {modalEmployee.nickname?.trim() ? `${modalEmployee.nickname} (${modalEmployee.fullName})` : modalEmployee.fullName} • {modalDay.dayOfWeek} ({modalDay.date})
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="p-6 space-y-4 text-xs">
              {/* Presets shortcut buttons (Item 11) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>{language === 'ko' ? '근무 프리셋 빠른 선택 (SHIFT PRESET)' : 'Shift Presets'}</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {isModalEmpCashier
                      ? (language === 'ko' ? 'Cashier: 6h+ 20분 / 11h+ 40분' : 'Cashier: 6h+ 20m / 11h+ 40m')
                      : (language === 'ko' ? 'General: 6h+ 30분 / 11h+ 60분' : 'General: 6h+ 30m / 11h+ 60m')}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStartTime('13:00');
                      setEndTime('22:00');
                      setBreakMinutes(isModalEmpCashier ? 20 : 30);
                    }}
                    className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left bg-slate-50 transition-all cursor-pointer"
                  >
                    <p className="font-bold text-slate-900 text-xs flex items-center justify-between">
                      <span>DAY</span>
                      <span className="font-mono text-emerald-700 text-[11px]">13:00 - 22:00</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      9.0 hrs • {isModalEmpCashier ? (language === 'ko' ? '휴게 20분' : '20m break') : (language === 'ko' ? '휴게 30분' : '30m break')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartTime('05:00');
                      setEndTime('13:00');
                      setBreakMinutes(isModalEmpCashier ? 20 : 30);
                    }}
                    className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left bg-slate-50 transition-all cursor-pointer"
                  >
                    <p className="font-bold text-slate-900 text-xs flex items-center justify-between">
                      <span>EARLY</span>
                      <span className="font-mono text-emerald-700 text-[11px]">05:00 - 13:00</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      8.0 hrs • {isModalEmpCashier ? (language === 'ko' ? '휴게 20분' : '20m break') : (language === 'ko' ? '휴게 30분' : '30m break')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartTime('16:00');
                      setEndTime('22:00');
                      setBreakMinutes(isModalEmpCashier ? 20 : 30);
                    }}
                    className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left bg-slate-50 transition-all cursor-pointer"
                  >
                    <p className="font-bold text-slate-900 text-xs flex items-center justify-between">
                      <span>EVENING</span>
                      <span className="font-mono text-emerald-700 text-[11px]">16:00 - 22:00</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      6.0 hrs • {isModalEmpCashier ? (language === 'ko' ? '휴게 20분' : '20m break') : (language === 'ko' ? '휴게 30분' : '30m break')}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStartTime('13:00');
                      setEndTime('21:00');
                      setBreakMinutes(isModalEmpCashier ? 20 : 30);
                    }}
                    className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left bg-slate-50 transition-all cursor-pointer"
                  >
                    <p className="font-bold text-slate-900 text-xs flex items-center justify-between">
                      <span>NIGHT</span>
                      <span className="font-mono text-emerald-700 text-[11px]">13:00 - 21:00</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      8.0 hrs • {isModalEmpCashier ? (language === 'ko' ? '휴게 20분' : '20m break') : (language === 'ko' ? '휴게 30분' : '30m break')}
                    </p>
                  </button>
                </div>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('startTime')} (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatTime12h(startTime)}
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {t('endTime')} (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formatTime12h(endTime)}
                  </span>
                </div>
              </div>

              {/* Position Field (Item 2: 별도의 한줄을 더 만들어서 position을 직접 넣을수 있도록 해줘) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>{language === 'ko' ? '직책 / 담당 업무 (Position) *' : 'Shift Position / Role *'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {language === 'ko' ? '스케쥴 셀에 표시될 직책' : 'Displayed in schedule cell'}
                  </span>
                </label>
                <input
                  type="text"
                  value={shiftPosition}
                  onChange={(e) => setShiftPosition(e.target.value)}
                  placeholder={modalEmployee?.position || (language === 'ko' ? '예: Cashier, Meat Cutter, Kitchen' : 'e.g. Cashier, Meat Cutter, Kitchen')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Paid Break Policy Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isModalEmpCashier
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}
                    >
                      {isModalEmpCashier
                        ? (language === 'ko' ? '캐셔 파트 휴게 기준' : 'Cashier Part Policy')
                        : (language === 'ko' ? '일반 부서 휴게 기준' : 'Standard Department Policy')}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700">
                      {isModalEmpCashier
                        ? (language === 'ko' ? '6시간 이상 20분 / 11시간 이상 40분' : '>=6h 20m / >=11h 40m')
                        : (language === 'ko' ? '6시간 이상 30분 / 11시간 이상 1시간' : '>=6h 30m / >=11h 60m')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                      {language === 'ko' ? '인정 휴게' : 'Break Allowance'}: {liveShiftCalc.paidBreakMinutes}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Actual Break Taken Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs">
                    {language === 'ko' ? '실제 사용 휴게시간 (Actual Break Taken)' : 'Actual Break Taken'} *
                  </label>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    {breakMinutes} {language === 'ko' ? '분 사용' : 'minutes'}
                  </span>
                </div>

                {/* Preset break buttons tailored to role */}
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {(isModalEmpCashier ? [0, 20, 30, 40, 60] : [0, 15, 30, 45, 60]).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setBreakMinutes(mins)}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        breakMinutes === mins
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : mins === liveShiftCalc.paidBreakMinutes
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {mins}m {mins === liveShiftCalc.paidBreakMinutes && '★'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="360"
                    step="5"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900 text-xs"
                  />
                  <span className="text-slate-500 text-xs">{language === 'ko' ? '분 (직접 입력 가능)' : 'min (custom)'}</span>
                </div>
              </div>

              {/* Excess Deduction or Full Pay Notice */}
              {liveShiftCalc.excessBreakMinutes > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {language === 'ko'
                        ? `초과 휴게 ${liveShiftCalc.excessBreakMinutes}분 급여 시간에서 자동 차감`
                        : `Excess Break: -${liveShiftCalc.excessBreakMinutes}m deducted from pay`}
                    </span>
                    <span className="text-amber-800">
                      {language === 'ko'
                        ? `휴게 한도(${liveShiftCalc.paidBreakMinutes}분)를 ${liveShiftCalc.excessBreakMinutes}분 초과하여 차감 처리됩니다.`
                        : `Exceeds the ${liveShiftCalc.paidBreakMinutes}m break allowance. Deduction applied to daily hours.`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-2 text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'ko'
                      ? `전 시간 근무 인정 (실제 휴게가 기준 한도 ${liveShiftCalc.paidBreakMinutes}분 이내이므로 차감 없음)`
                      : `Full pay granted: Break is within the ${liveShiftCalc.paidBreakMinutes}m break allowance.`}
                  </span>
                </div>
              )}

              {/* Live Hours Calculation Card */}
              <div
                className={`p-3.5 rounded-xl border ${
                  liveShiftCalc.isOvernight
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="grid grid-cols-3 gap-2 pb-2 mb-2 border-b border-emerald-200/50 text-[10px]">
                  <div>
                    <span className="opacity-75 block">{language === 'ko' ? '총 근무 시간' : 'Raw Shift'}:</span>
                    <span className="font-mono font-bold text-xs">{liveShiftCalc.rawHours.toFixed(2)} hrs</span>
                  </div>
                  <div>
                    <span className="opacity-75 block">{language === 'ko' ? '인정 휴게' : 'Break'}:</span>
                    <span className="font-mono font-bold text-xs text-emerald-600">+{liveShiftCalc.paidBreakMinutes}m</span>
                  </div>
                  <div>
                    <span className="opacity-75 block">{language === 'ko' ? '초과 차감' : 'Unpaid Excess'}:</span>
                    <span className={`font-mono font-bold text-xs ${liveShiftCalc.excessBreakMinutes > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      -{liveShiftCalc.excessBreakMinutes}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">
                    {t('dailyHours')} ({language === 'ko' ? '실제 지급 시간' : 'Payable Hours'}):
                  </span>
                  <span className="font-mono text-base font-extrabold text-emerald-400">
                    {liveShiftCalc.hours.toFixed(2)} hours
                  </span>
                </div>

                {liveShiftCalc.isOvernight && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center space-x-1.5 text-xs text-indigo-300">
                    <Moon className="w-3.5 h-3.5" />
                    <span>
                      {language === 'ko'
                        ? '자정 날짜 넘김 (Overnight) 감지: 24시간 주기가 자동 적용되었습니다.'
                        : 'Overnight shift detected crossing midnight. Correctly calculated.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('notes')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Loading dock receiver or lane 2 cashier"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  {editingShift && (
                    <button
                      type="button"
                      onClick={handleDeleteShift}
                      className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('deleteShift')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyShiftToNextDay}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
                    title="Copy this same shift time to next day"
                  >
                    {t('copyShift')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                  >
                    {language === 'ko' ? '저장' : 'Save Shift'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Past Schedule Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Copy className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {t('copyScheduleModalTitle')}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {t('copyScheduleModalDesc')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {copyFeedback && (
                <div className={`p-3 rounded-xl border flex items-center space-x-2 font-bold ${
                  copyFeedback.includes('Error') || copyFeedback.includes('오류')
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{copyFeedback}</span>
                </div>
              )}

              {/* Source Week Selector */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  {t('sourceWeekLabel')} *
                </label>
                <div className="space-y-2">
                  <select
                    value={sourceWeekFriday}
                    onChange={(e) => setSourceWeekFriday(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {[1, 2, 3, 4, 5, 6].map((weeksAgo) => {
                      let pastFri = currentWeekFriday;
                      for (let w = 0; w < weeksAgo; w++) {
                        pastFri = getPreviousWeekFriday(pastFri);
                      }
                      return (
                        <option key={pastFri} value={pastFri}>
                          {weeksAgo === 1
                            ? (language === 'ko' ? '지난 주' : '1 Week Ago')
                            : `${weeksAgo} ${language === 'ko' ? '주 전' : 'Weeks Ago'}`}{' '}
                          — {formatWorkWeekRange(pastFri, language)}
                        </option>
                      );
                    })}
                  </select>

                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <span>{language === 'ko' ? '또는 직접 날짜 선택 (금요일):' : 'Or enter custom Friday date:'}</span>
                    <input
                      type="date"
                      value={sourceWeekFriday}
                      onChange={(e) => setSourceWeekFriday(getWorkWeekFriday(new Date(e.target.value)))}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Target Week Summary */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Workweek</span>
                  <span className="font-bold text-slate-900 font-sans">{formatWorkWeekRange(currentWeekFriday, language)}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Current Active Week
                </span>
              </div>

              {/* Conflict Resolution Mode */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  {t('copyModeLabel')}
                </label>
                <div className="space-y-2">
                  <label className="flex items-start space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      value="merge"
                      checked={copyMode === 'merge'}
                      onChange={() => setCopyMode('merge')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-bold text-slate-900">{t('copyModeMerge')}</p>
                      <p className="text-[11px] text-slate-500">
                        {language === 'ko'
                          ? '이미 이번 주에 배정된 근무는 그대로 두고, 휴무(빈 칸)인 날에만 지난 스케줄을 추가합니다.'
                          : 'Preserves any shifts you already scheduled this week; fills empty off days.'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      value="overwrite"
                      checked={copyMode === 'overwrite'}
                      onChange={() => setCopyMode('overwrite')}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-bold text-rose-900">{t('copyModeOverwrite')}</p>
                      <p className="text-[11px] text-slate-500">
                        {language === 'ko'
                          ? '이번 주의 기존 스케줄을 전부 지우고 지난 주의 모든 근무로 100% 교체합니다.'
                          : 'Removes all shifts currently in this workweek and mirrors the past week.'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCopySchedule}
                  disabled={isCopying}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isCopying ? 'Copying...' : t('executeCopy')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview & Print Execution Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '주간 근무 스케줄 인쇄 및 내보내기' : 'Weekly Work Schedule Print & Export'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    MANAGEMENT OF CULMORE • {formatWorkWeekRange(currentWeekFriday, language)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Options Toolbar */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Branch Scope Selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700 shrink-0">
                    {language === 'ko' ? '인쇄 대상 사업장:' : 'Target Branch:'}
                  </span>
                  <div className="flex items-center space-x-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPrintTargetGroup('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        printTargetGroup === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {language === 'ko' ? '전체 사업장 (All Branches)' : 'All Branches'}
                    </button>
                    {BUSINESS_GROUPS.map((grp) => (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => setPrintTargetGroup(grp.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          printTargetGroup === grp.id
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {grp.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detail Mode */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700 shrink-0">
                    {language === 'ko' ? '표시 모드:' : 'Mode:'}
                  </span>
                  <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPrintDetailMode('compact')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        printDetailMode === 'compact'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {language === 'ko' ? '간략히' : 'Compact'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintDetailMode('detailed')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        printDetailMode === 'detailed'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {language === 'ko' ? '휴게시간 포함' : 'Detailed'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Portrait Print Notice */}
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs">
                <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {language === 'ko'
                    ? '💡 인쇄 팁: 주간 스케줄은 [세로 (Portrait)] 표준 규격으로 자동 최적화되어 깔끔하게 출력됩니다.'
                    : '💡 Print Tip: The schedule is optimized for standard [Portrait] layout.'}
                </span>
              </div>
            </div>

            {/* Scrollable Live Print Sheet Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70">
              <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-300 shadow-sm p-6 space-y-4">
                {/* Paper Header */}
                <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      MANAGEMENT OF CULMORE
                    </h1>
                    <p className="text-xs text-slate-500">4210 John Marr Dr, Annandale, VA 22003 • (703) 555-0199</p>
                    <p className="text-xs font-bold text-emerald-800 mt-1">
                      {language === 'ko' ? '공식 주간 근무 스케줄표' : 'Official Weekly Work Schedule'}:{' '}
                      {formatWorkWeekRange(currentWeekFriday, language)}
                    </p>
                    <p className="text-xs text-slate-700">
                      <strong>{language === 'ko' ? '출력 대상' : 'Scope'}:</strong>{' '}
                      {printTargetGroup === 'ALL'
                        ? language === 'ko'
                          ? '전체 5개 사업장 (All Branches)'
                          : 'All 5 Branches'
                        : BUSINESS_GROUPS.find((g) => g.id === printTargetGroup)?.name}
                    </p>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <div>
                      <strong>Date:</strong> {new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US')}
                    </div>
                    <div>FLSA Virginia (Fri - Thu)</div>
                    <div className="text-emerald-700 font-bold mt-1">MANAGEMENT OF CULMORE</div>
                  </div>
                </div>

                {/* Groups Tables Preview */}
                <div className="space-y-4">
                  {(printTargetGroup === 'ALL'
                    ? BUSINESS_GROUPS
                    : BUSINESS_GROUPS.filter((g) => g.id === printTargetGroup)
                  ).map((grp) => {
                    const grpEmps = activeEmployees.filter(
                      (e) => getBusinessGroup(e.businessGroup || e.groupNumber).id === grp.id
                    );

                    let grpTotalHours = 0;
                    let grpTotalOt = 0;

                    grpEmps.forEach((emp) => {
                      const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                      const sum = calculateWeeklyHoursSummary(empShifts);
                      grpTotalHours += sum.totalHours;
                      grpTotalOt += sum.overtimeHours;
                    });

                    if (grpEmps.length === 0 && printTargetGroup === 'ALL') {
                      return null;
                    }

                    return (
                      <div key={grp.id} className="border border-slate-300 rounded-lg overflow-hidden">
                        <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                          <span>
                            {grp.name}
                          </span>
                          <span className="text-[11px] font-normal text-slate-300">
                            {language === 'ko' ? '인원' : 'Staff'}: {grpEmps.length}명 • {language === 'ko' ? '소계' : 'Subtotal'}:{' '}
                            {grpTotalHours.toFixed(1)}h {grpTotalOt > 0 ? `(OT: ${grpTotalOt.toFixed(1)}h)` : ''}
                          </span>
                        </div>

                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                              <th className="py-2 px-2 text-center w-9 border-r border-slate-200">No</th>
                              <th className="py-2 px-2.5 text-left w-44 border-r border-slate-200">
                                {language === 'ko' ? '직원명 / 부서' : 'Employee / Dept'}
                              </th>
                              {days.map((day, idx) => (
                                <th
                                  key={day.date}
                                  className={`py-2 px-1 text-center border-r border-slate-200 ${
                                    idx === 1 || idx === 2 ? 'bg-amber-100/60 text-amber-900' : ''
                                  }`}
                                >
                                  <div>{language === 'ko' ? day.dayOfWeekKo : day.dayOfWeek}</div>
                                  <div className="text-xs font-normal opacity-75">
                                    {language === 'ko' ? day.displayDateKo : day.displayDate}
                                  </div>
                                </th>
                              ))}
                              <th className="py-2 px-2 text-right w-24">
                                {language === 'ko' ? '주간 합계' : 'Total'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {grpEmps.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="py-4 text-center text-slate-400 italic text-sm">
                                  {language === 'ko' ? '등록된 직원이 없습니다.' : 'No employees in this group.'}
                                </td>
                              </tr>
                            ) : (
                              grpEmps.map((emp, index) => {
                                const empShifts = effectiveShifts.filter((s) => s.employeeId === emp.employeeId);
                                const summary = calculateWeeklyHoursSummary(empShifts);
                                const isOt = summary.totalHours > 40;
                                const displayName = emp.nickname?.trim() || emp.fullName;

                                return (
                                  <tr key={emp.employeeId} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                                    <td className="py-1.5 px-1 text-center text-slate-500 text-xs border-r border-slate-200">
                                      {index + 1}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-left border-r border-slate-200">
                                      <div className="font-bold text-slate-900 text-base">{displayName}</div>
                                      <div className="text-xs text-slate-500">
                                        {emp.department} • {emp.position}
                                      </div>
                                    </td>
                                    {days.map((day) => {
                                      const s = empShifts.find((sh) => sh.date === day.date);
                                      if (!s) {
                                        return (
                                          <td
                                            key={day.date}
                                            className="py-1.5 px-1 text-center text-slate-400 text-sm font-semibold bg-slate-50/30 border-r border-slate-200"
                                          >
                                            OFF
                                          </td>
                                        );
                                      }
                                      return (
                                        <td
                                          key={day.date}
                                          className="py-1.5 px-1 text-center border-r border-slate-200 leading-snug"
                                        >
                                          <div className="font-bold text-slate-900 text-[15px]">
                                            {s.startTime}
                                          </div>
                                          <div className="font-bold text-slate-900 text-[15px]">
                                            {s.endTime}
                                          </div>
                                          <div className="text-xs text-emerald-700 font-bold">
                                            {s.hours.toFixed(1)}h ({language === 'ko' ? `휴게 ${s.paidBreakMinutes || 0}m` : `Break ${s.paidBreakMinutes || 0}m`}){s.isOvernight ? ' 🌙' : ''}
                                          </div>
                                          {s.position && (
                                            <div className="text-xs text-indigo-700 font-bold truncate">
                                              {s.position}
                                            </div>
                                          )}
                                          {printDetailMode === 'detailed' && s.actualBreakMinutes ? (
                                            <div className="text-[11px] text-slate-400">
                                              {language === 'ko' ? `휴게 ${s.actualBreakMinutes}분` : `Break ${s.actualBreakMinutes}m`}
                                            </div>
                                          ) : null}
                                        </td>
                                      );
                                    })}
                                    <td
                                      className={`py-1.5 px-2 text-right font-bold text-sm ${
                                        isOt ? 'text-rose-700 bg-rose-50/50' : 'text-emerald-800'
                                      }`}
                                    >
                                      <div>{summary.totalHours.toFixed(1)}h</div>
                                      {isOt && (
                                        <div className="text-xs text-rose-600 font-normal">
                                          +{summary.overtimeHours.toFixed(1)}h
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                {/* Signatures Preview */}
                <div className="pt-4 border-t border-dashed border-slate-300 flex justify-between text-xs text-slate-600">
                  <div>
                    {language === 'ko' ? '작성자 (Scheduler)' : 'Prepared By'}:{' '}
                    <span className="inline-block w-28 border-b border-slate-400 ml-1"></span>
                  </div>
                  <div>
                    {language === 'ko' ? '매니저 승인 (Manager)' : 'Approved By'}:{' '}
                    <span className="inline-block w-28 border-b border-slate-400 ml-1"></span>
                  </div>
                  <div>
                    {language === 'ko' ? '승인 일자 (Date)' : 'Approval Date'}:{' '}
                    <span className="inline-block w-28 border-b border-slate-400 ml-1"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Feedback Banner */}
            {printFeedback && (
              <div className="mx-6 my-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{printFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold ml-2 underline"
                >
                  {language === 'ko' ? '확인' : 'OK'}
                </button>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDownloadPrintableHtml(printTargetGroup, printDetailMode)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                title={language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download Printable HTML File'}
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>{language === 'ko' ? '인쇄용 HTML 파일 다운로드' : 'Download Printable HTML'}</span>
              </button>

              <div className="flex flex-wrap items-center space-x-2 w-full sm:w-auto justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>

                {/* Primary Anchor Link: 100% Guaranteed to open top-level tab and pop print dialog */}
                <a
                  href={getPrintStandaloneUrl(printTargetGroup, printDetailMode)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title={language === 'ko' ? '새 탭에서 열어 인쇄' : 'Open in New Tab & Print'}
                >
                  <Printer className="w-4 h-4" />
                  <span>{language === 'ko' ? '지금 바로 인쇄하기 (새 창)' : 'Print Schedule Now'}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                {/* Direct Print Fallback Button */}
                <button
                  type="button"
                  onClick={() => handleDirectPrintSchedule(printTargetGroup, printDetailMode)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                  title={language === 'ko' ? '현재 창에서 인쇄 시도' : 'Try Direct Print'}
                >
                  <span>{language === 'ko' ? '직접 호출' : 'Call Dialog'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Auto-Backup, Save to Computer & Restore Modal */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'ko' ? '주간 스케줄 자동 백업 및 컴퓨터 저장 · 불러오기' : 'Schedule Auto-Backup, Computer Save & Restore'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === 'ko'
                      ? `대상 주간: ${currentWeekFriday} (${formatWorkWeekRange(currentWeekFriday, language)})`
                      : `Target Workweek: ${currentWeekFriday} (${formatWorkWeekRange(currentWeekFriday, language)})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              {backupFeedback && (
                <div
                  className={`p-3 rounded-xl font-bold flex items-center justify-between border ${
                    backupFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{backupFeedback.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackupFeedback(null)}
                    className="underline text-[11px] ml-2 cursor-pointer"
                  >
                    {language === 'ko' ? '닫기' : 'Dismiss'}
                  </button>
                </div>
              )}

              {/* 1. Manual Save & File Load */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                      <HardDriveDownload className="w-4 h-4 text-emerald-600" />
                      <span>{language === 'ko' ? '수동 백업 파일 저장' : 'Manual Save to Computer'}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'ko'
                        ? `현재 주간(${currentWeekFriday})의 근무 ${effectiveShifts.length}건을 내 컴퓨터에 .json 파일로 보관합니다.`
                        : `Download ${effectiveShifts.length} shifts of week ${currentWeekFriday} as a .json backup file.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickSaveScheduleBackup}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ko' ? '내 컴퓨터에 저장 (.json)' : 'Save to Computer (.json)'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                      <FolderOpen className="w-4 h-4 text-indigo-600" />
                      <span>{language === 'ko' ? '컴퓨터에서 백업 불러오기' : 'Load Backup File (.json)'}</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {language === 'ko'
                        ? '저장해 둔 .json 백업 파일을 불러와 현재 주간 스케줄에 즉시 적용합니다.'
                        : 'Select a saved .json schedule backup file from your computer to apply.'}
                    </p>
                  </div>
                  <label className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center space-x-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{language === 'ko' ? '백업 파일 선택 (.json)' : 'Choose Backup File (.json)'}</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleUploadBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Apply Mode Option */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">
                  {language === 'ko' ? '백업 적용 방식 선택' : 'Restore Application Mode'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('overwrite')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      restoreMode === 'overwrite'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{language === 'ko' ? '기존 스케줄 덮어쓰기 (Overwrite)' : 'Overwrite Current Week'}</div>
                    <div className={`text-[10px] ${restoreMode === 'overwrite' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {language === 'ko' ? '현재 주간을 백업 내용으로 전체 교체' : 'Replace current week shifts completely'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      restoreMode === 'merge'
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{language === 'ko' ? '빈 날짜만 채우기 (Merge)' : 'Merge Into Empty Slots'}</div>
                    <div className={`text-[10px] ${restoreMode === 'merge' ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {language === 'ko' ? '기존 근무를 유지하고 비어있는 요일만 복원' : 'Keep existing shifts, fill empty days'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview Uploaded File */}
              {uploadedBackup && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px]">
                        {language === 'ko' ? '불러온 파일 미리보기' : 'Loaded Backup Preview'}
                      </span>
                      <p className="font-bold text-slate-900 mt-1">
                        {language === 'ko'
                          ? `기준 주간: ${uploadedBackup.weekStartDate} • 근무 ${uploadedBackup.shiftCount}건`
                          : `Source Week: ${uploadedBackup.weekStartDate} • ${uploadedBackup.shiftCount} shifts`}
                      </p>
                      <p className="text-[11px] text-slate-600 font-mono">
                        Exported: {new Date(uploadedBackup.exportedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isRestoringBackup}
                      onClick={() => handleApplyBackup(uploadedBackup)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                    >
                      {isRestoringBackup
                        ? language === 'ko'
                          ? '적용 중...'
                          : 'Applying...'
                        : language === 'ko'
                        ? '현재 주간에 적용하기'
                        : 'Apply to Current Week'}
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Automatic Backup History List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    {language === 'ko'
                      ? `자동 저장된 백업 이력 (${autoBackups.length}건)`
                      : `Automatic Backup Snapshots (${autoBackups.length})`}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ko' ? '스케줄 수정·삭제·복사 시 자동 생성됨' : 'Auto-saved on every shift change'}
                  </span>
                </div>

                {autoBackups.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                    {language === 'ko'
                      ? '아직 자동 저장된 백업이 없습니다. 스케줄을 입력하거나 [컴퓨터 백업 저장]을 눌러주세요.'
                      : 'No automatic backups captured yet.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {autoBackups.map((bak) => (
                      <div key={bak.id} className="p-3 bg-white hover:bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                bak.reason === 'manual'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {bak.reason === 'manual'
                                ? language === 'ko'
                                  ? '수동'
                                  : 'Manual'
                                : language === 'ko'
                                ? '자동백업'
                                : 'Auto'}
                            </span>
                            <span className="font-mono font-bold text-slate-900">{bak.weekStartDate}</span>
                            <span className="text-slate-500">• {bak.shiftCount}{language === 'ko' ? '건' : ' shifts'}</span>
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {new Date(bak.exportedAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              downloadJsonFile(
                                `Culmore_Schedule_Backup_${bak.weekStartDate}_${formatTimestampForFilename(bak.exportedAt)}.json`,
                                bak
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>{language === 'ko' ? '저장' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isRestoringBackup}
                            onClick={() => handleApplyBackup(bak)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            {language === 'ko' ? '불러와 적용' : 'Restore'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAutoBackups(deleteScheduleAutoBackup(bak.id))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title={language === 'ko' ? '백업 삭제' : 'Delete backup'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {language === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
