import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { apiClient } from '../api/client';
import { useOrganization } from '../context/CompanyContext';
import { PaginationToolbar } from '../components/ui/PaginationToolbar';
import { formatTime } from '../utils/formatters';
import {
  ShieldCheck,
  ShieldAlert,
  Camera,
  User as UserIcon,
  Building2,
  Briefcase,
  Search,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  MapPin,
  Database,
  Filter,
  Loader2,
} from 'lucide-react';

interface VerificationData {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  branch: string;
  organizationName?: string;
  isActive: boolean;
  photoPath: string;
}

interface ScanLogItem {
  id: string;
  employeeCode: string;
  employeeName: string;
  department?: string;
  designation?: string;
  organizationName?: string;
  timestamp: string;
  date?: string;
  status: 'granted' | 'denied';
  scanMode?: string;
  reason?: string;
}

export const GuardScanner: React.FC = () => {
  const { currentOrganization, currentBranch } = useOrganization();

  const [scanResult, setScanResult] = useState<VerificationData | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [recentLogs, setRecentLogs] = useState<ScanLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));

  // Infinite Scroll & Filter State for Gate Activity Ledger
  const [logPage, setLogPage] = useState(1);
  const [logTotalCount, setLogTotalCount] = useState(0);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'granted' | 'denied'>('all');
  const [logSearch, setLogSearch] = useState('');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);

  // Live Clock for Guard Terminal
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch persistent paginated scan logs from SQL Server database (Infinite scroll)
  const loadLogs = useCallback(async (pageToFetch = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingLogs(true);
      }
      const res = await apiClient.get('/gate-scans', {
        params: {
          page: pageToFetch,
          pageSize: 20,
          status: logStatusFilter !== 'all' ? logStatusFilter : undefined,
          search: logSearch.trim() || undefined,
          organizationId: currentOrganization?.id || undefined,
          branchId: currentBranch?.id || undefined,
        },
      });
      if (res.data && res.data.items) {
        const newItems: ScanLogItem[] = res.data.items;
        setRecentLogs((prev) => {
          if (!append) return newItems;
          const existingIds = new Set(prev.map((i) => i.id));
          const filtered = newItems.filter((i) => !existingIds.has(i.id));
          return [...prev, ...filtered];
        });
        setLogPage(pageToFetch);
        setLogTotalCount(res.data.totalCount || 0);
        setLogTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setRecentLogs(res.data);
        setLogTotalCount(res.data.length);
        setLogTotalPages(1);
      }
    } catch (e) {
      console.error('Failed to fetch gate logs:', e);
    } finally {
      setLoadingLogs(false);
      setLoadingMore(false);
    }
  }, [logStatusFilter, logSearch, currentOrganization?.id, currentBranch?.id]);

  useEffect(() => {
    loadLogs(1, false);
  }, [loadLogs]);

  // On-Scroll Infinite pagination trigger
  const handleFeedScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 60 && !loadingLogs && !loadingMore && logPage < logTotalPages) {
      loadLogs(logPage + 1, true);
    }
  };

  const handleVerificationSuccess = (data: VerificationData, scanMode: 'Camera_QR' | 'Manual_Search' = 'Camera_QR') => {
    setScanResult(data);
    setScanError(null);
    setIsScanning(false);

    // Refresh database logs from server (server already logged the verified event atomically)
    loadLogs(1, false);
  };

  const handleVerificationError = (errorMsg: string, code?: string, scanMode: 'Camera_QR' | 'Manual_Search' = 'Camera_QR') => {
    setScanError(errorMsg);
    setScanResult(null);
    setIsScanning(false);

    // Refresh database logs from server (server already logged the denied event atomically)
    loadLogs(1, false);
  };

  // Initialize QR Scanner
  useEffect(() => {
    if (!isScanning) return;

    const qrElement = document.getElementById('qr-reader');
    if (!qrElement) return;

    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          videoConstraints: { facingMode: { ideal: 'environment' } },
        },
        false
      );

      scannerRef.current = scanner;

      const onScanSuccess = async (decodedText: string) => {
        try {
          let verificationId = decodedText.trim();
          if (decodedText.includes('/')) {
            const url = new URL(decodedText);
            const segments = url.pathname.split('/').filter(Boolean);
            verificationId = segments[segments.length - 1];
          }

          scanner.clear().catch(() => {});
          const encoded = encodeURIComponent(verificationId);
          const response = await apiClient.get(`/employees/${encoded}/public-verify`, {
            params: {
              branchId: currentBranch?.id || undefined,
              organizationId: currentOrganization?.id || undefined,
            },
          });
          handleVerificationSuccess(response.data, 'Camera_QR');
        } catch (err: any) {
          scanner.clear().catch(() => {});
          if (err.response?.status === 404) {
            handleVerificationError('Badge Not Found: The scanned ID is not registered in the system.', undefined, 'Camera_QR');
          } else {
            handleVerificationError(err.response?.data?.message || 'Verification Failed: Invalid QR code or server unreachable.', undefined, 'Camera_QR');
          }
        }
      };

      const onScanFailure = () => {
        // Ignore silent frame-by-frame lookup errors
      };

      scanner.render(onScanSuccess, onScanFailure);
    } catch (e) {
      console.error('Error initializing scanner:', e);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isScanning, currentBranch?.id, currentOrganization?.id]);

  // Manual Employee Code / Verification Lookup
  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualCode.trim();
    if (!query) return;

    try {
      setManualLoading(true);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
      const encoded = encodeURIComponent(query);
      const response = await apiClient.get(`/employees/${encoded}/public-verify`, {
        params: {
          branchId: currentBranch?.id || undefined,
          organizationId: currentOrganization?.id || undefined,
        },
      });
      handleVerificationSuccess(response.data, 'Manual_Search');
      setManualCode('');
    } catch (err: any) {
      if (err.response?.status === 404) {
        handleVerificationError(err.response?.data?.message || `Employee Code "${query}" was not found in active directory.`, query, 'Manual_Search');
      } else {
        handleVerificationError(err.response?.data?.message || 'Failed to verify employee record.', query, 'Manual_Search');
      }
    } finally {
      setManualLoading(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setScanError(null);
    setIsScanning(true);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 ">
      {/* TERMINAL HEADER BANNER */}
      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--accent)]/10 text-[var(--accent-hover)] dark:text-[var(--gold-400)] flex items-center justify-center font-semibold border border-[var(--accent)]/20 shadow-xs">
            <Camera size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className=" font-semibold text-base text-[var(--text-primary)] tracking-tight">
                Security Gate Badge Terminal
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-normal font-semibold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Active
              </span>
            </div>

            {/* Company & Branch Text Indicator */}
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 mt-1">
              <span className="font-semibold text-[var(--text-primary)]">{currentOrganization?.name || 'Main Organization'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin size={11} className="text-[var(--accent)]" />
                {currentBranch?.name || 'Gate Entrance'}
              </span>
            </p>
          </div>
        </div>

        {/* Right side live clock & Fullscreen Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--rule)]  text-xs font-semibold text-[var(--text-primary)]">
            <Clock size={13} className="text-[var(--accent)]" />
            <span>{currentTime}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Toggle Kiosk Fullscreen Mode"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Kiosk' : 'Kiosk Mode'}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN GRID: SCANNER & SCAN LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SCANNER VIEWPORT OR VERIFICATION RESULT */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden shadow-xs">
            {/* SCANNING STATE */}
            {isScanning && (
              <div className="p-6 flex flex-col items-center justify-center space-y-5">
                <div className="w-full max-w-sm mx-auto relative">
                  {/* Glowing Radar Target Framing */}
                  <div className="relative rounded-[var(--radius-lg)] overflow-hidden border-2 border-[var(--accent)] shadow-lg bg-black min-h-[280px] flex items-center justify-center">
                    <div id="qr-reader" className="w-full" />
                  </div>

                  <p className="text-center text-xs text-[var(--text-secondary)] mt-4 font-medium flex items-center justify-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--accent)]" />
                    Point camera directly at the employee QR badge
                  </p>
                </div>
              </div>
            )}

            {/* VERIFICATION SUCCESS: ACCESS GRANTED OR DENIED */}
            {!isScanning && scanResult && (
              <div className="animate-fade-in p-6 space-y-6">
                {/* Status Alert Banner */}
                <div
                  className={`p-4 rounded-[var(--radius-md)] flex items-center justify-between border ${
                    scanResult.isActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {scanResult.isActive ? (
                      <ShieldCheck size={28} className="text-emerald-600 shrink-0" />
                    ) : (
                      <ShieldAlert size={28} className="text-rose-600 shrink-0" />
                    )}
                    <div>
                      <h2 className=" font-semibold text-base uppercase tracking-wider">
                        {scanResult.isActive ? 'Access Granted' : 'Access Denied'}
                      </h2>
                      <p className="text-xs opacity-90">
                        {scanResult.isActive ? 'Valid active employee badge' : 'Employee is marked inactive'}
                      </p>
                    </div>
                  </div>

                  <span className=" text-xs font-semibold px-2.5 py-1 rounded bg-[var(--surface)] shadow-xs border border-[var(--rule)] text-[var(--text-primary)]">
                    {currentTime}
                  </span>
                </div>

                {/* Employee Card Details */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 bg-[var(--surface-sunken)]/50 rounded-[var(--radius-md)] border border-[var(--rule)]">
                  {/* Photo Avatar */}
                  <div className="w-24 h-24 rounded-[var(--radius-md)] overflow-hidden border-2 border-[var(--rule)] shadow-sm bg-[var(--surface)] shrink-0 flex items-center justify-center relative">
                    {scanResult.photoPath ? (
                      <img
                        src={scanResult.photoPath}
                        alt={scanResult.employeeName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <UserIcon size={36} className="text-[var(--text-secondary)]" />
                    )}
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 font-semibold text-xs font-normal px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-hover)] dark:text-[var(--gold-400)] border border-[var(--accent)]/20">
                          <Building2 size={12} />
                          {scanResult.organizationName || currentOrganization?.name}
                        </span>
                        {scanResult.branch && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--rule)] text-[var(--text-primary)]">
                            <MapPin size={11} />
                            {scanResult.branch}
                          </span>
                        )}
                      </div>

                      <h3 className=" font-semibold text-base text-[var(--text-primary)] truncate">
                        {scanResult.employeeName}
                      </h3>
                      <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                        <span className=" text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--rule)] text-[var(--text-primary)]">
                          {scanResult.employeeCode}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">ID: #{scanResult.employeeId}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] bg-[var(--surface)] p-2 rounded border border-[var(--rule)]">
                        <Briefcase size={14} className="text-[var(--accent)] shrink-0" />
                        <span className="truncate">{scanResult.designation || 'Staff'}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[var(--text-primary)] bg-[var(--surface)] p-2 rounded border border-[var(--rule)]">
                        <Building2 size={14} className="text-[var(--accent)] shrink-0" />
                        <span className="truncate">{scanResult.department || 'General'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reset Next Scan Button */}
                <button
                  onClick={resetScanner}
                  className="btn-primary w-full py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <RefreshCw size={14} />
                  <span>Scan Next Employee Badge</span>
                </button>
              </div>
            )}

            {/* SCAN ERROR / NOT FOUND STATE */}
            {!isScanning && scanError && (
              <div className="animate-fade-in p-6 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto border border-rose-500/20">
                  <ShieldAlert size={32} />
                </div>
                <div>
                  <h2 className=" font-semibold text-base text-[var(--text-primary)] uppercase tracking-tight">
                    Security Alert: Verification Failed
                  </h2>
                  <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto bg-rose-500/5 p-3 rounded border border-rose-500/20">
                    {scanError}
                  </p>
                </div>

                <button
                  onClick={resetScanner}
                  className="btn-primary py-2.5 px-6 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <RefreshCw size={14} />
                  <span>Try Scanning Again</span>
                </button>
              </div>
            )}
          </div>

          {/* MANUAL EMPLOYEE CODE SEARCH */}
          <form
            onSubmit={handleManualVerify}
            className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] p-4 shadow-xs space-y-2.5"
          >
            <label className="block font-semibold text-xs text-[var(--text-primary)]">
              Manual Badge / Employee Code Search
            </label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Enter Employee Code (e.g. EMP#001, EMP#213) or ID..."
                  className="register-input !pl-9 py-2 text-xs w-full  font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={manualLoading || !manualCode.trim()}
                className="btn-primary text-xs px-5 py-2 font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {manualLoading ? 'Verifying...' : 'Verify Badge'}
              </button>
            </div>

            <p className="text-xs font-normal text-[var(--text-secondary)]">
              Accepts standard employee codes (e.g. <code className=" font-semibold text-[var(--text-primary)]">EMP#001</code>, <code className=" font-semibold text-[var(--text-primary)]">EMP#213</code>) or numeric ID.
            </p>
          </form>
        </div>

        {/* RIGHT COLUMN: RECENT BADGE SCANS LEDGER (PERSISTENT DATABASE FEED WITH PAGINATION) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[var(--radius-md)] overflow-hidden shadow-xs flex flex-col">
            {/* Feed Header */}
            <div className="p-3.5 border-b border-[var(--rule)] flex items-center justify-between bg-[var(--surface-sunken)]/50">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[var(--accent)]" />
                <h3 className=" font-semibold text-xs text-[var(--text-primary)] uppercase tracking-wider">
                  Gate Activity Feed
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1  text-xs font-normal text-[var(--text-secondary)]">
                  <Database size={11} className="text-emerald-600" />
                  {recentLogs.length > 0 ? `${recentLogs.length} of ${logTotalCount}` : 'Database Synced'}
                </span>
                <button
                  type="button"
                  onClick={() => loadLogs(1, false)}
                  className="p-1 hover:bg-[var(--surface-sunken)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  title="Refresh activity feed from database"
                >
                  <RefreshCw size={12} className={loadingLogs ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-2.5 bg-[var(--surface-sunken)]/30 border-b border-[var(--rule)] flex items-center justify-between gap-2 text-xs">
              {/* Status Filter Pills */}
              <div className="inline-flex rounded-[3px] border border-[var(--rule)] bg-[var(--paper)] p-0.5  text-xs font-normal">
                {(['all', 'granted', 'denied'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setLogStatusFilter(st);
                    }}
                    className={`px-2 py-0.5 rounded-[2px] font-semibold capitalize transition-colors cursor-pointer ${
                      logStatusFilter === st
                        ? st === 'granted'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : st === 'denied'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-[var(--accent)] text-white shadow-2xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Mini Log Search */}
              <div className="relative flex-1 max-w-[180px]">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                  }}
                  placeholder="Filter logs..."
                  className="register-input !pl-7 !pr-2 py-1 text-xs font-normal w-full "
                />
              </div>
            </div>

            {/* Log Items List with On-Scroll Pagination */}
            <div
              ref={feedScrollRef}
              onScroll={handleFeedScroll}
              className="divide-y divide-[var(--rule)] max-h-[480px] overflow-y-auto min-h-[240px]"
            >
              {recentLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)] ">
                  {loadingLogs ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-[var(--accent)]" />
                      <span>Loading gate activity...</span>
                    </div>
                  ) : (
                    'No gate scan activity found for current filters.'
                  )}
                </div>
              ) : (
                <>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-[var(--surface-sunken)]/40 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {log.status === 'granted' ? (
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle size={16} className="text-rose-600 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)] truncate">
                            {log.employeeName}
                          </div>
                          <div className=" text-xs font-normal text-[var(--text-secondary)] flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold">{log.employeeCode}</span>
                            {log.scanMode && (
                              <span className="text-xs font-normal px-1.5 py-0.2 rounded bg-[var(--surface-sunken)] border border-[var(--rule)]">
                                {log.scanMode === 'Camera_QR' ? 'QR Scan' : 'Manual'}
                              </span>
                            )}
                            <span>•</span>
                            <span className="truncate">{log.reason || (log.status === 'granted' ? 'Verified' : 'Failed')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className=" text-xs font-semibold text-[var(--text-secondary)] block bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border border-[var(--rule)]">
                          {log.timestamp}
                        </span>
                        {log.date && (
                          <span className=" text-xs font-normal text-[var(--text-secondary)] block mt-0.5">
                            {log.date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {loadingMore && (
                    <div className="p-3 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2 bg-[var(--surface-sunken)]/20">
                      <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
                      <span>Loading older activity logs...</span>
                    </div>
                  )}

                  {!loadingMore && logTotalCount > 0 && logPage >= logTotalPages && (
                    <div className="py-2.5 text-center text-xs font-normal text-[var(--text-secondary)] opacity-60  border-t border-[var(--rule)] bg-[var(--surface-sunken)]/20">
                      End of activity history ({logTotalCount} total records)
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="px-3.5 py-2 border-t border-[var(--rule)] bg-[var(--surface-header)] flex items-center justify-between text-xs font-normal text-[var(--text-secondary)] ">
              <span>Scroll down to load older records automatically</span>
              <span className=" font-semibold text-[var(--text-primary)]">
                {recentLogs.length} / {logTotalCount} Scans
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
