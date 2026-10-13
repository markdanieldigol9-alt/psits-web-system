import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  X,
  Search,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

import {
  PRIVACY_POLICY_SECTIONS,
  TERMS_AND_CONDITIONS_SECTIONS,
  PRIVACY_POLICY_LAST_UPDATED,
  TERMS_LAST_UPDATED,
} from '../content';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms',
  onAccept,
  showAcceptButton = false,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentSections =
    activeTab === 'privacy' ? PRIVACY_POLICY_SECTIONS : TERMS_AND_CONDITIONS_SECTIONS;
  const lastUpdated =
    activeTab === 'privacy' ? PRIVACY_POLICY_LAST_UPDATED : TERMS_LAST_UPDATED;

  const filteredSections = currentSections.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inTitle = sec.title.toLowerCase().includes(q);
    const inBadge = sec.badge?.toLowerCase().includes(q);
    const inParagraphs = sec.paragraphs.some((p) => p.toLowerCase().includes(q));
    const inBullets = sec.bulletPoints?.some((b) => b.toLowerCase().includes(q));
    return inTitle || inBadge || inParagraphs || inBullets;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* ── Modal Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-cyan-400">
              {activeTab === 'privacy' ? <ShieldCheck size={22} /> : <FileText size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {activeTab === 'privacy'
                  ? 'Data Privacy Policy & Protection'
                  : 'Terms & Conditions of Service'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock size={12} className="text-emerald-500" />
                  Philippine RA 10173 Protected
                </span>
                <span>•</span>
                <span>Updated: {lastUpdated}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handlePrint}
              type="button"
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-1.5"
              title="Print document"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Tabs & Search Bar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'terms'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={14} />
              Terms & Conditions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'privacy'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck size={14} />
              Privacy Policy (RA 10173)
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search clauses or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 sm:px-8">
          {/* Quick Notice Banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
            <Lock className="h-5 w-5 shrink-0 text-blue-600 dark:text-cyan-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Official Governance Standard</span>
              <p className="text-blue-800 dark:text-blue-300">
                The PSITS Web System is operated for bona fide Information Technology students,
                faculty, and affiliated institutions of Region XII SOCCSKSARGEN. Data processing is
                governed by Republic Act No. 10173 and system cybersecurity rules under Republic Act
                No. 10175.
              </p>
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              No clauses matched &quot;{searchQuery}&quot;. Please try a different search keyword.
            </div>
          ) : (
            filteredSections.map((section) => (
              <div
                key={section.id}
                id={section.id}
                className="p-5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950/40 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {section.title}
                  </h3>
                  {section.badge && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-cyan-300 border border-blue-200/60 dark:border-cyan-800/40">
                      {section.badge}
                    </span>
                  )}
                </div>

                {section.paragraphs.map((p, idx) => (
                  <p
                    key={idx}
                    className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line"
                  >
                    {p}
                  </p>
                ))}

                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <ul className="space-y-2 pt-1 pl-2">
                    {section.bulletPoints.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2 leading-relaxed"
                      >
                        <CheckCircle2
                          size={15}
                          className="text-blue-500 dark:text-cyan-400 shrink-0 mt-0.5"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.warningNote && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <span>{section.warningNote}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            <span>Official Legal Governance • PSITS Region XII</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            {showAcceptButton && onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                I Read & Agree to Terms
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
