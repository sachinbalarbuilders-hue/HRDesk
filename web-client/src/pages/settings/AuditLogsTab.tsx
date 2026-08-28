import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import {
  History,
  Search,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  User,
  RefreshCw,
} from 'lucide-react';

interface AuditLogItem {
  id: number;
  organizationId: number;
  userId?: number;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityName: string;
  primaryKey?: string;
  oldValues?: string;
  newValues?: string;
  changedColumns?: string;
  ipAddress?: string;
  timestamp: string;
}

export const AuditLogsTab: React.FC = () => {
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const PAGE_SIZE = 15;

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/audit-logs', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          entityName: selectedEntity !== 'all' ? selectedEntity : undefined,
          action: selectedAction !== 'all' ? selectedAction : undefined,
          search: search.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      });

      setLogs(res.data.items || []);
      setTotalCount(res.data.totalCount || 0);
      setTotalPages(res.data.totalPages || 1);
      if (res.data.availableEntities) {
        setAvailableEntities(res.data.availableEntities);
      }
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, selectedEntity, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            DELETE
          </span>
        );
      default:
        return <span className="px-2 py-0.5 text-[10px] rounded bg-[var(--surface-sunken)]">{action}</span>;
    }
  };

  const parseJson = (jsonStr?: string) => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--ink)] flex items-center gap-2">
            <History size={20} className="text-[var(--gold-500)]" />
            Enterprise Audit Trail Ledger
          </h3>
          <p className="text-xs text-[var(--ink-muted)] font-ui">
            Immutable compliance record of all database modifications, actor IDs, and field-level diffs.
          </p>
        </div>
        <button
          onClick={() => {
            setPage(1);
            fetchLogs();
          }}
          className="btn-secondary flex items-center gap-1.5 text-xs self-start"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <form
        onSubmit={handleSearchSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-[var(--surface)] p-4 rounded-[4px] border border-[var(--rule)]"
      >
        {/* Search Input */}
        <div className="md:col-span-2 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, property, IP..."
            className="register-input !pl-9 py-1.5 text-xs w-full"
          />
        </div>

        {/* Entity Filter */}
        <div>
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="register-input py-1.5 text-xs w-full"
          >
            <option value="all">All Entities</option>
            {availableEntities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </select>
        </div>

        {/* Action Filter */}
        <div>
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="register-input py-1.5 text-xs w-full"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="register-input py-1.5 text-xs w-full"
            title="From Date"
          />
        </div>

        {/* Date To */}
        <div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="register-input py-1.5 text-xs w-full"
            title="To Date"
          />
        </div>

        {/* Apply Button */}
        <div>
          <button type="submit" className="btn-primary w-full py-1.5 text-xs font-semibold">
            Filter
          </button>
        </div>
      </form>

      {/* Audit Logs Table */}
      <div className="rounded-[4px] border border-[var(--rule)] bg-[var(--surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--rule)] bg-[var(--surface-sunken)] font-ui text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
                <th className="py-3 px-4 w-12 text-center">Sr.</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor / User</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Modified Columns</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--ink-muted)]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-[var(--gold-500)]" />
                      <span>Loading audit records...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--ink-muted)] font-ui">
                    <FileText size={24} className="mx-auto mb-2 opacity-40" />
                    <span>No audit log records found for the selected criteria.</span>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-[var(--surface-sunken)]/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-center text-xs text-[var(--ink-muted)] w-12">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--ink)] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[var(--ink)]">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-[var(--ink-muted)] shrink-0" />
                        <span>{log.userName || 'System'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{renderActionBadge(log.action)}</td>
                    <td className="py-3 px-4 font-semibold text-[var(--ink)]">
                      <span>{log.entityName}</span>
                      {log.primaryKey && (
                        <span className="ml-1 text-[10px] font-mono text-[var(--ink-muted)]">
                          #{log.primaryKey}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--ink-muted)] max-w-xs truncate" title={log.changedColumns}>
                      {log.changedColumns || (log.action === 'CREATE' ? 'New record created' : 'Record deleted')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--ink-muted)]">
                      {log.ipAddress || 'Internal / Local'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setInspectLog(log)}
                        className="p-1.5 rounded hover:bg-[var(--paper)] text-[var(--gold-600)] dark:text-[var(--gold-400)] transition-colors cursor-pointer"
                        title="View Field-by-Field Diff"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--rule)] bg-[var(--surface-sunken)] text-xs font-ui">
          <span className="text-[var(--ink-muted)]">
            Showing <strong className="text-[var(--ink)]">{logs.length}</strong> of{' '}
            <strong className="text-[var(--ink)]">{totalCount}</strong> total events
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-40 hover:bg-[var(--paper)] cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono text-xs">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded border border-[var(--rule)] bg-[var(--surface)] text-[var(--ink)] disabled:opacity-40 hover:bg-[var(--paper)] cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-sunken)]">
              <div className="flex items-center gap-2 min-w-0">
                <History size={18} className="text-[var(--gold-500)] shrink-0" />
                <h4 className="font-display font-bold text-base text-[var(--ink)] truncate">
                  Audit Diff: {inspectLog.entityName} #{inspectLog.primaryKey || inspectLog.id}
                </h4>
                {renderActionBadge(inspectLog.action)}
              </div>
              <button
                onClick={() => setInspectLog(null)}
                className="p-1.5 rounded hover:bg-[var(--paper)] text-[var(--ink-muted)] cursor-pointer shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Diffs */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Event Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--paper)] p-3.5 rounded border border-[var(--rule)]">
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold block mb-0.5">Actor</span>
                  <strong className="text-[var(--ink)] block truncate font-medium text-xs" title={inspectLog.userName || 'System'}>
                    {inspectLog.userName || 'System'}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold block mb-0.5">Timestamp</span>
                  <span className="text-[var(--ink)] block truncate font-mono text-[11px]" title={new Date(inspectLog.timestamp).toLocaleString()}>
                    {new Date(inspectLog.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold block mb-0.5">IP Address</span>
                  <span className="text-[var(--ink)] font-mono text-[11px] block truncate">
                    {inspectLog.ipAddress || 'Local'}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider font-semibold block mb-0.5">Audit ID</span>
                  <span className="text-[var(--ink)] font-mono text-[11px] font-bold block">
                    #{inspectLog.id}
                  </span>
                </div>
              </div>

              {/* Field Diff Table */}
              <div className="border border-[var(--rule)] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-sunken)] border-b border-[var(--rule)] text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
                      <th className="py-2.5 px-3">Field Name</th>
                      {inspectLog.action !== 'CREATE' && <th className="py-2.5 px-3">Previous Value (Old)</th>}
                      {inspectLog.action !== 'DELETE' && <th className="py-2.5 px-3">New Value</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rule)]">
                    {(() => {
                      const oldObj = parseJson(inspectLog.oldValues) || {};
                      const newObj = parseJson(inspectLog.newValues) || {};
                      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

                      if (allKeys.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="py-6 text-center text-[var(--ink-muted)]">
                              No explicit field diffs recorded.
                            </td>
                          </tr>
                        );
                      }

                      return allKeys.map((key) => {
                        const oldVal = oldObj[key];
                        const newVal = newObj[key];
                        const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                        return (
                          <tr key={key} className={isChanged ? 'bg-amber-500/5' : ''}>
                            <td className="py-2 px-3 font-semibold text-[var(--ink)] font-mono text-[11px]">
                              {key}
                            </td>
                            {inspectLog.action !== 'CREATE' && (
                              <td className="py-2 px-3 font-mono text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/5">
                                {oldVal !== undefined && oldVal !== null ? String(oldVal) : <span className="text-[var(--ink-muted)] italic">null</span>}
                              </td>
                            )}
                            {inspectLog.action !== 'DELETE' && (
                              <td className="py-2 px-3 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                {newVal !== undefined && newVal !== null ? String(newVal) : <span className="text-[var(--ink-muted)] italic">null</span>}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[var(--rule)] bg-[var(--surface-sunken)] text-right">
              <button onClick={() => setInspectLog(null)} className="btn-secondary text-xs py-1.5 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
