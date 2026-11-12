import React from 'react';
import {
  ShieldCheck,
  Calendar,
  DollarSign,
  Database,
  Lock,
  Moon,
  FileSpreadsheet,
  AlertTriangle,
  Terminal,
  BookOpen,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const AdminManualView: React.FC = () => {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center space-x-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('adminManualTitle')}
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'ko'
            ? 'Firebase 보안 규칙, 관리자 권한 부여, 금~목 근무 주기, 야간조 시간 계산, 버지니아 세법 및 데이터 백업 지침서'
            : 'Standard operating manual for zero-trust Firestore security, retail scheduling cycles, FLSA overtime, and disaster recovery.'}
        </p>
      </div>

      {/* Section 1: Zero-Trust Security & Admin Provisioning */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs text-slate-700 leading-relaxed">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">
            {t('securityRulesExplained')}
          </h2>
        </div>

        <p>
          {language === 'ko'
            ? '본 애플리케이션은 단순 프론트엔드 UI 차단에 의존하지 않고, Cloud Firestore Security Rules 엔진 수준에서 미인증 사용자의 접근을 원천 차단합니다. 허가받지 않은 사용자가 클라이언트 앱을 우회하여 REST/gRPC 요청을 시도해도 데이터베이스가 직접 권한을 검증합니다.'
            : 'This application implements Attribute-Based Access Control (ABAC) in firestore.rules. Unauthenticated callers are strictly blocked at the Google Cloud data tier regardless of client requests.'}
        </p>

        <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] space-y-1">
          <p className="text-emerald-400 font-bold">// Hardened Firestore Rule excerpt:</p>
          <p>match /databases/&#123;database&#125;/documents &#123;</p>
          <p className="pl-4">match /&#123;document=**&#125; &#123; allow read, write: if false; &#125;</p>
          <p className="pl-4">function isAdmin() &#123;</p>
          <p className="pl-8">return isSignedIn() &amp;&amp; (</p>
          <p className="pl-12">request.auth.token.email == 'jaraman1215@gmail.com' ||</p>
          <p className="pl-12">exists(/databases/$(database)/documents/administrators/$(request.auth.uid))</p>
          <p className="pl-8">);</p>
          <p className="pl-4">&#125;</p>
          <p>&#125;</p>
        </div>

        <div className="space-y-1.5 pt-1">
          <p className="font-bold text-slate-900">{language === 'ko' ? '최초 관리자 생성 절차 (Initial Setup Flow):' : 'Initial Admin Provisioning Procedure:'}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('securityRulesBullet1')}</li>
            <li>{t('securityRulesBullet2')}</li>
            <li>{t('securityRulesBullet3')}</li>
            <li>
              {language === 'ko'
                ? '슈퍼 관리자는 [매장 설정 및 감사 로그] &gt; [Administrators Directory]에서 다른 점장이나 매니저 이메일을 등록하여 관리 권한을 안전하게 위임할 수 있습니다.'
                : 'Super Admins can authorize additional store directors in the Administrators Directory tab.'}
            </li>
          </ul>
        </div>
      </div>

      {/* Section 2: Retail Grocery Workweek & Overnight Shifts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs text-slate-700 leading-relaxed">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">
            {t('workweekExplained')}
          </h2>
        </div>

        <p>
          {language === 'ko'
            ? '미국 식료품 마트 업계에서는 주말 대량 신선식품(청과, 정육, 수산) 입고와 금·토·일 장보기 피크 타임에 맞춰 근무 주간을 금요일 오전 0시부터 익주 목요일 오후 11시 59분까지 7일 주기로 운영하는 것이 표준적입니다.'
            : 'In grocery retail, scheduling runs Friday morning through Thursday night to align with wholesale shipment schedules and weekend customer traffic.'}
        </p>

        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-2">
          <div className="flex items-center space-x-2 font-bold">
            <Moon className="w-4 h-4 text-indigo-700" />
            <span>{language === 'ko' ? '자정 통과 야간조 (Overnight Shifts) 계산 원리' : 'Overnight Shift Calculation Logic'}</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {language === 'ko'
              ? '야간 진열조(Night Stocker)의 22:00 ~ 06:00 근무처럼 퇴근 시간이 출근 시간보다 숫자가 작을 경우, 시스템은 자정을 통과한 것으로 판별하여 (24:00 - 22:00) + 06:00 = 8.0시간을 도출하고, 지정된 무급 휴게시간(예: 30분)을 공제하여 실 근무시간 7.50시간을 산출합니다.'
              : 'Shifts where end time is numerically less than start time (e.g. 22:00 to 06:00) are recognized as overnight shifts: (24h - start) + end minus unpaid meal break (e.g. 8h - 30m = 7.5h net).'}
          </p>
        </div>
      </div>

      {/* Section 3: FLSA Overtime & Virginia Payroll Compliance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs text-slate-700 leading-relaxed">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">
            FLSA Overtime & Virginia State Tax Compliance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h3 className="font-bold text-slate-900">FLSA 40-Hour Rule:</h3>
            <p className="text-[11px] text-slate-600">
              Under federal FLSA, non-exempt grocery employees must receive 1.5 times their regular hourly rate for all hours worked exceeding 40 in a single Friday-Thursday workweek. Daily overtime does not apply in Virginia unless specified in an employment contract.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h3 className="font-bold text-slate-900">FICA & Virginia Tax Mandates:</h3>
            <p className="text-[11px] text-slate-600">
              Social Security (6.20%) and Medicare (1.45%) are mandatory federal statutory withholdings. Virginia state withholding is configured at standard 5.0% by default, and can be customized to match individual employee Form VA-4 exemptions.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
          <p className="font-bold flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Audit Trail & Finalized Period Protection:</span>
          </p>
          <p className="text-[11px]">
            {language === 'ko'
              ? '확정(Finalized)된 급여는 실수나 무단 조작을 방지하기 위해 잠금됩니다. 잠금 해제나 임의 조정이 발생할 경우 작업자의 이메일, 발생 일시, 구체적 사유가 영구 감사 로그에 기록됩니다.'
              : 'Finalized pay periods are locked against modification. Unlocking or manual adjustments require explicit justification and log immutable records in the Audit Trail.'}
          </p>
        </div>
      </div>

      {/* Section 4: Backup, Archival & Disaster Recovery */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs text-slate-700 leading-relaxed">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">
            {t('backupInstructions')}
          </h2>
        </div>

        <ul className="list-disc pl-5 space-y-1.5">
          <li>{t('backupBullet1')}</li>
          <li>{t('backupBullet2')}</li>
          <li>
            {language === 'ko'
              ? '직원이 퇴사(비활성화) 처리되어도 과거의 스케줄과 급여명세서 데이터는 삭제되지 않고 영구 보존되어 연말 W-2 발송 및 세무 감사에 대비할 수 있습니다.'
              : 'Archiving inactive staff retains all past payroll and schedule history permanently for annual W-2 and tax compliance.'}
          </li>
        </ul>
      </div>
    </div>
  );
};
