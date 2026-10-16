import { useMemo, useState } from 'react';
import { exportToCSV } from '@/shared/utils/export';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Building2,
  Users,
  Briefcase,
  User,
  Filter,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export interface MemberRecord {
  unique_id?: string;
  raw_id?: number | string;
  id?: number | string;
  full_name?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  contact_number?: string;
  contactNumber?: string;
  category?: 'individual' | 'institution' | 'industry' | string;
  memberType?: string;
  institution_name?: string;
  institutionName?: string;
  sectorDetails?: string;
  position?: string;
  occupation?: string;
  status?: string;
  created_at?: string | Date;
  source?: string;
}

interface MemberDirectoryExportTableProps {
  members: MemberRecord[];
  institutions: string[];
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
  initialCategory?: 'all' | 'individual' | 'institution' | 'industry';
  initialInstitution?: string;
  hideHeaderCard?: boolean;
}

export const MemberDirectoryExportTable = ({
  members = [],
  institutions = [],
  isLoading = false,
  title = 'Members Export & Directory Table',
  subtitle = 'Search, filter by Individual, Institution, Industry, and specific Institution Name to view and export full rosters.',
  initialCategory = 'all',
  initialInstitution = 'all',
  hideHeaderCard = false,
}: MemberDirectoryExportTableProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'individual' | 'institution' | 'industry'>(initialCategory);
  const [selectedInstitution, setSelectedInstitution] = useState<string>(initialInstitution);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'pending'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);

  // Category summary counts
  const categoryCounts = useMemo(() => {
    let ind = 0;
    let inst = 0;
    let indus = 0;
    members.forEach((m) => {
      const cat = (m.category || m.memberType || '').toLowerCase();
      if (cat === 'industry') indus += 1;
      else if (cat === 'institution') inst += 1;
      else ind += 1;
    });
    return { total: members.length, individual: ind, institution: inst, industry: indus };
  }, [members]);

  // Distinct institutions list (from prop or derived from members)
  const availableInstitutions = useMemo(() => {
    const set = new Set<string>();
    institutions.forEach((i) => {
      if (i && i.trim()) set.add(i.trim());
    });
    members.forEach((m) => {
      const name = m.institution_name || m.institutionName || m.sectorDetails;
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort();
  }, [institutions, members]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = (m.category || m.memberType || '').toLowerCase();
        if (selectedCategory === 'individual' && cat !== 'individual' && cat !== 'student') return false;
        if (selectedCategory === 'institution' && cat !== 'institution') return false;
        if (selectedCategory === 'industry' && cat !== 'industry') return false;
      }

      // Institution filter
      if (selectedInstitution !== 'all') {
        const inst = (m.institution_name || m.institutionName || m.sectorDetails || '').toLowerCase().trim();
        const target = selectedInstitution.toLowerCase().trim();
        if (inst !== target && !inst.includes(target)) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        const st = (m.status || '').toLowerCase();
        if (selectedStatus === 'active' && st !== 'active' && st !== 'approved') return false;
        if (selectedStatus === 'pending' && st !== 'pending') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (m.full_name || m.fullName || m.displayName || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        const contact = (m.contact_number || m.contactNumber || '').toLowerCase();
        const inst = (m.institution_name || m.institutionName || m.sectorDetails || '').toLowerCase();
        const pos = (m.position || m.occupation || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !contact.includes(q) && !inst.includes(q) && !pos.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [members, selectedCategory, selectedInstitution, selectedStatus, searchQuery]);

  // Paginated records
  const paginatedMembers = useMemo(() => {
    if (pageSize === 'all') return filteredMembers;
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredMembers.length / pageSize) || 1;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedInstitution('all');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!filteredMembers.length) return;

    const dataToExport = filteredMembers.map((m, idx) => ({
      '#': idx + 1,
      'Member ID': m.unique_id || m.raw_id || m.id || '—',
      'Full Name': m.full_name || m.fullName || m.displayName || '—',
      'Email Address': m.email || '—',
      'Contact Number': m.contact_number || m.contactNumber || '—',
      'Member Category': (m.category || m.memberType || 'individual').toUpperCase(),
      'Institution / Affiliation': m.institution_name || m.institutionName || m.sectorDetails || 'Individual',
      'Position / Role': m.position || m.occupation || 'Member',
      'Membership Status': (m.status === 'active' || m.status === 'approved') ? 'Active / Approved' : (m.status || 'Pending'),
      'Date Registered': m.created_at ? new Date(m.created_at).toLocaleDateString() : '—',
    }));

    let filename = 'PSITS_Member_Directory';
    if (selectedInstitution !== 'all') {
      filename += `_${selectedInstitution.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    } else if (selectedCategory !== 'all') {
      filename += `_${selectedCategory}`;
    }
    exportToCSV(filename, dataToExport);
  };

  const isFilteringActive =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedInstitution !== 'all' ||
    selectedStatus !== 'all';

  return (
    <div className={`space-y-4 ${hideHeaderCard ? '' : 'rounded-2xl border border-gray-200 bg-white p-5 shadow-xs'}`}>
      {/* Optional Header */}
      {!hideHeaderCard && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="text-primary h-5 w-5" />
              {title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMembers.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={15} />
              Export to Excel ({filteredMembers.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setPageSize('all');
                setTimeout(() => window.print(), 150);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all cursor-pointer"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="space-y-3 bg-gray-50/80 border border-gray-200 rounded-xl p-3.5 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, role..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">👥 All Categories ({categoryCounts.total})</option>
              <option value="individual">👤 Individual Members ({categoryCounts.individual})</option>
              <option value="institution">🏛️ Institution Members ({categoryCounts.institution})</option>
              <option value="industry">💼 Industry Members ({categoryCounts.industry})</option>
            </select>
          </div>

          {/* Institution Name Dropdown Filter */}
          <div>
            <select
              value={selectedInstitution}
              onChange={(e) => {
                setSelectedInstitution(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-gray-800"
            >
              <option value="all">🏛️ All Institutions ({availableInstitutions.length} available)</option>
              {availableInstitutions.map((inst) => {
                const count = members.filter(
                  (m) => (m.institution_name || m.institutionName || m.sectorDetails || '').toLowerCase().trim() === inst.toLowerCase().trim()
                ).length;
                return (
                  <option key={inst} value={inst}>
                    {inst} ({count} members)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="all">⚡ All Statuses</option>
              <option value="active">Active / Approved</option>
              <option value="pending">Pending</option>
            </select>

            {isFilteringActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset all filters"
                className="px-2.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer text-xs flex items-center gap-1"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-700">Showing:</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
            </span>

            {selectedCategory !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                Category: <strong className="capitalize">{selectedCategory}</strong>
              </span>
            )}

            {selectedInstitution !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium flex items-center gap-1">
                <Building2 size={11} />
                Institution: <strong>{selectedInstitution}</strong>
              </span>
            )}

            {selectedStatus !== 'all' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                Status: <strong className="capitalize">{selectedStatus}</strong>
              </span>
            )}

            {searchQuery.trim() && (
              <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 font-medium">
                Keyword: "{searchQuery}"
              </span>
            )}
          </div>

          {/* Quick inline export button if in compact mode */}
          {hideHeaderCard && (
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMembers.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              Export Table (.CSV)
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100/80 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">Member Name</th>
                <th className="px-3.5 py-2.5">Email & Contact</th>
                <th className="px-3.5 py-2.5">Category</th>
                <th className="px-3.5 py-2.5">Institution / Affiliation</th>
                <th className="px-3.5 py-2.5">Position / Role</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
                <th className="px-3.5 py-2.5 text-right">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading member roster...
                    </div>
                  </td>
                </tr>
              ) : paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <Filter className="h-6 w-6 text-gray-400 mx-auto mb-1 opacity-60" />
                    <p className="font-semibold text-gray-700">No members match the selected filters.</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Try clearing or adjusting your search keyword, category, or institution filter.</p>
                    {isFilteringActive && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} /> Reset Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((m, idx) => {
                  const cat = (m.category || m.memberType || 'individual').toLowerCase();
                  const isApproved = m.status === 'active' || m.status === 'approved';
                  const instName = m.institution_name || m.institutionName || m.sectorDetails || '—';

                  return (
                    <tr key={m.unique_id || m.id || idx} className="hover:bg-blue-50/40 transition-colors">
                      {/* Name */}
                      <td className="px-3.5 py-2 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            cat === 'institution'
                              ? 'bg-purple-100 text-purple-700'
                              : cat === 'industry'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {(m.full_name || m.fullName || m.displayName || 'M').charAt(0).toUpperCase()}
                          </div>
                          <span>{m.full_name || m.fullName || m.displayName || '—'}</span>
                        </div>
                      </td>

                      {/* Email & Contact */}
                      <td className="px-3.5 py-2 text-gray-600 whitespace-nowrap">
                        <div>{m.email || '—'}</div>
                        {m.contact_number && (
                          <div className="text-[10px] text-gray-400">{m.contact_number}</div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        {cat === 'institution' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Building2 size={10} />
                            Institution
                          </span>
                        ) : cat === 'industry' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Briefcase size={10} />
                            Industry
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <User size={10} />
                            Individual
                          </span>
                        )}
                      </td>

                      {/* Institution / Affiliation */}
                      <td className="px-3.5 py-2 text-gray-700 whitespace-nowrap">
                        {instName !== '—' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800">
                            <Building2 size={12} className="text-gray-400" />
                            {instName}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Individual (None)</span>
                        )}
                      </td>

                      {/* Position / Role */}
                      <td className="px-3.5 py-2 text-gray-600 whitespace-nowrap capitalize">
                        {m.position || m.occupation || 'Member'}
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-2 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isApproved
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isApproved ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          {m.status || (isApproved ? 'Approved' : 'Pending')}
                        </span>
                      </td>

                      {/* Date Registered */}
                      <td className="px-3.5 py-2 text-right text-gray-500 whitespace-nowrap text-[11px]">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        {filteredMembers.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 no-print">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val as any);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded border border-gray-300 bg-white font-medium"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All ({filteredMembers.length})</option>
              </select>
              <span className="text-gray-400">|</span>
              <span>
                Showing {pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1}–
                {pageSize === 'all'
                  ? filteredMembers.length
                  : Math.min(currentPage * pageSize, filteredMembers.length)}{' '}
                of {filteredMembers.length} records
              </span>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
