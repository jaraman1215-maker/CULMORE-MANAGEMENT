import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Store,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const AuthModal: React.FC = () => {
  const {
    currentUser,
    adminProfile,
    isAdmin,
    isLoading,
    signInWithGoogle,
    signOutUser,
    provisionCurrentAsSuperAdmin,
    toggleDemoMode,
    authError,
  } = useAuth();
  const { t, language } = useLanguage();

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState(false);

  const handleClaimSuperAdmin = async () => {
    try {
      setIsProvisioning(true);
      await provisionCurrentAsSuperAdmin();
      setProvisionSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProvisioning(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
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
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs">
          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {!currentUser ? (
            <div className="space-y-3">
              <button
                onClick={() => signInWithGoogle()}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md shadow-slate-900/20 flex items-center justify-center space-x-2.5 transition-all text-xs"
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

              <div className="relative my-4 text-center">
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider relative z-10">
                  {language === 'ko' ? '또는' : 'OR'}
                </span>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
              </div>

              {/* Demo Mode Button */}
              <button
                onClick={() => toggleDemoMode(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center justify-center space-x-2 transition-colors text-xs"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{t('switchToDemo')}</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center leading-normal">
                {t('demoModeBanner')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signed-in user info */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Signed In Account</span>
                <p className="font-bold text-slate-900">{currentUser.displayName || 'Google User'}</p>
                <p className="font-mono text-slate-600 text-[11px]">{currentUser.email}</p>
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
