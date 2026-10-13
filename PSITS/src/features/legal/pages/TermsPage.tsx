import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Search,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Scale,
  Lock,
} from 'lucide-react';

import { TERMS_AND_CONDITIONS_SECTIONS, TERMS_LAST_UPDATED } from '../content';
import logo from '@/assets/image/PSITS_Logo.png';

export const TermsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('acceptance');

  const filteredSections = TERMS_AND_CONDITIONS_SECTIONS.filter((sec) => {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ── Top Bar / Header ── */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logo} alt="PSITS Logo" className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-full shadow-xs" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                PSITS Region XII
              </span>
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                Terms of Service & System Governance
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <Link
              to="/privacy"
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck size={15} />
              <span className="hidden sm:inline">Privacy Policy</span>
            </Link>
            <Link
              to="/register"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Back to Register
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Banner Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-800 via-blue-900 to-slate-900 text-white p-6 sm:p-10 mb-8 sm:mb-12 shadow-xl border border-indigo-500/20">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-cyan-200">
              <Scale size={13} className="text-cyan-300" />
              <span>Binding Legal Agreement & Cybersecurity Governance</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Terms & Conditions of Service
            </h1>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
              Acceptable Use Policy, account responsibilities, payment verification guidelines,
              elections integrity, and system security rules for the PSITS Web System.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-blue-200">
              <span>Last Revised: <strong className="text-white">{TERMS_LAST_UPDATED}</strong></span>
              <span>•</span>
              <span>Jurisdiction: <strong className="text-white">Republic of the Philippines • Region XII</strong></span>
            </div>
          </div>
        </div>

        {/* Search Bar & Fast Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search terms (e.g. cybersecurity, payments, elections)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 self-end sm:self-center">
            <Lock size={15} className="text-emerald-500" />
            <span>Enforced under RA 10173 & RA 10175 (Cybercrime Act)</span>
          </div>
        </div>

        {/* Two-Column Grid: TOC + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Table of Contents (Sticky on desktop) */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-28 space-y-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
                Table of Contents
              </h4>
              <nav className="space-y-1">
                {TERMS_AND_CONDITIONS_SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => setActiveSectionId(sec.id)}
                    className={`block px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeSectionId === sec.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </div>

            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-300 space-y-2">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
                Zero-Tolerance Cybersecurity
              </span>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                Unauthorized penetration testing, scraping, tampering with votes, or falsifying payment proofs results in immediate account revocation and legal referral.
              </p>
            </div>
          </aside>

          {/* Sections List */}
          <div className="lg:col-span-3 space-y-6">
            {filteredSections.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500">
                No terms or conditions match your search query.
              </div>
            ) : (
              filteredSections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4 scroll-mt-28"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                      {sec.title}
                    </h2>
                    {sec.badge && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-cyan-300 border border-indigo-200 dark:border-indigo-800/60">
                        {sec.badge}
                      </span>
                    )}
                  </div>

                  {sec.paragraphs.map((p, pIdx) => (
                    <p
                      key={pIdx}
                      className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line"
                    >
                      {p}
                    </p>
                  ))}

                  {sec.bulletPoints && sec.bulletPoints.length > 0 && (
                    <ul className="space-y-2.5 pt-2 pl-1">
                      {sec.bulletPoints.map((b, bIdx) => (
                        <li
                          key={bIdx}
                          className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2.5 leading-relaxed"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5"
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.warningNote && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <span>{sec.warningNote}</span>
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-white dark:bg-[#070D1E] border-t border-slate-200 dark:border-slate-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="PSITS Logo" className="h-8 w-8 object-contain rounded-full shadow-xs" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              PSITS Region XII • Terms of Service & System Governance
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/privacy" className="hover:underline">Privacy Policy (RA 10173)</Link>
            <span>•</span>
            <Link to="/" className="hover:underline">Home Portal</Link>
            <span>•</span>
            <Link to="/login" className="hover:underline">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsPage;
