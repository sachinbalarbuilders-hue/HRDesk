import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ShieldCheck, Building2, Briefcase, User as UserIcon } from 'lucide-react';
import axios from 'axios';

interface VerificationData {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string;
  branch: string;
  isActive: boolean;
  photoPath: string;
}

export const VerifyEmployee: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmployee = async () => {
      try {
        const response = await axios.get(`/api/Employees/${id}/public-verify`);
        setData(response.data);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Employee record not found in the system.');
        } else {
          setError('An error occurred during verification. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    verifyEmployee();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-[var(--gold-500)] border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-gray-500 font-medium tracking-wide">Verifying Identity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest border-t border-gray-100 pt-6">Security System</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 font-sans sm:justify-center">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden max-w-sm w-full">
        
        {/* Status Header */}
        <div className={`p-6 pb-16 text-center text-white ${data.isActive ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="flex justify-center mb-4">
            {data.isActive ? (
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <CheckCircle size={36} className="text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <XCircle size={36} className="text-white" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider mb-1">
            {data.isActive ? 'Active Employee' : 'Inactive'}
          </h1>
          <p className="text-white/80 text-xs font-semibold tracking-widest uppercase flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} /> ID Verified
          </p>
        </div>

        {/* Employee Details */}
        <div className="p-8 flex flex-col items-center relative">
          
          {/* Photo */}
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-100 mb-6 shrink-0 flex items-center justify-center -mt-16 relative z-10">
             {data.photoPath ? (
              <img 
                src={data.photoPath} 
                alt="" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden');
                }}
              />
            ) : null}
            <UserIcon size={56} className={`text-gray-300 ${data.photoPath ? 'hidden' : ''}`} />
          </div>

          <div className="text-center w-full mb-8">
            <h2 className="text-3xl font-black text-gray-900 leading-tight mb-2 font-display">{data.employeeName}</h2>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{data.employeeCode}</p>
          </div>

          <div className="w-full space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--gold-50)] flex items-center justify-center shrink-0">
                <Briefcase size={20} className="text-[var(--gold-600)]" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Designation</p>
                <p className="text-sm font-bold text-gray-900 truncate">{data.designation || 'N/A'}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{data.department || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--gold-50)] flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-[var(--gold-600)]" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Branch / Location</p>
                <p className="text-sm font-bold text-gray-900 truncate">{data.branch || 'Head Office'}</p>
              </div>
            </div>
          </div>
          
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
            This digital ID verification was generated at {new Date().toLocaleString()}.
            If you suspect fraud, contact Human Resources immediately.
          </p>
        </div>
      </div>
    </div>
  );
};
