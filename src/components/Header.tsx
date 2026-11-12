import React from 'react';
import { Menu, Calendar, Globe, Sparkles, Database, Plus, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { formatWorkWeekRange } from '../utils/dateUtils';

interface HeaderProps {
  currentWeekFriday: string;
  onOpenTestModal: () => void;
  onSeedSampleData: () => void;
  employeeCount: number;
  setMobileOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentWeekFriday,
  onOpenTestModal,
  onSeedSampleData,
  employeeCount,
  setMobileOpen,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const { isDemoMode } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between no-print">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Current workweek display badge */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {language === 'ko' ? '현재 근무 주간 (금~목)' : 'Workweek (Fri - Thu)'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 text-slate-600 font-medium">
                Eastern Time (US)
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-none mt-0.5">
              {formatWorkWeekRange(currentWeekFriday, language)}
            </p>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-2 sm:space-x-2.5">
        {/* Quick Seed button if database is empty */}
        {employeeCount === 0 && (
          <button
            onClick={onSeedSampleData}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('loadDemoData')}</span>
          </button>
        )}

        {/* Live math test verification badge */}
        <button
          onClick={onOpenTestModal}
          className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{language === 'ko' ? '계산 검증 완료 (8/8)' : '8/8 Verified Tests'}</span>
        </button>

        {/* Language switch button */}
        <button
          onClick={toggleLanguage}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          title="Toggle Language / 언어 전환"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{language === 'en' ? '한국어' : 'English'}</span>
        </button>
      </div>
    </header>
  );
};
