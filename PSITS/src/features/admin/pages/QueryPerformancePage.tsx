import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Button, Input } from '@/shared/components/Form';
import { Modal } from '@/shared/components/Common';
import { useNotification } from '@/shared/context/NotificationContext';
import { useAuth } from '@/shared/context/AuthContext';
import api, {
  type QueryPerformanceSummary,
  type QueryFingerprintStat,
  type SlowQueryLogItem,
} from '@/shared/services/api';
import {
  Activity,
  AlertTriangle,
  Clock,
  Gauge,
  RefreshCw,
  Search,
  Trash2,
  Zap,
  CheckCircle2,
  Database,
  Sliders,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

export const QueryPerformancePage = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();

  const notify = (type: 'info' | 'success' | 'warning' | 'error', message: string, title?: string) => {
    addNotification({
      userId: user?.id || 'admin',
      title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Notice'),
      message,
      type,
      isRead: false,
    });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<QueryPerformanceSummary>({
    thresholdMs: 100,
    totalQueriesTracked: 0,
    totalSlowQueries: 0,
    slowQueryPercentage: 0,
    totalExecutionTimeMs: 0,
    avgQueryDurationMs: 0,
    maxExecutionTimeObserved: 0,
    trackingStartedAt: new Date().toISOString(),
    uniqueQueryPatterns: 0,
  });
  const [fingerprints, setFingerprints] = useState<QueryFingerprintStat[]>([]);
  const [recentLogs, setRecentLogs] = useState<SlowQueryLogItem[]>([]);

  // Filters & State
  const [activeTab, setActiveTab] = useState<'fingerprints' | 'logs' | 'indexes'>('fingerprints');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'totalDuration' | 'count' | 'avgDuration' | 'maxDuration'>('totalDuration');
  const [newThresholdInput, setNewThresholdInput] = useState('100');
  const [updatingThreshold, setUpdatingThreshold] = useState(false);
  const [testingSlowQuery, setTestingSlowQuery] = useState(false);

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<SlowQueryLogItem | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [expandedFingerprints, setExpandedFingerprints] = useState<Record<string, boolean>>({});

  const fetchPerformanceData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.getQueryPerformance();
      if (res.data?.success) {
        setSummary(res.data.summary);
        setFingerprints(res.data.topResourceConsumingQueries || []);
        setRecentLogs(res.data.recentSlowLogs || []);
        setNewThresholdInput(String(res.data.summary.thresholdMs));
      }
    } catch (err: any) {
      notify('error', err?.response?.data?.message || 'Failed to load database performance metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const handleUpdateThreshold = async (valToSet?: number) => {
    const val = valToSet ?? Number(newThresholdInput);
    if (!Number.isFinite(val) || val <= 0) {
      notify('warning', 'Please enter a valid threshold in milliseconds (e.g. 50, 100, 250).');
      return;
    }

    setUpdatingThreshold(true);
    try {
      const res = await api.updateSlowQueryThreshold(val);
      if (res.data?.success) {
        setSummary((prev) => ({ ...prev, thresholdMs: res.data.thresholdMs }));
        setNewThresholdInput(String(res.data.thresholdMs));
        notify('success', `Slow query logging threshold updated to ${res.data.thresholdMs}ms.`);
        fetchPerformanceData(true);
      }
    } catch (err: any) {
      notify('error', err?.response?.data?.message || 'Failed to update threshold.');
    } finally {
      setUpdatingThreshold(false);
    }
  };

  const handleRunSlowQueryTest = async () => {
    setTestingSlowQuery(true);
    try {
      const res = await api.triggerTestSlowQuery(0.25);
      notify('info', res.data?.message || 'Simulated slow query (250ms) executed.');
      // Refresh to observe new logged item
      setTimeout(() => {
        fetchPerformanceData(true);
      }, 500);
    } catch (err: any) {
      notify('error', err?.response?.data?.message || 'Failed to run slow query test.');
    } finally {
      setTestingSlowQuery(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to reset query tracking stats and delete slow query logs?')) {
      return;
    }

    try {
      const res = await api.clearQueryPerformanceLogs();
      notify('success', res.data?.message || 'Metrics reset successfully.');
      fetchPerformanceData(true);
    } catch (err: any) {
      notify('error', err?.response?.data?.message || 'Failed to clear logs.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
    notify('info', 'Query copied to clipboard.');
  };

  const toggleExpand = (fp: string) => {
    setExpandedFingerprints((prev) => ({
      ...prev,
      [fp]: !prev[fp],
    }));
  };

  // Filtered and sorted fingerprints
  const filteredFingerprints = useMemo(() => {
    let list = fingerprints.filter((item) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.fingerprint.toLowerCase().includes(q) ||
        (item.sampleSql && item.sampleSql.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      if (sortBy === 'totalDuration') return b.totalDurationMs - a.totalDurationMs;
      if (sortBy === 'count') return b.count - a.count;
      if (sortBy === 'avgDuration') return b.avgDurationMs - a.avgDurationMs;
      if (sortBy === 'maxDuration') return b.maxDurationMs - a.maxDurationMs;
      return 0;
    });

    return list;
  }, [fingerprints, searchQuery, sortBy]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return recentLogs;
    const q = searchQuery.toLowerCase();
    return recentLogs.filter(
      (log) =>
        log.sql.toLowerCase().includes(q) ||
        log.fingerprint.toLowerCase().includes(q)
    );
  }, [recentLogs, searchQuery]);

  const maxTotalTime = useMemo(() => {
    return fingerprints.reduce((max, cur) => Math.max(max, cur.totalDurationMs), 1);
  }, [fingerprints]);

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Database className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Database Query Performance
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Active Profiler
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Real-time query execution profiling, slow query logging, and resource consumption analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunSlowQueryTest}
              disabled={testingSlowQuery}
              className="flex items-center gap-1.5"
            >
              <Zap className={`w-4 h-4 text-amber-500 ${testingSlowQuery ? 'animate-bounce' : ''}`} />
              {testingSlowQuery ? 'Running Test...' : 'Test Slow Query'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPerformanceData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              <Trash2 className="w-4 h-4" />
              Reset Stats
            </Button>
          </div>
        </div>

        {/* Threshold Configuration Card */}
        <Card className="p-4 bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-800/80 dark:to-indigo-950/20 border-indigo-100 dark:border-indigo-900/40">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg">
                <Sliders className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Slow Query Logging Threshold
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    (Current: <strong className="text-indigo-600 dark:text-indigo-400">{summary.thresholdMs}ms</strong>)
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Queries exceeding this duration are recorded into <code>slow_query_logs</code> with full parameters and execution time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1">
                {[50, 100, 200, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleUpdateThreshold(preset)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      summary.thresholdMs === preset
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {preset}ms
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="1"
                  max="10000"
                  value={newThresholdInput}
                  onChange={(e) => setNewThresholdInput(e.target.value)}
                  className="w-20 text-xs py-1 h-8"
                  placeholder="ms"
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdateThreshold()}
                  disabled={updatingThreshold}
                  className="h-8 text-xs px-3"
                >
                  Set
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Avg Query Latency */}
          <Card className="p-5 flex items-center justify-between border-l-4 border-l-emerald-500 shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Avg Query Latency
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary.avgQueryDurationMs} <span className="text-sm font-medium text-gray-500">ms</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Peak: <span className="font-semibold">{summary.maxExecutionTimeObserved} ms</span>
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Gauge className="w-6 h-6" />
            </div>
          </Card>

          {/* Card 2: Slow Queries Recorded */}
          <Card className="p-5 flex items-center justify-between border-l-4 border-l-amber-500 shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Slow Queries Flagged
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary.totalSlowQueries}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {summary.slowQueryPercentage}%
                </span>{' '}
                of overall workload
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </Card>

          {/* Card 3: Active Threshold */}
          <Card className="p-5 flex items-center justify-between border-l-4 border-l-indigo-500 shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Active Threshold
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary.thresholdMs} <span className="text-sm font-medium text-gray-500">ms</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Capturing queries &ge; {summary.thresholdMs}ms
              </p>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </Card>

          {/* Card 4: Total Tracked */}
          <Card className="p-5 flex items-center justify-between border-l-4 border-l-blue-500 shadow-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Queries Profiled
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {summary.totalQueriesTracked.toLocaleString()}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {summary.uniqueQueryPatterns} distinct fingerprints
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('fingerprints')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'fingerprints'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Layers className="w-4 h-4" />
              Query Patterns &amp; Resource Usage
              <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full">
                {fingerprints.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Recent Slow Query Logs
              {summary.totalSlowQueries > 0 && (
                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded-full font-bold">
                  {summary.totalSlowQueries}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('indexes')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'indexes'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Database Index Health &amp; Audit Guide
            </button>
          </nav>
        </div>

        {/* Tab 1: Query Fingerprint Analyzer */}
        {activeTab === 'fingerprints' && (
          <div className="space-y-4">
            {/* Search and Sort Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter queries by table, command, or keyword..."
                  className="pl-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="totalDuration">Most Total Time Consumed</option>
                  <option value="count">Most Frequently Run</option>
                  <option value="avgDuration">Highest Average Latency</option>
                  <option value="maxDuration">Highest Peak Latency</option>
                </select>
              </div>
            </div>

            {/* Fingerprints Table */}
            <Card className="overflow-hidden border border-gray-200 dark:border-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Query Fingerprint</th>
                      <th className="px-4 py-3 text-right">Runs</th>
                      <th className="px-4 py-3 text-right">Avg (ms)</th>
                      <th className="px-4 py-3 text-right">Max (ms)</th>
                      <th className="px-4 py-3 text-right min-w-[160px]">Resource Share</th>
                      <th className="px-4 py-3 text-center">Slow Count</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                          Loading query performance stats...
                        </td>
                      </tr>
                    ) : filteredFingerprints.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No query patterns found matching your filter. Run queries across the system or run a test slow query above.
                        </td>
                      </tr>
                    ) : (
                      filteredFingerprints.map((item, idx) => {
                        const isExpanded = !!expandedFingerprints[item.fingerprint];
                        const percentage =
                          maxTotalTime > 0
                            ? Math.min(100, Math.round((item.totalDurationMs / maxTotalTime) * 100))
                            : 0;

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            <td className="px-4 py-3 max-w-md">
                              <div className="font-mono text-gray-800 dark:text-gray-200 font-medium break-all">
                                {isExpanded
                                  ? item.fingerprint
                                  : item.fingerprint.length > 90
                                  ? `${item.fingerprint.slice(0, 90)}...`
                                  : item.fingerprint}
                              </div>
                              {item.fingerprint.length > 90 && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(item.fingerprint)}
                                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  {isExpanded ? (
                                    <>
                                      Collapse <ChevronUp className="w-3 h-3" />
                                    </>
                                  ) : (
                                    <>
                                      Show full SQL pattern <ChevronDown className="w-3 h-3" />
                                    </>
                                  )}
                                </button>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                              {item.count.toLocaleString()}
                            </td>

                            <td className="px-4 py-3 text-right font-mono font-medium">
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  item.avgDurationMs > summary.thresholdMs
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                                    : item.avgDurationMs > summary.thresholdMs * 0.5
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {item.avgDurationMs} ms
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                              {item.maxDurationMs} ms
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                  {Math.round(item.totalDurationMs)} ms
                                </span>
                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              {item.slowCount > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  {item.slowCount}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-600">0</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.sampleSql || item.fingerprint, `fp-${idx}`)}
                                title="Copy SQL pattern"
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                              >
                                {copiedText === `fp-${idx}` ? (
                                  <Check className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Recent Slow Query Execution Logs */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search slow query SQL or fingerprint..."
                  className="pl-9 text-sm"
                />
              </div>

              <span className="text-xs text-gray-500">
                Displaying {filteredLogs.length} slow query execution(s)
              </span>
            </div>

            <Card className="overflow-hidden border border-gray-200 dark:border-gray-800">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">SQL Query Executed</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                          <p className="font-semibold text-gray-800 dark:text-gray-200">
                            No Slow Queries Detected
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            All queries are currently completing within the configured {summary.thresholdMs}ms threshold.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRunSlowQueryTest}
                            className="mt-3 text-xs"
                          >
                            Trigger a Test Slow Query
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {log.durationMs} ms
                            </span>
                          </td>

                          <td className="px-4 py-3 max-w-xl font-mono text-gray-800 dark:text-gray-200 break-all">
                            {log.sql.length > 120 ? `${log.sql.slice(0, 120)}...` : log.sql}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                            <span className="block text-[10px] text-gray-400">
                              {new Date(log.timestamp).toLocaleDateString()}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedLog(log)}
                              className="text-xs px-2.5 py-1"
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: Step-by-Step Architecture & Index Health */}
        {activeTab === 'indexes' && (
          <div className="space-y-6">
            {/* Step 1: Indexes */}
            <Card className="p-6 border-l-4 border-l-emerald-500">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Database className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Step 1: Database Indexes Added to Filter Columns
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Indexes tell the database exactly where to find data instead of scanning every row sequentially.
                    The following indexes have been automatically applied to optimize <code>WHERE</code>, <code>ORDER BY</code>, <code>JOIN</code>, and <code>GROUP BY</code> clauses:
                  </p>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>users</code> Table
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>role</code>, <code>status</code>, <code>member_type</code>, <code>sector</code>, <code>institution_owner_id</code>, <code>created_at</code>, composite <code>(role, status)</code>
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>events</code> Table
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>status</code>, <code>event_type</code>, <code>start_at</code>, <code>end_at</code>, <code>created_at</code>, composite <code>(status, start_at)</code>
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>event_registrations</code> Table
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>event_id</code>, <code>member_id</code>, <code>status</code>, <code>created_at</code>, composite <code>(event_id, status)</code>
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>institution_members</code> Table
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>institution_user_id</code>, <code>event_id</code>, <code>status</code>, <code>created_at</code>, composite <code>(institution_user_id, status)</code>
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>payments</code> Table
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>member_id</code>, <code>event_id</code>, <code>status</code>, <code>payment_kind</code>, <code>created_at</code>, composite <code>(status, created_at)</code>
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-semibold text-xs text-gray-900 dark:text-white">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <code>announcements &amp; partners</code>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        <code>status</code>, <code>created_by</code>, <code>partner_id</code>, <code>contribution_type</code>, <code>created_at</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 2: Query Column Projection */}
            <Card className="p-6 border-l-4 border-l-blue-500">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Step 2: Restrict Query Field Projections (Eliminate Excessive Data)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Audited backend API queries to eliminate wildcard <code>SELECT *</code> patterns. Queries now request only the exact fields required by frontend modules:
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <strong><code>server/members.js</code>:</strong> Restricted to <code>id, full_name, email, sector, member_type, contact_number, status, join_date</code> (protects password hashes and reset tokens from wire transfer).
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <strong><code>server/institutionMembers.js</code>:</strong> Excluded <code>password_hash</code> and internal metadata in participant listings.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <strong><code>server/events.js</code>:</strong> Restricted to essential event view fields and subquery count.
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <strong><code>server/payments.js</code>:</strong> Explicit field projection for batch breakdowns, amounts, and statuses.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Step 3: Observability */}
            <Card className="p-6 border-l-4 border-l-indigo-500">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Gauge className="w-6 h-6" />
                </span>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Step 3: Slow Query Logging &amp; Performance Observability
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Transparent query interceptor in <code>server/db.js</code> measures all queries at the driver level with zero overhead. Queries exceeding the <strong>{summary.thresholdMs}ms</strong> threshold are asynchronously written to the persistent <code>slow_query_logs</code> table and reflected in this dashboard.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Modal: Inspect Query Details */}
        {selectedLog && (
          <Modal
            isOpen={!!selectedLog}
            onClose={() => setSelectedLog(null)}
            title="Slow Query Execution Details"
            size="lg"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-900/40">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  <span className="font-semibold text-rose-900 dark:text-rose-200 text-sm">
                    Execution Duration
                  </span>
                </div>
                <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                  {selectedLog.durationMs} ms
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Executed SQL
                </label>
                <div className="mt-1 relative">
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60">
                    {selectedLog.sql}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedLog.sql, 'modal-sql')}
                    className="absolute top-2 right-2 p-1.5 bg-gray-800 text-gray-300 hover:text-white rounded text-xs flex items-center gap-1"
                  >
                    {copiedText === 'modal-sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy
                  </button>
                </div>
              </div>

              {selectedLog.params && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                    Query Parameters
                  </label>
                  <pre className="mt-1 p-2.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs overflow-x-auto">
                    {selectedLog.params}
                  </pre>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                  Fingerprint Pattern
                </label>
                <div className="mt-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
                  {selectedLog.fingerprint}
                </div>
              </div>

              <div className="text-xs text-gray-400 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
                <span>Executed at: {new Date(selectedLog.timestamp).toLocaleString()}</span>
                <span>ID: {selectedLog.id}</span>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </MainLayout>
  );
};

export default QueryPerformancePage;
