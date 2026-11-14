import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  History,
  Store,
  DollarSign,
  Save,
  CheckCircle2,
  UserPlus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { StoreSettings, AuditLog, Administrator, AdminRole, BUSINESS_GROUPS, GroupStoreInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { PasswordResetInitialTarget } from './PasswordResetModal';

interface SettingsAndAuditViewProps {
  settings: StoreSettings;
  auditLogs: AuditLog[];
  administrators: Administrator[];
  onSaveSettings: (settings: StoreSettings) => Promise<void>;
  onUpdatePasscode?: (newPasscode: string) => Promise<void>;
  onProvisionAdmin: (emailOrId: string, role: AdminRole, name: string) => Promise<void>;
  onUpdateAdminRole: (uid: string, role: AdminRole) => Promise<void>;
  onDeleteAdmin: (uid: string) => Promise<void>;
  onOpenPasswordReset?: (target?: PasswordResetInitialTarget) => void;
}

export const SettingsAndAuditView: React.FC<SettingsAndAuditViewProps> = ({
  settings,
  auditLogs,
  administrators,
  onSaveSettings,
  onUpdatePasscode,
  onProvisionAdmin,
  onUpdateAdminRole,
  onDeleteAdmin,
  onOpenPasswordReset,
}) => {
  const { t, language } = useLanguage();
  const { isSuperAdmin, currentUser } = useAuth();
  const isJaramanOwner = (currentUser?.email || '').toLowerCase() === 'jaraman1215@gmail.com';

  const [activeTab, setActiveTab] = useState<'settings' | 'audit' | 'admins'>('settings');
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [selectedGroupSetting, setSelectedGroupSetting] = useState<string>('HQ');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 6-digit workspace passcode state (jaraman1215@gmail.com only)
  const [passcodeInput, setPasscodeInput] = useState<string>(settings.workspacePasscode || '123456');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isSavingPasscode, setIsSavingPasscode] = useState(false);
  const [passcodeMessage, setPasscodeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFormData({ ...settings });
    setPasscodeInput(settings.workspacePasscode || '123456');
  }, [settings]);

  // Invite admin form
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('admin');
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  const currentGroupInfo: GroupStoreInfo = selectedGroupSetting === 'HQ'
    ? {
        storeName: formData.storeName,
        storeNameKo: formData.storeNameKo,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        phone: formData.phone,
        ein: formData.ein,
        managerName: '',
      }
    : (formData.groupSettings && formData.groupSettings[selectedGroupSetting]) || {
        storeName: BUSINESS_GROUPS.find((g) => g.id === selectedGroupSetting)?.name || '',
        storeNameKo: BUSINESS_GROUPS.find((g) => g.id === selectedGroupSetting)?.nameKo || '',
        address: formData.address || '4210 John Marr Dr',
        city: formData.city || 'Annandale',
        state: formData.state || 'VA',
        zipCode: formData.zipCode || '22003',
        phone: formData.phone || '(703) 555-0199',
        ein: formData.ein || '54-1234567',
        managerName: '',
      };

  const handleGroupInfoChange = (field: keyof GroupStoreInfo, value: string) => {
    if (selectedGroupSetting === 'HQ') {
      setFormData((prev) => ({
        ...prev,
        [field === 'storeName'
          ? 'storeName'
          : field === 'storeNameKo'
          ? 'storeNameKo'
          : field]: value,
      }));
    } else {
      setFormData((prev) => {
        const existing = (prev.groupSettings && prev.groupSettings[selectedGroupSetting]) || {
          storeName: BUSINESS_GROUPS.find((g) => g.id === selectedGroupSetting)?.name || '',
          storeNameKo: '',
          address: prev.address || '',
          city: prev.city || '',
          state: prev.state || 'VA',
          zipCode: prev.zipCode || '',
          phone: prev.phone || '',
          ein: prev.ein || '',
          managerName: '',
        };
        return {
          ...prev,
          groupSettings: {
            ...(prev.groupSettings || {}),
            [selectedGroupSetting]: {
              ...existing,
              [field]: value,
            },
          },
        };
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    try {
      await onProvisionAdmin(newAdminEmail.trim(), newAdminRole, newAdminName.trim() || 'Admin');
      setNewAdminEmail('');
      setNewAdminName('');
      setAdminSuccess(true);
      setTimeout(() => setAdminSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('settingsTitle')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'ko'
            ? '식료품 마트 규정, 사업장 그룹별 매장 정보(주소, 전화번호, EIN), 법정 FICA 및 버지니아 주세율 설정'
            : 'Store information per business group, statutory FICA & Virginia tax configurations, admin directory.'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t('storeDetails')} & Tax</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t('auditLogTitle')} ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            activeTab === 'admins'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Administrators Directory ({administrators.length})</span>
        </button>
      </div>

      {/* TAB 1: SETTINGS FORM */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs max-w-4xl">
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('settingsSaved')}</span>
            </div>
          )}

          {/* Store Info with Business Group Selector (Item 3) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ko' ? '그룹별 매장 정보 설정 (Store Information per Group)' : 'Store Details per Business Group'}</span>
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                {language === 'ko' ? '각 그룹별로 주소, EIN, 대표전화가 급여명세서에 각각 반영됩니다.' : 'Each group stores its own address, EIN, and contact info.'}
              </span>
            </div>

            {/* Group selector tabs */}
            <div className="flex items-center space-x-1.5 p-1.5 bg-slate-100 rounded-xl overflow-x-auto mb-4 border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedGroupSetting('HQ')}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                  selectedGroupSetting === 'HQ'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                {language === 'ko' ? '본사 기본 정보 (Default)' : 'Headquarters'}
              </button>

              {BUSINESS_GROUPS.map((grp) => (
                <button
                  type="button"
                  key={grp.id}
                  onClick={() => setSelectedGroupSetting(grp.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                    selectedGroupSetting === grp.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {grp.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/60 border border-slate-200">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {selectedGroupSetting === 'HQ' ? t('storeNameInput') : `${language === 'ko' ? '해당 사업장 매장명 / 상호' : 'Group Store Name'}`} *
                </label>
                <input
                  type="text"
                  required
                  value={currentGroupInfo.storeName}
                  onChange={(e) => handleGroupInfoChange('storeName', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('storeNameKoInput')}
                </label>
                <input
                  type="text"
                  value={currentGroupInfo.storeNameKo || ''}
                  onChange={(e) => handleGroupInfoChange('storeNameKo', e.target.value)}
                  placeholder={language === 'ko' ? '예: 쿨모어 슈퍼마켓' : 'e.g. Culmore Supermarket (Korean)'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('storeAddressInput')} *
                </label>
                <input
                  type="text"
                  required
                  value={currentGroupInfo.address}
                  onChange={(e) => handleGroupInfoChange('address', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    value={currentGroupInfo.city}
                    onChange={(e) => handleGroupInfoChange('city', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">State</label>
                  <input
                    type="text"
                    value={currentGroupInfo.state}
                    onChange={(e) => handleGroupInfoChange('state', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={currentGroupInfo.zipCode}
                    onChange={(e) => handleGroupInfoChange('zipCode', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('storePhoneInput')}
                </label>
                <input
                  type="text"
                  value={currentGroupInfo.phone}
                  onChange={(e) => handleGroupInfoChange('phone', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Employer EIN (for Paystubs & Tax)
                </label>
                <input
                  type="text"
                  value={currentGroupInfo.ein}
                  onChange={(e) => handleGroupInfoChange('ein', e.target.value)}
                  placeholder="54-XXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {selectedGroupSetting !== 'HQ' && (
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'ko' ? '사업장 총괄 매니저 성명 (Branch Manager)' : 'Store Manager Name'}
                  </label>
                  <input
                    type="text"
                    value={currentGroupInfo.managerName || ''}
                    onChange={(e) => handleGroupInfoChange('managerName', e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Tax Configurations */}
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>{t('payrollTaxConfig')}</span>
            </h2>
            <p className="text-[11px] text-slate-500 mb-4">
              Social Security & Medicare rates are mandated by US federal law. Virginia withholding can be customized per your CPA recommendation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('ssRateInput')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.socialSecurityRate}
                  onChange={(e) => setFormData({ ...formData, socialSecurityRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('medRateInput')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.medicareRate}
                  onChange={(e) => setFormData({ ...formData, medicareRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('vaTaxRateInput')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.vaTaxDefaultRate}
                  onChange={(e) => setFormData({ ...formData, vaTaxDefaultRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('fedTaxRateInput')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.federalTaxDefaultRate}
                  onChange={(e) => setFormData({ ...formData, federalTaxDefaultRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('otMultiplierInput')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.overtimeMultiplier}
                  onChange={(e) => setFormData({ ...formData, overtimeMultiplier: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t('defaultBreakInput')}
                </label>
                <input
                  type="number"
                  required
                  value={formData.defaultBreakMinutes}
                  onChange={(e) => setFormData({ ...formData, defaultBreakMinutes: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : t('saveSettings')}</span>
            </button>
          </div>
        </form>
      )}

      {/* 6-Digit Workspace Security Passcode Panel (jaraman1215@gmail.com only) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {language === 'ko' ? '작업화면 진입 보안 비밀번호 (6자리 숫자)' : 'Workspace Launch Passcode (6-Digit PIN)'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {language === 'ko'
                    ? '프로그램 실행 시 작업화면 진입 전에 6자리 비밀번호를 확인합니다. 최고 관리자(jaraman1215@gmail.com)만 확인 및 수정할 수 있습니다.'
                    : 'Requires a 6-digit PIN upon launching the workspace. Strictly viewable and editable only by jaraman1215@gmail.com.'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono font-bold text-[11px] self-start sm:self-auto">
              Owner: jaraman1215@gmail.com
            </span>
          </div>

          {passcodeMessage && (
            <div
              className={`p-3 rounded-xl font-bold flex items-center space-x-2 border ${
                passcodeMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passcodeMessage.text}</span>
            </div>
          )}

          {isJaramanOwner ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 max-w-xs">
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ko' ? '새 6자리 비밀번호 (숫자 6자리)' : '6-Digit Numeric Passcode'}
                </label>
                <div className="relative">
                  <input
                    type={showPasscode ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={passcodeInput}
                    onChange={(e) => {
                      setPasscodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setPasscodeMessage(null);
                    }}
                    placeholder="123456"
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 bg-white font-mono font-black tracking-[0.35em] text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isSavingPasscode}
                onClick={async () => {
                  if (!/^\d{6}$/.test(passcodeInput)) {
                    setPasscodeMessage({
                      type: 'error',
                      text:
                        language === 'ko'
                          ? '비밀번호는 반드시 숫자 6자리여야 합니다.'
                          : 'Passcode must be exactly 6 numeric digits.',
                    });
                    return;
                  }
                  if (!onUpdatePasscode) return;
                  try {
                    setIsSavingPasscode(true);
                    await onUpdatePasscode(passcodeInput);
                    setPasscodeMessage({
                      type: 'success',
                      text:
                        language === 'ko'
                          ? '6자리 보안 비밀번호가 저장되었습니다. 모든 기기에 즉시 동기화됩니다.'
                          : '6-digit workspace passcode updated and synced across devices.',
                    });
                  } catch (err) {
                    setPasscodeMessage({
                      type: 'error',
                      text: err instanceof Error ? err.message : 'Failed to update passcode.',
                    });
                  } finally {
                    setIsSavingPasscode(false);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>
                  {isSavingPasscode
                    ? language === 'ko'
                      ? '저장 중...'
                      : 'Saving...'
                    : language === 'ko'
                    ? '6자리 비밀번호 변경 저장'
                    : 'Save 6-Digit Passcode'}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">
                  {language === 'ko' ? '비밀번호 수정 권한 제한됨' : 'Restricted Security Setting'}
                </p>
                <p className="text-[11px] text-amber-800">
                  {language === 'ko'
                    ? '6자리 작업화면 비밀번호는 jaraman1215@gmail.com 계정으로 로그인한 관리자만 확인 및 수정할 수 있습니다.'
                    : 'Only the primary administrator signed in as jaraman1215@gmail.com can view or modify this 6-digit passcode.'}
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 font-mono font-bold text-slate-500 tracking-widest shrink-0">
                ••••••
              </span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('auditLogTitle')}</h2>
              <p className="text-[11px] text-slate-500">{t('auditLogDesc')}</p>
            </div>
            <span className="font-mono text-xs text-slate-500 font-bold">
              {auditLogs.length} events logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">{t('auditTime')}</th>
                  <th className="py-2.5 px-3">{t('auditAction')}</th>
                  <th className="py-2.5 px-3">{t('auditEntity')}</th>
                  <th className="py-2.5 px-3">{t('auditAdmin')}</th>
                  <th className="py-2.5 px-4">{t('auditDetails')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                      {log.timestamp?.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">
                      {log.entity} ({log.entityId})
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-44">
                      {log.performedByEmail}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-800">
                      {log.details}
                    </td>
                  </tr>
                ))}

                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No audit events recorded yet. Actions like payroll finalization, adjustments, and wage edits will log here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ADMINISTRATORS DIRECTORY */}
      {activeTab === 'admins' && (
        <div className="space-y-6 max-w-4xl">
          {/* Add Admin Section (Super Admin only) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Provision Authorized Store Administrator</span>
            </h2>
            <p className="text-[11px] text-slate-500 mb-4">
              Add a co-manager or store director. Only accounts listed in the administrators directory or matching the bootstrap owner can sign in.
            </p>

            {adminSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Administrator credentials provisioned successfully.</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('loginIdLabel')} *</label>
                <input
                  type="text"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder={t('loginIdPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('adminNameLabel')}</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Su-Jin Chae"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('adminRoleLabel')}</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-bold"
                >
                  {isSuperAdmin && <option value="super_admin">{t('superAdminBadge')}</option>}
                  <option value="admin">{t('adminBadge')}</option>
                  <option value="manager">{t('managerBadge')}</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs transition-colors"
                >
                  {language === 'ko' ? '관리자 사전 등록' : 'Provision Admin'}
                </button>
              </div>
            </form>
          </div>

          {/* List of Authorized Administrators */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-900 text-sm">
              {language === 'ko' ? '등록된 관리자 목록' : 'Current Authorized Administrators'}
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {administrators.map((admin) => {
                const isSelf = currentUser?.uid === admin.uid;
                return (
                  <div key={admin.uid || admin.email} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        {admin.name ? admin.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {admin.name || 'Store Admin'}
                          {isSelf && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                              {language === 'ko' ? '내 계정' : 'You'}
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {admin.loginId ? `ID: ${admin.loginId}` : admin.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isSuperAdmin && !isSelf ? (
                        <select
                          value={admin.role}
                          onChange={(e) => onUpdateAdminRole(admin.uid, e.target.value as AdminRole)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase border cursor-pointer ${
                            admin.role === 'super_admin'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : admin.role === 'admin'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          <option value="super_admin">{t('superAdminBadge')}</option>
                          <option value="admin">{t('adminBadge')}</option>
                          <option value="manager">{t('managerBadge')}</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            admin.role === 'super_admin'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : admin.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {admin.role.replace('_', ' ')}
                        </span>
                      )}

                      {onOpenPasswordReset && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPasswordReset({
                              type: 'admin',
                              idOrEmail: admin.uid || admin.email,
                            })
                          }
                          title={language === 'ko' ? '임시 인증 코드로 비밀번호 재설정' : 'Reset password via temporary verification code'}
                          className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>{language === 'ko' ? '비밀번호 재설정' : 'Reset PW'}</span>
                        </button>
                      )}

                      {isSuperAdmin && !isSelf && (
                        confirmDeleteUid === admin.uid ? (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteAdmin(admin.uid);
                                setConfirmDeleteUid(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px]"
                            >
                              {language === 'ko' ? '확인' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUid(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]"
                            >
                              {t('cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUid(admin.uid)}
                            title={language === 'ko' ? '관리자 삭제' : 'Remove Admin'}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
