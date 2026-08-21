import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Camera, Loader2, MapPin, Pencil, Phone, Search } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/PageSkeleton';
import { AuthImage } from '../../components/ui/AuthImage';
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
  const [profileTab, setProfileTab] = useState<'details' | 'attendance' | 'leaves' | 'records' | 'idcard'>('details');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false);

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
        photoPath: `${res.data.photoPath}&t=${new Date().getTime()}`
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
            const isSelected = emp.employeeId.toString() === id;
            return (
              <Link 
                key={emp.employeeId} 
                to={`/employees/${emp.employeeId}`}
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
                  <p className="text-[10px] text-[var(--ink-muted)] truncate">{emp.designation || 'Staff'} • #{emp.employeeId}</p>
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
              <span className="text-[10px] uppercase font-semibold text-[var(--gold-500)] font-data">
                ID: #{employee.employeeId}
              </span>
              <h2 className="font-display text-2xl font-semibold text-[var(--ink)] mt-0.5">
                {employee.employeeName}
              </h2>
              <p className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wide font-semibold mt-1 flex items-center justify-center sm:justify-start gap-1.5 opacity-80 font-ui">
                {employee.designation || 'Staff'} &nbsp;|&nbsp; Joined: {formatDate(employee.joiningDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <Link
                to={`/employees/${employee.employeeId}/edit`}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Department</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.department || 'Unassigned'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Designation</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.designation || 'Staff Member'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Reporting Manager</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.reportingManager || 'None'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Weekly Off</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.weekoff || 'Sunday'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Employment Type</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.employmentType || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Attendance Type</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.attendanceType || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Date of Birth</span>
                  <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{formatDate(employee.dateOfBirth)}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Gender</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.gender || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Blood Group</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.bloodGroup || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Marital Status</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.maritalStatus || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Nationality</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">{employee.nationality || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] overflow-hidden">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Work Email</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5 truncate" title={employee.workEmail}>{employee.workEmail || '-'}</p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] overflow-hidden">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Personal Email</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5 truncate" title={employee.personalEmail}>{employee.personalEmail || '-'}</p>
                </div>
              </div>

              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Current Address</span>
                <p className="font-semibold text-[var(--ink)] mt-0.5 whitespace-pre-wrap">{employee.currentAddress || '-'}</p>
              </div>
              
              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Permanent Address</span>
                <p className="font-semibold text-[var(--ink)] mt-0.5 whitespace-pre-wrap">{employee.permanentAddress || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)]">
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Probation Details</span>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">
                    {employee.hasProbation ? `Yes, ${employee.probationDays} days` : 'No Probation'}
                  </p>
                </div>
                <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Assigned Branch</span>
                    <MapPin size={13} className="text-[var(--gold-500)]" />
                  </div>
                  <p className="font-semibold text-[var(--ink)] mt-0.5">
                    {employee.branch || 'No Branch Assigned'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-[4px] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-between md:col-span-2">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--ink-muted)] font-ui">Phone Number</span>
                  <p className="font-data font-semibold text-[var(--ink)] mt-0.5">{employee.phone || '-'}</p>
                </div>
                <Phone size={16} className="text-[var(--ink-muted)]" />
              </div>
            </div>
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
