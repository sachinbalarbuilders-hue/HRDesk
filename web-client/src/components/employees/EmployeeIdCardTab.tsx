import React, { useState } from 'react';
import { User, Droplet, Phone, Calendar, MapPin, Barcode } from 'lucide-react';
import { useOrganization } from '../../context/CompanyContext';
import { AuthImage } from '../ui/AuthImage';

interface EmployeeIdCardTabProps {
  employee: any;
}

export const EmployeeIdCardTab: React.FC<EmployeeIdCardTabProps> = ({ employee }) => {
  const { currentOrganization } = useOrganization();
  const [theme, setTheme] = useState<'classic' | 'modern' | 'dark'>('classic');
  
  const dob = employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-GB') : 'N/A';
  const orgName = employee.organizationName || currentOrganization?.name || employee.companyName || 'Company';
  const orgAddress = employee.organizationAddress || currentOrganization?.address || employee.branchAddress || 'Registered Corporate Office';
  const orgPhone = employee.companyPhone || employee.phone || '+91 98765 43210';
  const email = employee.workEmail || employee.personalEmail || 'contact@company.com';
  
  const qrData = `${window.location.origin}/verify/${employee.verificationId || employee.employeeId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;

  const renderClassic = () => (
    <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
      {/* Front */}
      <div className="w-[300px] h-[450px] rounded-xl overflow-hidden shadow-2xl bg-white border border-gray-200 flex flex-col relative font-sans shrink-0">
        {/* Left Gold Sidebar */}
        <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-b from-[var(--gold-500)] to-[var(--gold-600)] z-0"></div>
        {/* Top Header Logo Area */}
        <div className="pl-14 pr-6 pt-8 pb-4 z-10 flex flex-col">
          <h2 className="text-gray-900 font-black text-2xl leading-none uppercase tracking-widest font-display">
            {orgName}
          </h2>
          <span className="text-[var(--gold-600)] text-[9px] font-bold uppercase tracking-[0.3em] mt-1.5">Access Badge</span>
        </div>
        
        <div className="flex flex-col pl-14 pr-6 z-10 flex-1">
          <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50 mb-6 shrink-0 relative">
             {employee.photoPath ? (
              <AuthImage src={`/Thumbnail?employeeId=${employee.employeeId}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={50} className="text-gray-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          <div className="w-full flex-1">
            <h3 className="text-2xl font-black text-gray-900 leading-tight font-display mb-1">{employee.employeeName}</h3>
            <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">{employee.designation || 'Employee'}</p>
            {employee.department && <p className="text-[10px] font-semibold text-[var(--gold-600)] uppercase tracking-widest mt-1">{employee.department}</p>}
          </div>

          <div className="w-full space-y-3 text-xs mb-6 mt-4">
            <div>
              <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">ID NUMBER</p>
              <p className="font-bold text-gray-900 font-mono text-sm tracking-widest">{employee.employeeCode || `EMP#${String(employee.employeeId).padStart(3, '0')}`}</p>
            </div>
            <div className="w-full h-12 overflow-hidden opacity-60 flex items-center justify-start">
               <Barcode size={64} strokeWidth={1} className="text-gray-900 -ml-4" />
               <Barcode size={64} strokeWidth={1} className="text-gray-900 -ml-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Back */}
      <div className="w-[300px] h-[450px] rounded-xl overflow-hidden shadow-2xl bg-gray-50 border border-gray-200 flex flex-col relative font-sans shrink-0">
        <div className="absolute top-0 bottom-0 left-0 w-8 bg-gray-900 z-0 flex items-end pb-8 justify-center">
           <span className="text-gray-600 text-[10px] uppercase font-bold tracking-[0.4em] -rotate-90 whitespace-nowrap">Property of {orgName}</span>
        </div>
        
        <div className="flex-1 flex flex-col pl-14 pr-6 py-8 z-10 relative">
          <h4 className="text-[12px] uppercase font-bold text-gray-900 tracking-widest mb-6 border-b-2 border-[var(--gold-500)] pb-2 inline-block self-start">Employee Info</h4>
          
          <div className="absolute top-6 right-6 p-1.5 bg-white shadow-sm border border-gray-100 rounded-md">
            <img src={qrUrl} alt="QR Code" className="w-12 h-12" />
          </div>
          
          <div className="space-y-5 mb-auto">
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5"><Phone size={10}/> Phone</p>
              <p className="text-sm font-bold text-gray-800">{employee.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Email</p>
              <p className="text-xs font-bold text-gray-800 truncate">{email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5"><Calendar size={10}/> D.O.B</p>
                <p className="text-sm font-bold text-gray-800">{dob}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1.5"><Droplet size={10} className="text-red-400"/> Blood</p>
                <p className="text-sm font-bold text-red-600">{employee.bloodGroup || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3 pt-6 border-t border-gray-200">
            <div>
              <p className="text-[10px] font-bold text-gray-900 leading-tight">
                {orgName}<br/>
                <span className="font-medium text-gray-600 mt-0.5 inline-block">{orgAddress}</span>
              </p>
            </div>
            <p className="text-[8px] text-gray-500 leading-relaxed font-medium">
              This card is non-transferable. Misuse is a punishable offense. If found, please return to the address above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModern = () => (
    <div className="flex flex-col gap-6 justify-center items-center">
      {/* Front */}
      <div className="w-[450px] h-[280px] rounded-2xl overflow-hidden shadow-2xl bg-white border border-gray-100 flex relative font-sans shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60"></div>
        <div className="w-[140px] bg-gray-50 flex flex-col items-center py-6 border-r border-gray-100 shrink-0 z-10 justify-between">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md bg-white border-2 border-white flex items-center justify-center">
             {employee.photoPath ? (
              <AuthImage src={`/Thumbnail?employeeId=${employee.employeeId}`} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-gray-300" />
            )}
          </div>
          <div className="p-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <img src={qrUrl} alt="QR Code" className="w-12 h-12" />
          </div>
        </div>
        
        <div className="flex-1 p-6 z-10 flex flex-col justify-center">
          <h2 className="text-[var(--gold-600)] font-bold text-sm tracking-[0.2em] uppercase mb-6 font-display">{orgName}</h2>
          
          <h3 className="text-3xl font-black text-gray-900 leading-none tracking-tight mb-1">{employee.employeeName}</h3>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-8">{employee.designation || 'Employee'}</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">ID Number</p>
              <p className="font-mono text-sm font-bold text-gray-800 bg-gray-100 inline-block px-1.5 py-0.5 rounded">{employee.employeeCode || `EMP#${String(employee.employeeId).padStart(3, '0')}`}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Department</p>
              <p className="font-bold text-gray-800 text-sm">{employee.department || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Back */}
      <div className="w-[450px] h-[280px] rounded-2xl overflow-hidden shadow-2xl bg-gray-900 text-white flex flex-col relative font-sans shrink-0 border border-gray-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-500)] rounded-full blur-3xl -mr-32 -mt-32 opacity-20"></div>
        <div className="p-6 border-b border-gray-800 flex justify-between items-center z-10">
          <span className="font-bold tracking-[0.2em] uppercase text-[10px] text-gray-400">Employee Information</span>
          <span className="font-display font-bold text-white text-lg tracking-wider">{orgName}</span>
        </div>
        
        <div className="p-6 flex-1 flex flex-col z-10 relative">
          <div className="grid grid-cols-2 gap-6 mb-auto">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Contact</p>
              <p className="text-sm font-bold text-gray-200">{employee.phone || 'N/A'}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{email}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Calendar size={10}/> D.O.B</p>
                <p className="text-sm font-bold text-gray-200">{dob}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Droplet size={10} className="text-red-400"/> Blood</p>
                <p className="text-sm font-bold text-red-400">{employee.bloodGroup || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2 text-[10px] text-gray-400 leading-relaxed">
            <MapPin size={14} className="text-[var(--gold-500)] shrink-0 mt-0.5"/>
            <span>Property of {orgName}. If found, please return to:<br/>{orgAddress}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDark = () => (
    <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
      {/* Front */}
      <div className="w-[300px] h-[450px] rounded-xl overflow-hidden shadow-2xl bg-[#111] text-white border border-gray-800 flex flex-col relative font-sans shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#222] to-[#0a0a0a] z-0"></div>
        
        <div className="flex flex-col items-center pt-8 pb-6 px-6 z-10 h-full">
          <h2 className="text-[var(--gold-500)] font-bold text-lg leading-tight uppercase tracking-[0.3em] font-display mb-8">
            {orgName}
          </h2>
          
          <div className="w-36 h-36 rounded-full overflow-hidden border-[3px] border-[var(--gold-500)] shadow-[0_0_15px_rgba(212,175,55,0.3)] bg-gray-900 mb-6 shrink-0 flex items-center justify-center p-1 relative">
            <div className="w-full h-full rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
               {employee.photoPath ? (
                <AuthImage src={`/Thumbnail?employeeId=${employee.employeeId}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={50} className="text-gray-600" />
              )}
            </div>
          </div>
          
          <div className="text-center mb-auto w-full">
            <h3 className="text-2xl font-bold text-white leading-tight font-display mb-1">{employee.employeeName}</h3>
            <p className="text-[12px] font-medium text-gray-400 uppercase tracking-widest">{employee.designation || 'Executive'}</p>
          </div>

          <div className="w-full bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-sm text-center">
             <span className="text-gray-400 uppercase text-[10px] tracking-widest block mb-1">ID NUMBER</span>
             <span className="font-mono text-[var(--gold-500)] text-lg tracking-wider">{employee.employeeCode || `EMP#${String(employee.employeeId).padStart(3, '0')}`}</span>
          </div>
        </div>
      </div>

      {/* Back */}
      <div className="w-[300px] h-[450px] rounded-xl overflow-hidden shadow-2xl bg-[#111] text-white border border-gray-800 flex flex-col relative font-sans shrink-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#1a1a1a] to-[#0a0a0a] z-0"></div>
        <div className="h-2 bg-[var(--gold-500)] w-full shrink-0 z-10"></div>
        <div className="flex-1 flex flex-col p-8 z-10">
          
          <div className="space-y-5 mb-auto">
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-0.5 flex items-center gap-1.5"><Phone size={10}/> Phone / Emergency</p>
              <p className="text-sm font-medium text-gray-200">{employee.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-0.5 flex items-center gap-1.5"><Calendar size={10}/> Date of Birth</p>
              <p className="text-sm font-medium text-gray-200">{dob}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-0.5 flex items-center gap-1.5"><Droplet size={10}/> Blood Group</p>
              <p className="text-sm font-bold text-red-400">{employee.bloodGroup || 'N/A'}</p>
            </div>
          </div>
          
          <div className="text-center border-t border-white/10 pt-6">
            <div className="inline-block p-1.5 bg-white rounded-md mx-auto mb-4 opacity-90">
              <img src={qrUrl} alt="QR Code" className="w-12 h-12" />
            </div>
            <p className="text-[8px] text-gray-500 leading-relaxed">
              If found, please return to:<br/>
              <span className="text-gray-400">{orgName}</span><br/>
              {orgAddress}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Theme Switcher */}
      <div className="flex items-center justify-center gap-2 p-2 bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] shadow-sm">
        <button
          onClick={() => setTheme('classic')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
            theme === 'classic' ? 'bg-[var(--gold-500)] text-white shadow-sm' : 'text-[var(--ink-muted)] hover:bg-[var(--surface)]'
          }`}
        >
          Classic Corporate
        </button>
        <button
          onClick={() => setTheme('modern')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
            theme === 'modern' ? 'bg-gray-800 text-white shadow-sm' : 'text-[var(--ink-muted)] hover:bg-[var(--surface)]'
          }`}
        >
          Modern Tech
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors ${
            theme === 'dark' ? 'bg-[#111] text-[var(--gold-500)] shadow-sm' : 'text-[var(--ink-muted)] hover:bg-[var(--surface)]'
          }`}
        >
          Executive Dark
        </button>
      </div>

      {/* Card Display Area */}
      <div className="p-8 bg-gray-100 border border-[var(--rule)] rounded-[4px] overflow-x-auto">
        {theme === 'classic' && renderClassic()}
        {theme === 'modern' && renderModern()}
        {theme === 'dark' && renderDark()}
      </div>
    </div>
  );
};
