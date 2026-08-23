import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Camera, Loader2, Search, Pencil } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/PageSkeleton';
import { AuthImage } from '../../components/ui/AuthImage';
import { EmployeeDetailsTab } from '../../components/employees/EmployeeDetailsTab';
import { EmployeeDocumentsTab } from '../../components/employees/EmployeeDocumentsTab';
import { EmployeeAttendanceTab } from '../../components/employees/EmployeeAttendanceTab';
import { EmployeeLeavesTab } from '../../components/employees/EmployeeLeavesTab';
import { EmployeeIdCardTab } from '../../components/employees/EmployeeIdCardTab';

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const ViewEmployee: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, isAdmin } = useAuth();
  const { showError, showSuccess } = useToast();
  
  const [employee, setEmployee] = useState<any>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sidebarPage, setSidebarPage] = useState(1);
  const [hasMoreSidebar, setHasMoreSidebar] = useState(true);
  const [loadingSidebar, setLoadingSidebar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

  // Tab state is stored in the URL as ?tab=... for bookmarkability
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['details', 'attendance', 'leaves', 'records', 'idcard'] as const;
  type TabKey = typeof VALID_TABS[number];
  const rawTab = searchParams.get('tab') as TabKey | null;
  const profileTab: TabKey = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'details';

  const setProfileTab = (tab: TabKey) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev; }, { replace: true });
  };

  const canEdit = isAdmin || hasPermission('Employees.Edit');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page when search changes
  useEffect(() => {
    setSidebarPage(1);
    setAllEmployees([]);
    setHasMoreSidebar(true);
    isFetchingRef.current = false;
  }, [debouncedSearch]);

  // Fetch employees for sidebar
  useEffect(() => {
    const fetchSidebarEmployees = async () => {
      if (!hasMoreSidebar) return;
      try {
        setLoadingSidebar(true);
        isFetchingRef.current = true;
        const res = await apiClient.get('/employees', {
          params: { 
            page: sidebarPage, 
            pageSize: 20, 
            status: 'active',
            search: debouncedSearch || undefined 
          }
        });
        
        const newItems = res.data.items || [];
        setAllEmployees(prev => sidebarPage === 1 ? newItems : [...prev, ...newItems]);
        setHasMoreSidebar(sidebarPage < (res.data.totalPages || 1));
      } catch (err) {
        console.error('Failed to load employees list for sidebar', err);
      } finally {
        setLoadingSidebar(false);
        isFetchingRef.current = false;
      }
    };

    fetchSidebarEmployees();
  }, [sidebarPage, debouncedSearch]);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        // `id` here is the opaque PublicId (GUID) used in the URL, not the internal integer EmployeeId.
        const res = await apiClient.get(`/employees/${id}`);
        setEmployee(res.data);
      } catch (err) {
        showError('Error', 'Failed to load employee details.');
        navigate('/employees');
      }
    };
    if (id) {
      fetchEmployee();
    }
  }, [id, navigate, showError]);

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - Math.ceil(scrollTop) <= clientHeight + 50 && !isFetchingRef.current && hasMoreSidebar) {
      isFetchingRef.current = true;
      setSidebarPage(prev => prev + 1);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !employee) return;
    
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError('File too large', 'Please upload a photo smaller than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setUploadingPhoto(true);
      const res = await apiClient.post(`/employees/${employee.employeeId}/photo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      showSuccess('Photo Updated', 'Employee profile picture has been updated.');
      
      setEmployee((prev: any) => ({
        ...prev,
        photoPath: res.data.photoPath  // versioned URL from server e.g. /api/Thumbnail?employeeId=7&v=1234567890
      }));
      
    } catch (err: any) {
      showError('Upload Failed', err.response?.data?.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!employee) {
    return <div className="p-8"><PageSkeleton /></div>;
  }

  return (
    <div className="flex bg-[var(--canvas)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--rule)] shadow-sm" style={{ height: 'calc(100vh - 112px)' }}>
      {/* Sidebar Navigation */}
      <div className="w-72 border-r border-[var(--rule)] bg-[var(--surface)] hidden md:flex flex-col shrink-0 z-10">
        <div className="p-4 border-b border-[var(--rule)]">
          <h2 className="font-display font-semibold text-[var(--ink)] mb-3">Directory</h2>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--ink-muted)]" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--canvas)] border border-[var(--rule)] rounded-[4px] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-[var(--gold-500)]"
            />
          </div>
        </div>
        <div 
          className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar"
          onScroll={handleSidebarScroll}
        >
          {allEmployees.map(emp => {
            const isSelected = emp.publicId === id;
            return (
              <Link 
                key={emp.employeeId} 
                to={`/employees/${emp.publicId}${profileTab !== 'details' ? `?tab=${profileTab}` : ''}`}
                className={`flex items-center gap-3 p-2 rounded-[4px] transition-colors cursor-pointer ${
                  isSelected 
                    ? 'bg-[var(--gold-500)]/10 border border-[var(--gold-500)]/30' 
                    : 'hover:bg-[var(--surface-sunken)] border border-transparent'
                }`}
              >
                {emp.photoPath ? (
                  <AuthImage 
                    src={`/Thumbnail?employeeId=${emp.employeeId}&t=${new Date(emp.photoPath.includes('&t=') ? parseInt(emp.photoPath.split('&t=')[1]) : 0).getTime()}`} 
                    alt={emp.employeeName} 
                    className="w-8 h-8 rounded-full object-cover shrink-0" 
                    fallbackInitial={emp.employeeName.charAt(0)}
                    fallbackClassName="w-8 h-8 rounded-full font-display text-xs shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--navy-900)] text-[var(--gold-500)] font-display text-xs flex items-center justify-center shrink-0">
                    {emp.employeeName.charAt(0)}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--gold-600)]' : 'text-[var(--ink)]'}`}>
                    {emp.employeeName}
                  </p>
                  <p className="text-[10px] text-[var(--ink-muted)] truncate">{emp.designation ? `${emp.designation} • ` : ''}{emp.employeeCode || `EMP#${String(emp.employeeId).padStart(3, '0')}`}</p>
                </div>
              </Link>
            );
          })}
          
          {loadingSidebar && (
            <div className="py-4 flex justify-center">
              <Loader2 size={16} className="animate-spin text-[var(--gold-500)]" />
            </div>
          )}
          
          {!loadingSidebar && allEmployees.length === 0 && (
            <div className="p-4 text-center text-xs text-[var(--ink-muted)]">
              No employees found.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex flex-col p-6 space-y-6 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/employees')}
              className="p-2 rounded-full hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold text-[var(--ink)]">Employee Profile</h1>
              <p className="text-sm text-[var(--ink-muted)] font-ui mt-1">Viewing details for {employee.employeeName}</p>
            </div>
          </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Header with Serif Name */}
        <div className="bg-[var(--surface-sunken)] p-6 border-b border-[var(--rule)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 relative">
          <div className="flex items-center justify-center sm:justify-start gap-4 text-center sm:text-left flex-1">
            <div 
              className="relative group cursor-pointer rounded-full" 
              onClick={() => canEdit && fileInputRef.current?.click()}
              title={canEdit ? "Click to change photo" : ""}
            >
              {employee.photoPath ? (
                <AuthImage 
                  src={`/Thumbnail?employeeId=${employee.employeeId}&t=${new Date(employee.photoPath.includes('&t=') ? parseInt(employee.photoPath.split('&t=')[1]) : 0).getTime()}`} 
                  alt={employee.employeeName} 
                  className={`w-16 h-16 rounded-full object-cover bg-[var(--paper)] border border-[var(--rule)] ${canEdit ? 'group-hover:opacity-75' : ''} transition-opacity`} 
                  fallbackInitial={employee.employeeName.charAt(0)}
                  fallbackClassName={`w-16 h-16 rounded-full font-display text-2xl shrink-0 ${canEdit ? 'group-hover:opacity-75' : ''} transition-opacity`}
                />
              ) : (
                <div className={`w-16 h-16 rounded-full bg-[var(--navy-900)] text-[var(--gold-500)] font-display text-2xl flex items-center justify-center shrink-0 ${canEdit ? 'group-hover:opacity-75' : ''} transition-opacity`}>
                  {employee.employeeName.charAt(0)}
                </div>
              )}
              
              {canEdit && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white drop-shadow-md" />
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/jpeg,image/png,image/gif,image/webp" 
                    onChange={handlePhotoUpload} 
                  />
                </>
              )}

              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
            </div>
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-[var(--paper)] border border-[var(--rule)] font-mono text-[11px] font-bold text-[var(--gold-600)] shadow-2xs mb-1">
                {employee.employeeCode || `EMP#${String(employee.employeeId).padStart(3, '0')}`}
              </span>
              <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                {employee.employeeName}
              </h2>
              <p className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wide font-semibold mt-1 flex items-center justify-center sm:justify-start gap-1.5 opacity-80 font-ui">
                {employee.designation ? `${employee.designation} | ` : ''}Joined: {formatDate(employee.joiningDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <Link
                to={`/employees/${employee.publicId}/edit`}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded bg-[var(--navy-900)] text-[var(--gold-500)] hover:bg-[var(--navy-800)] transition-colors"
              >
                <Pencil size={14} />
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--rule)] px-6 pt-3 bg-[var(--surface-sunken)] text-xs font-ui">
          <button
            onClick={() => setProfileTab('details')}
            className={`pb-2 px-4 font-semibold transition-colors cursor-pointer ${
              profileTab === 'details'
                ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setProfileTab('attendance')}
            className={`pb-2 px-4 font-semibold transition-colors cursor-pointer ${
              profileTab === 'attendance'
                ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            Attendance Summary
          </button>
          <button
            onClick={() => setProfileTab('leaves')}
            className={`pb-2 px-4 font-semibold transition-colors cursor-pointer ${
              profileTab === 'leaves'
                ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            Leaves
          </button>
          <button
            onClick={() => setProfileTab('records')}
            className={`pb-2 px-4 font-semibold transition-colors cursor-pointer ${
              profileTab === 'records'
                ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setProfileTab('idcard')}
            className={`pb-2 px-4 font-semibold transition-colors cursor-pointer ${
              profileTab === 'idcard'
                ? 'border-b-2 border-[var(--gold-500)] text-[var(--gold-500)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            ID Card
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--surface)]">
          {profileTab === 'details' && (
            <EmployeeDetailsTab employee={employee} />
          )}

          {profileTab === 'attendance' && (
            <EmployeeAttendanceTab employeeId={employee.employeeId} />
          )}

          {profileTab === 'leaves' && (
            <EmployeeLeavesTab employeeId={employee.employeeId} />
          )}

          {profileTab === 'records' && (
            <EmployeeDocumentsTab employeeId={employee.employeeId} />
          )}

          {profileTab === 'idcard' && (
            <EmployeeIdCardTab employee={employee} />
          )}
        </div>
      </div>
    </div>
    </div>
    </div>
  );
};
