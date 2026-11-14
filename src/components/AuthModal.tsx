import React, { useState, useEffect } from 'react';
import {
  Store,
  Sparkles,
  AlertTriangle,
  LogOut,
  UserCheck,
  UserPlus,
  LogIn,
  Cloud,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AdminRole } from '../types';

export const AuthModal: React.FC = () => {
  const {
    currentUser,
    adminProfile,
    isAdmin,
    isLoading,
    signInWithGoogle,
    signInWithIdPassword,
    signUpWithIdPassword,
    signOutUser,
    provisionCurrentAsSuperAdmin,
    sendSelfPasswordResetEmail,
    completePasswordReset,
    toggleDemoMode,
    authError,
    clearAuthError,
  } = useAuth();
  const { t, language } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot Password / Reset Code completion states
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetOobCode, setResetOobCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const [isProvisioning, setIsProvisioning] = useState(false);

  // Detect ?mode=resetPassword&oobCode=... from Firebase Password Reset Email link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const oob = params.get('oobCode');
    if (urlMode === 'resetPassword' && oob) {
      setMode('forgot');
      setResetEmailSent(true);
      setResetOobCode(oob);
    }
  }, []);

  const handleClaimSuperAdmin = async () => {
    try {
      setIsProvisioning(true);
      await provisionCurrentAsSuperAdmin();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSwitchMode = (nextMode: 'signin' | 'signup' | 'forgot') => {
    setMode(nextMode);
    setLocalError(null);
    setLocalSuccess(null);
    clearAuthError();
  };

  const handleSendForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);
    clearAuthError();
    if (!loginId.trim()) {
      setLocalError(language === 'ko' ? '등록된 이메일을 입력해주세요.' : 'Please enter your registered email.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await sendSelfPasswordResetEmail(loginId);
      setLocalSuccess(res.message);
      if (res.sent) setResetEmailSent(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSelfReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalSuccess(null);
    if (!resetOobCode.trim()) {
      setLocalError(
        language === 'ko'
          ? '이메일로 받은 재설정 코드(oobCode)를 입력해주세요.'
          : 'Please enter the reset verification code from your email.'
      );
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setLocalError(
        language === 'ko'
          ? '새 비밀번호는 최소 6자 이상이어야 합니다.'
          : 'New password must be at least 6 characters.'
      );
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setLocalError(
        language === 'ko'
          ? '새 비밀번호와 확인이 일치하지 않습니다.'
          : 'Passwords do not match.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await completePasswordReset({
        emailOrId: loginId || 'user@culmore.local',
        firebaseOobCode: resetOobCode.trim(),
        newPassword: resetNewPassword,
      });
      setLocalSuccess(res.message);
      setResetOobCode('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setMode('signin');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!loginId.trim()) {
      setLocalError(language === 'ko' ? 'ID 또는 이메일을 입력해주세요.' : 'Please enter your ID or email.');
      return;
    }
    if (!password || password.length < 6) {
      setLocalError(language === 'ko' ? '비밀번호는 6자 이상 입력해주세요.' : 'Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setLocalError(language === 'ko' ? '관리자 성명을 입력해주세요.' : 'Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError(language === 'ko' ? '비밀번호 확인이 일치하지 않습니다.' : 'Passwords do not match.');
        return;
      }
    }

    try {
      setSubmitting(true);
      if (mode === 'signin') {
        await signInWithIdPassword(loginId, password);
      } else {
        await signUpWithIdPassword(loginId, password, fullName, role);
      }
    } catch {
      // authError is already set by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-300">Loading MANAGEMENT OF CULMORE Security Context...</p>
        </div>
      </div>
    );
  }

  const displayError = localError || authError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-4">
        {/* Brand Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto text-white shadow-xl shadow-emerald-900/40 mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black tracking-tight">MANAGEMENT OF CULMORE</h1>
          <p className="text-xs text-emerald-400 font-semibold mt-0.5">
            Fairfax & Annandale, Virginia
          </p>
          <p className="text-xs text-slate-300 mt-2">
            {t('adminLoginDesc')}
          </p>
          <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
            <Cloud className="w-3.5 h-3.5" />
            <span>{t('cloudSyncActive')}</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs">
          {displayError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{displayError}</span>
            </div>
          )}

          {localSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{localSuccess}</span>
            </div>
          )}

          {!currentUser ? (
            <div className="space-y-4">
              {mode === 'forgot' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-amber-600" />
                      <h2 className="font-black text-slate-900 text-xs">
                        {language === 'ko' ? '비밀번호 재설정 (이메일 인증 코드)' : 'Reset Password via Email Code'}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signin')}
                      className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>{language === 'ko' ? '로그인으로 돌아가기' : 'Back to Sign In'}</span>
                    </button>
                  </div>

                  <form onSubmit={handleSendForgotEmail} className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {language === 'ko' ? '등록된 이메일 주소 *' : 'Registered Email Address *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center justify-center space-x-2 transition-colors text-xs cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {language === 'ko' ? '이메일로 재설정 코드/링크 받기' : 'Send Reset Code / Email'}
                      </span>
                    </button>
                  </form>

                  <form onSubmit={handleCompleteSelfReset} className="space-y-2.5 border-t border-slate-200 pt-3">
                    <p className="text-[11px] font-bold text-slate-600">
                      {resetEmailSent
                        ? language === 'ko'
                          ? '이메일로 받은 인증 코드(oobCode)와 새 비밀번호를 입력하세요:'
                          : 'Enter your emailed action code (oobCode) and new password:'
                        : language === 'ko'
                        ? '이미 이메일 재설정 코드를 받으셨다면 아래에 입력하세요:'
                        : 'Already have a reset verification code? Apply it below:'}
                    </p>
                    <input
                      type="text"
                      value={resetOobCode}
                      onChange={(e) => setResetOobCode(e.target.value)}
                      placeholder={language === 'ko' ? '이메일 재설정 코드 (oobCode)' : 'Email reset code (oobCode)'}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder={language === 'ko' ? '새 비밀번호 (6자+)' : 'New password (6+)'}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                      <input
                        type="password"
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        placeholder={language === 'ko' ? '비밀번호 확인' : 'Confirm password'}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold flex items-center justify-center space-x-2 transition-colors text-xs cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{language === 'ko' ? '새 비밀번호 적용하기' : 'Apply New Password'}</span>
                    </button>
                  </form>
                </div>
              ) : (
                <>
              {/* Sign In / Sign Up Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className={`py-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    mode === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t('signInTab')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className={`py-2 rounded-lg font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    mode === 'signup'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('signUpTab')}</span>
                </button>
              </div>

              {/* ID / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('loginIdLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={t('loginIdPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>

                {mode === 'signup' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('adminNameLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={language === 'ko' ? '예: 김관리' : 'e.g. Store Manager'}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {t('adminRoleLabel')}
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as AdminRole)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
                      >
                        <option value="super_admin">{t('superAdminBadge')}</option>
                        <option value="admin">{t('adminBadge')}</option>
                        <option value="manager">{t('managerBadge')}</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      {t('passwordLabel')}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => handleSwitchMode('forgot')}
                        className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {language === 'ko' ? '비밀번호를 잊으셨나요?' : 'Forgot password?'}
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>

                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('confirmPasswordLabel')}
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-colors text-xs"
                >
                  {mode === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  <span>
                    {submitting
                      ? language === 'ko'
                        ? '처리 중...'
                        : 'Processing...'
                      : mode === 'signin'
                      ? t('signInWithIdPassword')
                      : t('createAdminAccount')}
                  </span>
                </button>
              </form>
                </>
              )}

              <div className="relative my-3 text-center">
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10">
                  {language === 'ko' ? '또는' : 'OR'}
                </span>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm flex items-center justify-center space-x-2.5 transition-all text-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{t('signInWithGoogle')}</span>
              </button>

              {/* Demo Mode Button (Explicitly secondary, local only) */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleDemoMode(true)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold border border-slate-200 flex items-center justify-center space-x-2 transition-colors text-[11px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('switchToDemo')}</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  {t('localDemoOnly')}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signed-in user info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Signed In Account</span>
                <p className="font-bold text-slate-900">{currentUser.displayName || adminProfile?.name || 'Admin User'}</p>
                <p className="font-mono text-slate-600 text-[11px]">{adminProfile?.loginId || currentUser.email}</p>
              </div>

              {/* Check if user is recognized admin or needs bootstrap claim */}
              {currentUser.email === 'jaraman1215@gmail.com' && !adminProfile ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-900">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-xs">{t('provisionFirstAdmin')}</h3>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {t('provisionFirstAdminDesc')}
                  </p>
                  <button
                    onClick={handleClaimSuperAdmin}
                    disabled={isProvisioning}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {isProvisioning ? 'Provisioning...' : t('claimSuperAdmin')}
                  </button>
                </div>
              ) : !isAdmin ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-amber-900">
                  <h3 className="font-bold text-xs">{t('unauthorizedTitle')}</h3>
                  <p className="text-[11px] leading-relaxed">
                    {t('unauthorizedDesc')}
                  </p>
                  <button
                    onClick={() => toggleDemoMode(true)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                  >
                    {t('switchToDemo')}
                  </button>
                </div>
              ) : null}

              <button
                onClick={() => signOutUser()}
                className="w-full py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs flex items-center justify-center space-x-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('signOut')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Protected by Cloud Firestore Rules</span>
          <span className="font-mono">v1.0 • VA FLSA</span>
        </div>
      </div>
    </div>
  );
};
