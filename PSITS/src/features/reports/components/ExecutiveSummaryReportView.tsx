import React, { useMemo } from 'react';
import logo from '@/assets/image/PSITS_Logo.png';
import {
  Users,
  Wallet,
  CalendarCheck2,
  Briefcase,
  TrendingUp,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { exportToCSV } from '@/shared/utils/export';

export interface ExecutiveSummaryProps {
  summary?: {
    totalMembers?: number;
    activeMembers?: number;
    pendingApprovals?: number;
    psitsMembers?: number;
    institutionMembers?: number;
    activePsitsMembers?: number;
    activeInstitutionMembers?: number;
    pendingPsitsMembers?: number;
    pendingInstitutionMembers?: number;
    activeEvents?: number;
    totalRevenue?: number;
    grossCollections?: number;
    pendingCollections?: number;
    remainingReceivables?: number;
  };
  memberGrowth?: { month: string; members: number; active: number }[];
  revenueByMethod?: { name: string; value: number }[];
  allMembers?: any[];
  institutionsList?: string[];
  eventReportData?: {
    events?: any[];
    participants?: any[];
    institutions?: string[];
    summary?: any;
  } | null;
  partnerReportData?: {
    contributions?: any[];
    totalValue?: number;
  } | null;
  dateRangeFilter?: string;
  startDateFilter?: string;
  endDateFilter?: string;
  preparedBy?: string;
  userRole?: string;
  onExportCSV?: () => void;
}

export const ExecutiveSummaryReportView: React.FC<ExecutiveSummaryProps> = ({
  summary = {},
  memberGrowth = [],
  revenueByMethod = [],
  allMembers = [],
  institutionsList = [],
  eventReportData = null,
  partnerReportData = null,
  dateRangeFilter = 'all',
  startDateFilter = '',
  endDateFilter = '',
  preparedBy = 'Administrator',
  userRole = 'Officer',
  onExportCSV,
}) => {
  // Compute membership breakdown
  const membershipMetrics = useMemo(() => {
    const totalFromAll = allMembers.length;
    let individualCount = 0;
    let institutionCount = 0;
    let industryCount = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    if (totalFromAll > 0) {
      allMembers.forEach((m) => {
        const cat = String(m.category || m.memberType || '').toLowerCase();
        if (cat === 'industry') industryCount += 1;
        else if (cat === 'institution') institutionCount += 1;
        else individualCount += 1;

        const st = String(m.status || '').toLowerCase();
        if (st === 'active' || st === 'approved') approvedCount += 1;
        else if (st === 'pending') pendingCount += 1;
      });
    } else {
      individualCount = summary.psitsMembers ?? 0;
      institutionCount = summary.institutionMembers ?? 0;
      approvedCount = summary.activeMembers ?? (summary.activePsitsMembers ?? 0) + (summary.activeInstitutionMembers ?? 0);
      pendingCount = summary.pendingApprovals ?? (summary.pendingPsitsMembers ?? 0) + (summary.pendingInstitutionMembers ?? 0);
    }

    const totalCount = summary.totalMembers ?? (individualCount + institutionCount + industryCount);
    const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;
    const recentRegistrations = memberGrowth.reduce((acc, row) => acc + (row.members || 0), 0);

    return {
      totalCount,
      individualCount,
      institutionCount,
      industryCount,
      approvedCount,
      pendingCount,
      approvalRate,
      recentRegistrations,
      institutionsRepresented: institutionsList.length,
    };
  }, [allMembers, summary, institutionsList, memberGrowth]);

  // Compute event metrics
  const eventMetrics = useMemo(() => {
    const events = eventReportData?.events || [];
    const participants = eventReportData?.participants || [];
    const totalEvents = events.length || summary.activeEvents || 0;
    const totalParticipants = participants.length;
    const checkedInCount = participants.filter((p: any) => p.is_checked_in === true || p.is_checked_in === 1 || String(p.is_checked_in) === 'true').length;
    const checkInRate = totalParticipants > 0 ? Math.round((checkedInCount / totalParticipants) * 100) : 0;

    return {
      totalEvents,
      totalParticipants,
      checkedInCount,
      checkInRate,
    };
  }, [eventReportData, summary.activeEvents]);

  // Compute financial metrics
  const financialMetrics = useMemo(() => {
    const verifiedRevenue = summary.totalRevenue ?? 0;
    const grossCollections = summary.grossCollections ?? verifiedRevenue;
    const pendingCollections = summary.pendingCollections ?? 0;
    const receivables = summary.remainingReceivables ?? 0;

    return {
      verifiedRevenue,
      grossCollections,
      pendingCollections,
      receivables,
    };
  }, [summary]);

  // Compute partnership metrics
  const partnerMetrics = useMemo(() => {
    const totalValue = partnerReportData?.totalValue ?? 0;
    const dealsCount = partnerReportData?.contributions?.length ?? 0;
    const uniquePartners = new Set((partnerReportData?.contributions || []).map((c: any) => c.partner_name)).size;

    return {
      totalValue,
      dealsCount,
      uniquePartners,
    };
  }, [partnerReportData]);

  // Format date range label
  const dateRangeLabel = useMemo(() => {
    switch (dateRangeFilter) {
      case 'this_month':
        return 'Current Month';
      case 'last_30_days':
        return 'Last 30 Days';
      case 'this_quarter':
        return 'Current Quarter';
      case 'this_year':
        return 'Fiscal Year-to-Date (YTD)';
      case 'custom':
        return startDateFilter && endDateFilter ? `${startDateFilter} to ${endDateFilter}` : 'Custom Date Range';
      default:
        return 'All Time (Cumulative)';
    }
  }, [dateRangeFilter, startDateFilter, endDateFilter]);

  const handleExportDefault = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }

    const dataToExport = [
      { Category: 'Executive Overview', Indicator: 'Reporting Organization', Value: 'PSITS Regional Organization', Status: 'Official' },
      { Category: 'Executive Overview', Indicator: 'Reporting Period', Value: dateRangeLabel, Status: 'Verified' },
      { Category: 'Executive Overview', Indicator: 'Generated Timestamp', Value: new Date().toLocaleString(), Status: 'Certified' },
      { Category: 'Executive Overview', Indicator: 'Prepared By', Value: preparedBy, Status: userRole },
      { Category: 'Membership', Indicator: 'Total Registered Members', Value: membershipMetrics.totalCount, Status: 'Recorded' },
      { Category: 'Membership', Indicator: 'Approved / Active Members', Value: membershipMetrics.approvedCount, Status: `${membershipMetrics.approvalRate}% rate` },
      { Category: 'Membership', Indicator: 'Pending Approvals Queue', Value: membershipMetrics.pendingCount, Status: 'Pending Action' },
      { Category: 'Membership', Indicator: 'Individual Members (PSITS)', Value: membershipMetrics.individualCount, Status: 'Active' },
      { Category: 'Membership', Indicator: 'Institution Roster Delegates', Value: membershipMetrics.institutionCount, Status: 'Delegated' },
      { Category: 'Membership', Indicator: 'Industry Members', Value: membershipMetrics.industryCount, Status: 'Corporate' },
      { Category: 'Membership', Indicator: 'Affiliated Educational Institutions', Value: membershipMetrics.institutionsRepresented, Status: 'Network' },
      { Category: 'Financial Treasury', Indicator: 'Total Verified Revenue (PHP)', Value: financialMetrics.verifiedRevenue.toFixed(2), Status: 'Verified' },
      { Category: 'Financial Treasury', Indicator: 'Gross Collections Billed (PHP)', Value: financialMetrics.grossCollections.toFixed(2), Status: 'Recorded' },
      { Category: 'Financial Treasury', Indicator: 'Pending Verification Collections (PHP)', Value: financialMetrics.pendingCollections.toFixed(2), Status: 'Under Audit' },
      { Category: 'Financial Treasury', Indicator: 'Outstanding Receivables (PHP)', Value: financialMetrics.receivables.toFixed(2), Status: 'Receivable' },
      { Category: 'Events & Engagement', Indicator: 'Total Events Programmed', Value: eventMetrics.totalEvents, Status: 'Active / Completed' },
      { Category: 'Events & Engagement', Indicator: 'Total Event Participants', Value: eventMetrics.totalParticipants, Status: 'Enrolled' },
      { Category: 'Events & Engagement', Indicator: 'Physical Check-ins (Attendance)', Value: eventMetrics.checkedInCount, Status: `${eventMetrics.checkInRate}% turnout` },
      { Category: 'Strategic Alliances', Indicator: 'Total Sponsorship Value (PHP)', Value: partnerMetrics.totalValue.toFixed(2), Status: 'Secured' },
      { Category: 'Strategic Alliances', Indicator: 'Total Executed Deals', Value: partnerMetrics.dealsCount, Status: 'Active' },
    ];

    exportToCSV(`PSITS_Executive_Summary_Report_${new Date().toISOString().slice(0, 10)}`, dataToExport);
  };

  return (
    <div className="space-y-6 text-gray-900">
      {/* Official Letterhead Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-primary/90 pb-5">
        <div className="flex items-center gap-3.5">
          <img src={logo} alt="PSITS Logo" className="h-14 w-14 object-contain shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                PSITS REGIONAL ORGANIZATION
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wide border border-blue-200">
                Official
              </span>
            </div>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mt-0.5">
              Official Executive & Operations Master Report
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-gray-600 space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-200 shrink-0 w-full sm:w-auto">
          <p>
            <strong className="text-gray-900">Document:</strong> Executive Summary
          </p>
          <p>
            <strong className="text-gray-900">Reporting Scope:</strong> {dateRangeLabel}
          </p>
          <p>
            <strong className="text-gray-900">Generated Date:</strong> {new Date().toLocaleString()}
          </p>
          <p>
            <strong className="text-gray-900">Prepared By:</strong> {preparedBy} ({userRole})
          </p>
        </div>
      </div>

      {/* Executive Scope Narrative Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5">
          <ShieldCheck size={20} />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="text-sm font-bold text-gray-900">
            Consolidated Organizational Standing & Governance Overview
          </h4>
          <p className="text-gray-600 leading-relaxed">
            This executive report presents certified operational intelligence for PSITS Regional Organization. It
            synthesizes real-time metrics across individual and institutional membership registries, verified treasury collections, regional summits and competitions turnout, and corporate sponsorship portfolios.
          </p>
        </div>
      </div>

      {/* 4 CORE EXECUTIVE PILLARS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Membership Strength */}
        <div className="bg-white border-2 border-blue-100 rounded-xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/60 rounded-bl-full pointer-events-none -z-0" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-primary" /> Total Membership
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {membershipMetrics.approvalRate}% Approved
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary">{membershipMetrics.totalCount}</span>
              <span className="text-xs text-gray-500 font-medium">registered</span>
            </div>
            <div className="pt-2 border-t border-gray-100 text-[11px] space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Individual PSITS:</span>
                <strong className="text-gray-900">{membershipMetrics.individualCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Institution Roster:</span>
                <strong className="text-gray-900">{membershipMetrics.institutionCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Pending Approvals:</span>
                <span className="text-amber-700 font-bold">{membershipMetrics.pendingCount}</span>
              </div>
              {membershipMetrics.recentRegistrations > 0 && (
                <div className="flex justify-between text-blue-700 font-semibold pt-1 border-t border-dashed border-gray-100">
                  <span>6-Mo Signups:</span>
                  <span>+{membershipMetrics.recentRegistrations}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pillar 2: Financial Treasury */}
        <div className="bg-white border-2 border-emerald-100 rounded-xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/60 rounded-bl-full pointer-events-none -z-0" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={14} className="text-emerald-700" /> Verified Revenue
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Audited
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                ₱{financialMetrics.verifiedRevenue.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 text-[11px] space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Gross Collections:</span>
                <strong className="text-gray-900">₱{financialMetrics.grossCollections.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span>Pending Verification:</span>
                <span className="text-amber-700 font-bold">₱{financialMetrics.pendingCollections.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Outstanding Balance:</span>
                <span className="text-blue-700 font-bold">₱{financialMetrics.receivables.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pillar 3: Events & Summits */}
        <div className="bg-white border-2 border-purple-100 rounded-xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-purple-400 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50/60 rounded-bl-full pointer-events-none -z-0" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck2 size={14} className="text-purple-700" /> Regional Events
              </span>
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Active
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-purple-900">{eventMetrics.totalEvents}</span>
              <span className="text-xs text-gray-500 font-medium">events hosted</span>
            </div>
            <div className="pt-2 border-t border-gray-100 text-[11px] space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Registered Attendees:</span>
                <strong className="text-gray-900">{eventMetrics.totalParticipants}</strong>
              </div>
              <div className="flex justify-between">
                <span>In-Venue Attendance:</span>
                <strong className="text-purple-700">{eventMetrics.checkedInCount} ({eventMetrics.checkInRate}%)</strong>
              </div>
              <div className="flex justify-between">
                <span>Affiliated Institutions:</span>
                <strong className="text-gray-900">{membershipMetrics.institutionsRepresented} schools</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Pillar 4: Corporate Alliances */}
        <div className="bg-white border-2 border-amber-100 rounded-xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/60 rounded-bl-full pointer-events-none -z-0" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase size={14} className="text-amber-700" /> Industry Alliances
              </span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Ecosystem
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700">
                ₱{partnerMetrics.totalValue.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 text-[11px] space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Active Industry Partners:</span>
                <strong className="text-gray-900">{partnerMetrics.uniquePartners || membershipMetrics.industryCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Executed Deals / MOAs:</span>
                <strong className="text-gray-900">{partnerMetrics.dealsCount} deals</strong>
              </div>
              <div className="flex justify-between">
                <span>Corporate Members:</span>
                <strong className="text-gray-900">{membershipMetrics.industryCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXECUTIVE PERFORMANCE SCORECARD TABLE */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="bg-gray-100/90 px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Regional Operations Master Performance Scorecard
            </h4>
          </div>
          <button
            type="button"
            onClick={handleExportDefault}
            className="text-xs text-primary hover:text-blue-800 font-bold flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-md border border-gray-200 hover:border-primary/40 shadow-2xs"
          >
            <FileSpreadsheet size={13} className="text-emerald-600" /> Export Scorecard CSV
          </button>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
              <tr>
                <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                <th className="px-3.5 py-2.5">Domain / Sector</th>
                <th className="px-3.5 py-2.5">Key Performance Indicator</th>
                <th className="px-3.5 py-2.5 text-right">Recorded Figures</th>
                <th className="px-3.5 py-2.5 text-center">Operational Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">01</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Membership Recruitment</td>
                <td className="px-3.5 py-2 text-gray-700">Combined Regional Roster (Individual + Institution + Industry)</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-primary font-mono">{membershipMetrics.totalCount} members</td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Active Registry
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">02</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Membership Quality</td>
                <td className="px-3.5 py-2 text-gray-700">Approved vs. Pending Clearance Ratio</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-emerald-700 font-mono">
                  {membershipMetrics.approvedCount} approved ({membershipMetrics.approvalRate}%)
                </td>
                <td className="px-3.5 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${membershipMetrics.pendingCount === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {membershipMetrics.pendingCount} in queue
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">03</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Institutional Alliances</td>
                <td className="px-3.5 py-2 text-gray-700">Active Higher Education & Tech Institutions Represented</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-gray-900 font-mono">{membershipMetrics.institutionsRepresented} colleges & univ.</td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                    Regional Network
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">04</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Treasury Realization</td>
                <td className="px-3.5 py-2 text-gray-700">Total Verified Collections into Organization Accounts</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-emerald-700 font-mono">
                  ₱{financialMetrics.verifiedRevenue.toLocaleString()}
                </td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Audited Funds
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">05</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Fiscal Receivables</td>
                <td className="px-3.5 py-2 text-gray-700">Pending Approvals & Institutional Partial Balances</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-blue-700 font-mono">
                  ₱{financialMetrics.receivables.toLocaleString()}
                </td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Collectible
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">06</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Summit & Event Program</td>
                <td className="px-3.5 py-2 text-gray-700">Total Registered Participants Across All Hosted Activities</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-purple-900 font-mono">{eventMetrics.totalParticipants} participants</td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                    {eventMetrics.checkInRate}% turnout
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-blue-50/30">
                <td className="px-3.5 py-2 text-center font-mono text-gray-500">07</td>
                <td className="px-3.5 py-2 font-bold text-gray-900">Corporate Sponsorship</td>
                <td className="px-3.5 py-2 text-gray-700">Total Direct Industry Contributions & Strategic Grants</td>
                <td className="px-3.5 py-2 text-right font-extrabold text-amber-700 font-mono">
                  ₱{partnerMetrics.totalValue.toLocaleString()}
                </td>
                <td className="px-3.5 py-2 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {partnerMetrics.dealsCount} deals
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* DEMOGRAPHICS & BREAKDOWN PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Membership Demographics */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={15} className="text-primary" /> Sector Affiliation Distribution
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-semibold text-gray-700">Individual Members (Students & Faculty)</span>
              <span className="font-mono font-bold text-primary">{membershipMetrics.individualCount} ({membershipMetrics.totalCount > 0 ? Math.round((membershipMetrics.individualCount / membershipMetrics.totalCount) * 100) : 0}%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-semibold text-gray-700">Institutional Group Rosters</span>
              <span className="font-mono font-bold text-emerald-700">{membershipMetrics.institutionCount} ({membershipMetrics.totalCount > 0 ? Math.round((membershipMetrics.institutionCount / membershipMetrics.totalCount) * 100) : 0}%)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-semibold text-gray-700">Industry & Corporate Members</span>
              <span className="font-mono font-bold text-amber-700">{membershipMetrics.industryCount} ({membershipMetrics.totalCount > 0 ? Math.round((membershipMetrics.industryCount / membershipMetrics.totalCount) * 100) : 0}%)</span>
            </div>
          </div>
        </div>

        {/* Payment Channels */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Wallet size={15} className="text-emerald-700" /> Payment & Collection Channels
          </h4>
          <div className="space-y-2 text-xs">
            {revenueByMethod.length > 0 ? (
              revenueByMethod.map((m) => (
                <div key={m.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-semibold text-gray-700">{m.name}</span>
                  <span className="font-mono font-bold text-emerald-700">₱{Number(m.value || 0).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-gray-500 text-xs">
                GCash, Bank Transfer, and Official Receipts active.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Signatures & Certification Section */}
      <div className="border-t-2 border-gray-300 pt-6 mt-6 grid grid-cols-2 gap-8 text-xs text-gray-700">
        <div>
          <p className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">Prepared & Verified By:</p>
          <div className="mt-10 border-b-2 border-gray-400 w-56" />
          <p className="mt-1.5 font-bold text-gray-900 text-sm">{preparedBy}</p>
          <p className="text-[11px] text-gray-500 capitalize">{userRole} / Executive Reporter</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Signed on {new Date().toLocaleDateString()}</p>
        </div>

        <div className="text-right">
          <p className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">Approved By Organization:</p>
          <div className="mt-10 border-b-2 border-gray-400 w-56 ml-auto" />
          <p className="mt-1.5 font-bold text-gray-900 text-sm">PSITS Regional Secretariat</p>
          <p className="text-[11px] text-gray-500">Executive Council & Board of Officers</p>
          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Official Stamp & Date</p>
        </div>
      </div>
    </div>
  );
};
