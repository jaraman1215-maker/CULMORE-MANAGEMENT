import React, { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, LogOut, AlertCircle, Store } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface PasscodeGateModalProps {
  expectedPasscode: string;
  onUnlock: () => void;
}

export const PasscodeGateModal: React.FC<PasscodeGateModalProps> = ({
  expectedPasscode,
  onUnlock,
}) => {
  const { language, toggleLanguage } = useLanguage();
  const { currentUser, adminProfile, isDemoMode, signOutUser } = useAuth();

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [showDigits, setShowDigits] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const verifyCode = (code: string) => {
    const validPin = /^\d{6}$/.test(expectedPasscode) ? expectedPasscode : '123456';
    if (code === validPin) {
      setErrorMsg(null);
      onUnlock();
    } else {
      setErrorMsg(
        language === 'ko'
          ? '비밀번호 6자리가 일치하지 않습니다. 다시 입력해주세요.'
          : 'Incorrect 6-digit passcode. Please try again.'
      );
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  const handleDigitChange = (idx: number, rawVal: string) => {
    const numeric = rawVal.replace(/\D/g, '');
    if (!numeric) {
      const next = [...digits];
      next[idx] = '';
      setDigits(next);
      return;
    }

    // Handle multi-digit paste
    if (numeric.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6; i++) {
        next[i] = numeric[i] || '';
      }
      setDigits(next);
      const joined = next.join('');
      if (joined.length === 6) {
        verifyCode(joined);
      } else {
        inputRefs.current[Math.min(5, numeric.length)]?.focus();
      }
      return;
    }

    const next = [...digits];
    next[idx] = numeric;
    setDigits(next);
    setErrorMsg(null);

    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    } else {
      const joined = next.join('');
      if (joined.length === 6) {
        verifyCode(joined);
      }
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = '';
      setDigits(next);
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'Enter') {
      const joined = digits.join('');
      if (joined.length === 6) {
        verifyCode(joined);
      }
    }
  };

  const handleKeypadPress = (num: string) => {
    const emptyIdx = digits.findIndex((d) => !d);
    if (emptyIdx === -1) return;
    handleDigitChange(emptyIdx, num);
  };

  const handleKeypadBackspace = () => {
    let lastIdx = -1;
    for (let i = 5; i >= 0; i--) {
      if (digits[i]) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx >= 0) {
      const next = [...digits];
      next[lastIdx] = '';
      setDigits(next);
      inputRefs.current[lastIdx]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const joined = digits.join('');
    if (joined.length !== 6) {
      setErrorMsg(
        language === 'ko'
          ? '6자리 숫자를 모두 입력해주세요.'
          : 'Please enter all 6 digits.'
      );
      return;
    }
    verifyCode(joined);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Banner */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/60">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight">MANAGEMENT OF CULMORE</h1>
              <p className="text-[11px] text-slate-400">
                {language === 'ko' ? '작업화면 보안 잠금 (6자리 PIN)' : 'Workspace Security Passcode'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleLanguage}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-emerald-400 border border-slate-700 cursor-pointer"
          >
            {language === 'ko' ? 'English' : '한국어'}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900">
              {language === 'ko' ? '6자리 비밀번호 입력' : 'Enter 6-Digit Passcode'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'ko'
                ? '작업화면(스케줄 · 급여 · 직원관리)에 들어가려면 6자리 보안 비밀번호를 입력하세요.'
                : 'Enter the 6-digit passcode to access schedules, payroll, and employee records.'}
            </p>
          </div>

          {/* 6 Digit Boxes */}
          <div className="flex items-center justify-center gap-2">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type={showDigits ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-13 text-center text-xl font-black font-mono rounded-xl border-2 transition-all focus:outline-hidden ${
                  errorMsg
                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                    : digit
                    ? 'border-emerald-500 bg-emerald-50/40 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500 focus:bg-white'
                }`}
                aria-label={`Passcode digit ${idx + 1}`}
              />
            ))}
          </div>

          {/* Show/Hide toggle */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowDigits((prev) => !prev)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
            >
              {showDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>
                {showDigits
                  ? language === 'ko'
                    ? '숫자 숨기기'
                    : 'Hide digits'
                  : language === 'ko'
                  ? '숫자 보기'
                  : 'Show digits'}
              </span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* On-screen Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeypadPress(n)}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-black font-mono text-base transition-colors cursor-pointer"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setDigits(['', '', '', '', '', '']);
                setErrorMsg(null);
                inputRefs.current[0]?.focus();
              }}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
            >
              {language === 'ko' ? '전체삭제' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-black font-mono text-base transition-colors cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              ← {language === 'ko' ? '지움' : 'Del'}
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-900/15 flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'ko' ? '작업화면 들어가기' : 'Unlock Workspace'}</span>
          </button>

          {/* Footer Account & Owner Note */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="truncate max-w-[230px]">
              <span className="font-semibold text-slate-700">
                {adminProfile?.name || currentUser?.email || (isDemoMode ? 'Demo Mode' : 'Admin')}
              </span>
              <span className="block text-[10px] text-slate-400">
                {language === 'ko'
                  ? '비밀번호 변경: jaraman1215@gmail.com 전용'
                  : 'Editable only by jaraman1215@gmail.com'}
              </span>
            </div>

            {currentUser && (
              <button
                type="button"
                onClick={() => signOutUser()}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-bold flex items-center space-x-1 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'ko' ? '로그아웃' : 'Sign Out'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
