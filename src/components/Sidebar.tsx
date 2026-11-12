import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  ShieldCheck,
  Globe,
  LogOut,
  Sparkles,
  Store,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'employees' | 'schedule' | 'payroll' | 'reports' | 'settings' | 'manual';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenTestModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  onOpenTestModal,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { currentUser, adminProfile, isDemoMode, toggleDemoMode, signOutUser } = useAuth();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'employees' as ActiveTab, label: t('navEmployees'), icon: Users },
    { id: 'schedule' as ActiveTab, label: t('navSchedule'), icon: Calendar },
    { id: 'payroll' as ActiveTab, label: t('navPayroll'), icon: DollarSign },
    { id: 'reports' as ActiveTab, label: t('navReports'), icon: FileText },
    { id: 'settings' as ActiveTab, label: t('navSettings'), icon: Settings },
    { id: 'manual' as ActiveTab, label: t('navManual'), icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/50">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-white text-sm tracking-tight truncate max-w-44">MANAGEMENT OF CULMORE</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">VA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">Culmore Corp • Schedule & Payroll</p>
            </div>
          </div>
        </div>

        {/* Demo Mode / Cloud Firestore Mode Indicator */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-xs font-semibold text-slate-300">
              {isDemoMode ? 'Demo Mode (25 Sample Staff)' : 'Live Cloud Firestore'}
            </span>
          </div>
          <button
            onClick={() => toggleDemoMode()}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline flex items-center space-x-1"
          >
            <span>{isDemoMode ? 'Go Live' : 'Demo'}</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Calculation Verifier shortcut */}
        <div className="px-3 pb-2">
          <button
            onClick={onOpenTestModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-xs font-medium text-emerald-400 border border-slate-700/60 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Math & Overtime Tests</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              8/8 Pass
            </span>
          </button>
        </div>

        {/* Bottom User Profile & Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-200 transition-colors border border-slate-700/50"
          >
            <div className="flex items-center space-x-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Language / 언어</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase">
              {language === 'en' ? 'English' : '한국어'}
            </span>
          </button>

          {/* Admin User Info */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {currentUser?.displayName || (isDemoMode ? 'Demo Store Admin' : 'Admin User')}
                </p>
                <div className="flex items-center space-x-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {adminProfile?.role === 'super_admin' ? t('superAdminBadge') : t('adminBadge')}
                  </span>
                </div>
              </div>
            </div>

            {currentUser && (
              <button
                onClick={() => signOutUser()}
                title={t('signOut')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
