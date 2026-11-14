import {
  Employee,
  FinalPayrollArchive,
  PayrollPeriod,
  PayrollRecord,
  ScheduleBackupFile,
  Shift,
  StoreSettings,
} from '../types';

export const SCHEDULE_AUTO_BACKUPS_KEY = 'culmore_schedule_auto_backups';
export const FINAL_PAYROLL_ARCHIVES_KEY = 'culmore_final_payroll_archives';

export function formatTimestampForFilename(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Triggers a clean browser download of a JSON snapshot file to the user's computer.
 */
export function downloadJsonFile(filename: string, payload: unknown): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Opens an HTML document in a new tab via Blob URL (and triggers auto-print from inside the document).
 * Works cleanly inside iframe sandboxes without using forbidden window.open() APIs.
 */
export function openHtmlInNewTabForPrint(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Saves an automatic schedule snapshot into localStorage (keeps latest 20 snapshots).
 */
export function saveScheduleAutoBackup(
  weekStartDate: string,
  shifts: Shift[],
  reason: 'auto' | 'manual' = 'auto'
): ScheduleBackupFile {
  const nowIso = new Date().toISOString();
  const snapshot: ScheduleBackupFile = {
    type: 'CULMORE_SCHEDULE_BACKUP',
    version: 1,
    id: `sched_bak_${weekStartDate}_${Date.now()}`,
    weekStartDate,
    exportedAt: nowIso,
    reason,
    shiftCount: shifts.length,
    shifts: shifts.map((s) => ({ ...s })),
  };

  try {
    const existing = loadScheduleAutoBackups();
    const filtered = [snapshot, ...existing].slice(0, 20);
    localStorage.setItem(SCHEDULE_AUTO_BACKUPS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Could not write schedule auto-backup to localStorage:', err);
  }

  return snapshot;
}

export function loadScheduleAutoBackups(): ScheduleBackupFile[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_AUTO_BACKUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ScheduleBackupFile =>
        item && item.type === 'CULMORE_SCHEDULE_BACKUP' && Array.isArray(item.shifts)
    );
  } catch {
    return [];
  }
}

export function deleteScheduleAutoBackup(backupId: string): ScheduleBackupFile[] {
  const remaining = loadScheduleAutoBackups().filter((b) => b.id !== backupId);
  try {
    localStorage.setItem(SCHEDULE_AUTO_BACKUPS_KEY, JSON.stringify(remaining));
  } catch {
    // ignore storage errors
  }
  return remaining;
}

export function downloadScheduleBackupToComputer(
  weekStartDate: string,
  shifts: Shift[],
  reason: 'auto' | 'manual' = 'manual'
): ScheduleBackupFile {
  const snapshot = saveScheduleAutoBackup(weekStartDate, shifts, reason);
  const filename = `Culmore_Schedule_Backup_${weekStartDate}_${formatTimestampForFilename(snapshot.exportedAt)}.json`;
  downloadJsonFile(filename, snapshot);
  return snapshot;
}

export function parseScheduleBackupJson(rawText: string): ScheduleBackupFile {
  const parsed = JSON.parse(rawText);
  if (
    !parsed ||
    parsed.type !== 'CULMORE_SCHEDULE_BACKUP' ||
    !parsed.weekStartDate ||
    !Array.isArray(parsed.shifts)
  ) {
    throw new Error('Invalid schedule backup file format.');
  }
  return parsed as ScheduleBackupFile;
}

/**
 * Builds and persists a Finalized Payroll Archive snapshot in localStorage (up to 30 periods).
 */
export function buildFinalPayrollArchive(params: {
  period: PayrollPeriod;
  records: PayrollRecord[];
  employees: Employee[];
  settings: StoreSettings;
  finalizedBy: string;
}): FinalPayrollArchive {
  const nowIso = new Date().toISOString();
  return {
    type: 'CULMORE_FINAL_PAYROLL_ARCHIVE',
    version: 1,
    id: `final_pay_${params.period.weekStartDate}_${Date.now()}`,
    savedAt: nowIso,
    finalizedBy: params.finalizedBy,
    period: { ...params.period },
    records: params.records.map((r) => ({ ...r })),
    employees: params.employees.map((e) => ({ ...e })),
    settings: { ...params.settings },
  };
}

export function saveFinalPayrollArchiveLocal(archive: FinalPayrollArchive): FinalPayrollArchive[] {
  try {
    const existing = loadFinalPayrollArchivesLocal().filter(
      (a) => a.period.weekStartDate !== archive.period.weekStartDate
    );
    const updated = [archive, ...existing].slice(0, 30);
    localStorage.setItem(FINAL_PAYROLL_ARCHIVES_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Could not save final payroll archive to localStorage:', err);
    return [archive];
  }
}

export function loadFinalPayrollArchivesLocal(): FinalPayrollArchive[] {
  try {
    const raw = localStorage.getItem(FINAL_PAYROLL_ARCHIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FinalPayrollArchive =>
        item &&
        item.type === 'CULMORE_FINAL_PAYROLL_ARCHIVE' &&
        item.period &&
        Array.isArray(item.records)
    );
  } catch {
    return [];
  }
}

export function downloadFinalPayrollArchiveToComputer(archive: FinalPayrollArchive): string {
  const filename = `Culmore_Final_Payroll_${archive.period.weekStartDate}_${formatTimestampForFilename(archive.savedAt)}.json`;
  downloadJsonFile(filename, archive);
  return filename;
}

export function parseFinalPayrollArchiveJson(rawText: string): FinalPayrollArchive {
  const parsed = JSON.parse(rawText);
  if (
    !parsed ||
    parsed.type !== 'CULMORE_FINAL_PAYROLL_ARCHIVE' ||
    !parsed.period ||
    !Array.isArray(parsed.records)
  ) {
    throw new Error('Invalid final payroll archive file format.');
  }
  return parsed as FinalPayrollArchive;
}
