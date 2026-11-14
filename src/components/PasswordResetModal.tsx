import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  X,
  Copy,
  Check,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Users,
  Shield,
  Send,
  Search,
} from 'lucide-react';
import { useAuth, InitiatePasswordResetResult } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Administrator,
  Employee,
  PasswordResetRequest,
  PasswordResetTargetType,
} from '../types';

export interface PasswordResetInitialTarget {
  type: PasswordResetTargetType;
  idOrEmail: string;
}

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  administrators: Administrator[];
  initialTarget?: PasswordResetInitialTarget | null;
  onSaveEmployeeEmail?: (employee: Employee, newEmail: string) => Promise<void>;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  employees,
  administrators,
  initialTarget,
  onSaveEmployeeEmail,
}) => {
  const { language } = useLanguage();
  const {
    requestPasswordResetWithTempCode,
    completePasswordReset,
    listPasswordResetRequests,
    revokePasswordResetRequest,
  } = useAuth();

  const [targetType, setTargetType] = useState<PasswordResetTargetType>('employee');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedAdminUid, setSelectedAdminUid] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [saveEmailToEmployee, setSaveEmailToEmployee] = useState<boolean>(true);

  const [isSending, setIsSending] = useState(false);
  const [issuedResult, setIssuedResult] = useState<InitiatePasswordResetResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Verify & Complete Password Reset fields
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [oobCodeInput, setOobCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Recent requests history
  const [history, setHistory] = useState<PasswordResetRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await listPasswordResetRequests();
      setHistory(list);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Initialize state when modal opens or initialTarget changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIssuedResult(null);
    setVerifyCodeInput('');
    setOobCodeInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setSearchQuery('');
    loadHistory();

    if (initialTarget) {
      setTargetType(initialTarget.type);
      if (initialTarget.type === 'employee') {
        const emp = employees.find(
          (e) =>
            e.employeeId === initialTarget.idOrEmail ||
            e.id === initialTarget.idOrEmail ||
            e.email?.toLowerCase() === initialTarget.idOrEmail.toLowerCase()
        );
        if (emp) {
          setSelectedEmpId(emp.employeeId);
          setEmailInput(emp.email || '');
        }
      } else {
        const adm = administrators.find(
          (a) =>
            a.uid === initialTarget.idOrEmail ||
            a.email.toLowerCase() === initialTarget.idOrEmail.toLowerCase()
        );
        if (adm) {
          setSelectedAdminUid(adm.uid);
          setEmailInput(adm.email || adm.loginId || '');
        }
      }
    } else {
      setTargetType('employee');
      const firstEmp = employees[0];
      if (firstEmp) {
        setSelectedEmpId(firstEmp.employeeId);
        setEmailInput(firstEmp.email || '');
      }
      const firstAdm = administrators[0];
      if (firstAdm) {
        setSelectedAdminUid(firstAdm.uid);
      }
    }
  }, [isOpen, initialTarget, employees, administrators]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const filteredAdmins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return administrators;
    return administrators.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.loginId || '').toLowerCase().includes(q)
    );
  }, [administrators, searchQuery]);

  const selectedEmployee = employees.find((e) => e.employeeId === selectedEmpId);
  const selectedAdmin = administrators.find((a) => a.uid === selectedAdminUid);

  if (!isOpen) return null;

  const handleSelectTargetType = (type: PasswordResetTargetType) => {
    setTargetType(type);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIssuedResult(null);
    if (type === 'employee') {
      const target = selectedEmployee || employees[0];
      if (target) {
        setSelectedEmpId(target.employeeId);
        setEmailInput(target.email || '');
      } else {
        setEmailInput('');
      }
    } else {
      const target = selectedAdmin || administrators[0];
      if (target) {
        setSelectedAdminUid(target.uid);
        setEmailInput(target.email || target.loginId || '');
      } else {
        setEmailInput('');
      }
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setErrorMsg(
        language === 'ko'
          ? '등록된 이메일 또는 로그인 ID를 입력해주세요.'
          : 'Please enter the registered email address or login ID.'
      );
      return;
    }

    try {
      setIsSending(true);
      if (
        targetType === 'employee' &&
        selectedEmployee &&
        saveEmailToEmployee &&
        onSaveEmployeeEmail &&
        trimmedEmail.includes('@') &&
        selectedEmployee.email !== trimmedEmail
      ) {
        await onSaveEmployeeEmail(selectedEmployee, trimmedEmail);
      }

      const result = await requestPasswordResetWithTempCode({
        emailOrId: trimmedEmail,
        targetType,
        targetName:
          targetType === 'employee'
            ? selectedEmployee?.fullName || trimmedEmail
            : selectedAdmin?.name || trimmedEmail,
        targetUid:
          targetType === 'employee'
            ? selectedEmployee?.employeeId
            : selectedAdmin?.uid,
      });

      setIssuedResult(result);
      setVerifyCodeInput(result.tempCode);
      setSuccessMsg(
        language === 'ko'
          ? `임시 인증 코드가 발급되었으며, ${result.request.email} 앞으로 비밀번호 재설정 처리가 기록되었습니다.`
          : `Temporary verification code issued for ${result.request.email}.`
      );
      await loadHistory();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to issue password reset code.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetEmail = issuedResult?.request.email || emailInput.trim();
    if (!targetEmail) {
      setErrorMsg(
        language === 'ko'
          ? '대상 계정 이메일을 먼저 선택하거나 입력하세요.'
          : 'Please select or enter a target email first.'
      );
      return;
    }
    if (!verifyCodeInput.trim() && !oobCodeInput.trim()) {
      setErrorMsg(
        language === 'ko'
          ? '6자리 임시 인증 코드 또는 이메일로 받은 재설정 코드(oobCode)를 입력하세요.'
          : 'Enter the 6-digit temporary verification code or emailed Firebase reset code.'
      );
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setErrorMsg(
        language === 'ko'
          ? '새 비밀번호는 최소 6자 이상이어야 합니다.'
          : 'New password must be at least 6 characters.'
      );
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMsg(
        language === 'ko'
          ? '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.'
          : 'Passwords do not match.'
      );
      return;
    }

    try {
      setIsCompleting(true);
      const res = await completePasswordReset({
        emailOrId: targetEmail,
        tempCode: verifyCodeInput.trim() || undefined,
        firebaseOobCode: oobCodeInput.trim() || undefined,
        newPassword: newPasswordInput,
      });
      setSuccessMsg(res.message);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setOobCodeInput('');
      await loadHistory();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to complete password reset.');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCopyTempCode = async () => {
    if (!issuedResult?.tempCode) return;
    try {
      await navigator.clipboard.writeText(issuedResult.tempCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">
                {language === 'ko'
                  ? '직원 및 관리자 비밀번호 재설정 (임시 인증 코드 발송)'
                  : 'Admin & Employee Password Reset (Temporary Code Dispatch)'}
              </h2>
              <p className="text-[11px] text-slate-300">
                {language === 'ko'
                  ? '비밀번호를 분실한 계정의 등록된 이메일로 임시 인증 코드 및 재설정 링크를 발급하고 검증합니다.'
                  : 'Issue a 15-minute 6-digit temporary verification code & reset email via AuthContext.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Step 1: Select Employee or Administrator & Issue Code */}
          <form onSubmit={handleSendResetCode} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                {language === 'ko' ? '1단계: 대상 계정 선택 및 인증 코드 발송' : 'Step 1: Select Account & Dispatch Verification Code'}
              </span>

              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSelectTargetType('employee')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    targetType === 'employee'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? `직원 (${employees.length})` : `Employees (${employees.length})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTargetType('admin')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    targetType === 'admin'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{language === 'ko' ? `관리자 (${administrators.length})` : `Admins (${administrators.length})`}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {targetType === 'employee'
                    ? language === 'ko'
                      ? '대상 직원 검색 및 선택'
                      : 'Search & Select Employee'
                    : language === 'ko'
                    ? '대상 관리자 검색 및 선택'
                    : 'Search & Select Administrator'}
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'ko' ? '이름, 사번, 이메일 검색...' : 'Filter by name, ID, email...'}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                {targetType === 'employee' ? (
                  <select
                    value={selectedEmpId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setSelectedEmpId(empId);
                      const found = employees.find((emp) => emp.employeeId === empId);
                      setEmailInput(found?.email || '');
                      setIssuedResult(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 cursor-pointer"
                  >
                    <option value="">
                      {language === 'ko' ? '-- 직접 이메일 입력 --' : '-- Manual Email Entry --'}
                    </option>
                    {filteredEmployees.map((emp) => (
                      <option key={emp.id || emp.employeeId} value={emp.employeeId}>
                        {emp.fullName} ({emp.employeeId}) — {emp.email || (language === 'ko' ? '이메일 미등록' : 'No email')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedAdminUid}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setSelectedAdminUid(uid);
                      const found = administrators.find((a) => a.uid === uid);
                      setEmailInput(found?.email || found?.loginId || '');
                      setIssuedResult(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 cursor-pointer"
                  >
                    <option value="">
                      {language === 'ko' ? '-- 직접 이메일/ID 입력 --' : '-- Manual Email/ID Entry --'}
                    </option>
                    {filteredAdmins.map((adm) => (
                      <option key={adm.uid} value={adm.uid}>
                        {adm.name} [{adm.role}] — {adm.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '등록된 수신 이메일 / 로그인 ID *' : 'Registered Email / Login ID *'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {targetType === 'employee' && selectedEmployee && selectedEmployee.email !== emailInput.trim() && (
                  <label className="mt-2 flex items-center space-x-2 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveEmailToEmployee}
                      onChange={(e) => setSaveEmailToEmployee(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>
                      {language === 'ko'
                        ? '입력한 이메일을 해당 직원 프로필에 함께 저장'
                        : 'Save entered email to employee profile'}
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="mt-3 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSending
                      ? language === 'ko'
                        ? '발송 중...'
                        : 'Issuing Code & Sending...'
                      : language === 'ko'
                      ? '임시 인증 코드 생성 및 이메일 발송'
                      : 'Generate Temp Code & Send Reset Email'}
                  </span>
                </button>
              </div>
            </div>

            {/* Issued Code Display Card */}
            {issuedResult && (
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase">
                      {issuedResult.firebaseEmailSent
                        ? language === 'ko'
                          ? '이메일 발송 완료'
                          : 'Firebase Reset Email Sent'
                        : language === 'ko'
                        ? '임시 코드 발급 완료'
                        : 'Temporary Code Issued'}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{language === 'ko' ? '15분간 유효' : 'Valid 15 mins'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">{issuedResult.firebaseMessage}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Recipient: {issuedResult.request.email}
                  </p>
                </div>

                <div className="flex items-center space-x-2 bg-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-700 shrink-0">
                  <div>
                    <div className="text-[9px] uppercase text-slate-400 font-bold">
                      {language === 'ko' ? '임시 인증 코드' : 'TEMP CODE'}
                    </div>
                    <div className="text-xl font-mono font-black tracking-[0.25em] text-emerald-400">
                      {issuedResult.tempCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTempCode}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer"
                    title={language === 'ko' ? '코드 복사' : 'Copy Code'}
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Step 2: Verify Code & Complete Password Reset */}
          <form onSubmit={handleCompleteReset} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                {language === 'ko'
                  ? '2단계: 임시 인증 코드 확인 및 새 비밀번호 재설정 완료'
                  : 'Step 2: Verify Temporary Code & Complete Password Reset'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '6자리 임시 인증 코드' : '6-Digit Temp Code'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCodeInput}
                  onChange={(e) => setVerifyCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold tracking-widest text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '이메일 Action Code (선택)' : 'Email oobCode (Optional)'}
                </label>
                <input
                  type="text"
                  value={oobCodeInput}
                  onChange={(e) => setOobCodeInput(e.target.value)}
                  placeholder="Firebase email code"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '새 비밀번호 (6자 이상)' : 'New Password (6+ chars)'}
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '새 비밀번호 확인' : 'Confirm Password'}
                </label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isCompleting}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {isCompleting
                    ? language === 'ko'
                      ? '검증 및 재설정 중...'
                      : 'Verifying & Resetting...'
                    : language === 'ko'
                    ? '인증 코드 확인 및 비밀번호 재설정'
                    : 'Verify Code & Apply Reset'}
                </span>
              </button>
            </div>
          </form>

          {/* Recent Reset History */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                {language === 'ko' ? '최근 비밀번호 재설정 요청 내역' : 'Recent Password Reset Requests'}
              </span>
              <button
                type="button"
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>{language === 'ko' ? '새로고침' : 'Refresh'}</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
              {history.length === 0 ? (
                <p className="p-6 text-center text-slate-400">
                  {language === 'ko' ? '비밀번호 재설정 요청 기록이 없습니다.' : 'No password reset requests recorded yet.'}
                </p>
              ) : (
                history.map((item) => {
                  const isExpired =
                    (item.status === 'pending' || item.status === 'verified') &&
                    new Date(item.expiresAt).getTime() < Date.now();
                  const effectiveStatus = isExpired ? 'expired' : item.status;

                  return (
                    <div key={item.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                            {item.targetType}
                          </span>
                          <span className="font-bold text-slate-900">{item.targetName}</span>
                          <span className="font-mono text-slate-500 text-[11px]">{item.email}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Requested by {item.requestedBy} • {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            effectiveStatus === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : effectiveStatus === 'verified'
                              ? 'bg-blue-100 text-blue-800'
                              : effectiveStatus === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {effectiveStatus}
                        </span>

                        {(effectiveStatus === 'pending' || effectiveStatus === 'verified') && (
                          <button
                            type="button"
                            onClick={async () => {
                              await revokePasswordResetRequest(item.id);
                              await loadHistory();
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={language === 'ko' ? '코드 무효화' : 'Revoke code'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
