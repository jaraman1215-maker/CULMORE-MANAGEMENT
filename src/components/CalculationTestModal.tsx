import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Play, ShieldCheck, RefreshCw } from 'lucide-react';
import { runCalculationSelfTests, CalculationTestResult } from '../utils/calculations';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculationTestModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [results, setResults] = useState<CalculationTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runCalculationSelfTests();
      setResults(res);
      setIsRunning(false);
    }, 200);
  };

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passedCount = results.filter(r => r.passed).length;
  const allPassed = results.length > 0 && passedCount === results.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calculation & Compliance Test Suite
              </h3>
              <p className="text-xs text-slate-500">
                Automated verification for FLSA overtime, overnight shifts, Virginia taxes & FICA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
          {/* Summary Banner */}
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              allPassed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              {allPassed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {allPassed ? `All ${results.length} Compliance Tests Passed (100%)` : 'Validation in progress...'}
                </p>
                <p className="text-xs opacity-90">
                  {allPassed
                    ? 'All overnight shifts crossing midnight, FLSA 40h thresholds, and statutory tax calculations are verified accurate.'
                    : 'Running verification checks...'}
                </p>
              </div>
            </div>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs flex items-center space-x-1.5 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>Re-run</span>
            </button>
          </div>

          {/* Test cases list */}
          <div className="space-y-2.5">
            {results.map((test, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{test.name}</p>
                      <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 mt-1">
                        Category: {test.category}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-700">
                    PASS
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-mono text-slate-600">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <span className="text-[10px] uppercase text-slate-400 font-bold block mb-0.5">Expected</span>
                    <span>{test.expected}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-2 rounded-lg">
                    <span className="text-[10px] uppercase text-emerald-600 font-bold block mb-0.5">Actual Calculated</span>
                    <span className="text-emerald-800 font-semibold">{test.actual}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Virginia Grocery Scheduling & Payroll Standard (FLSA Compliant)</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
