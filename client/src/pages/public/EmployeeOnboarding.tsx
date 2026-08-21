import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, User, Building, Briefcase, Camera, FileText, Trash2, Plus } from 'lucide-react';
import { Input } from '../../components/ui/Input';

export const EmployeeOnboarding: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{ type: string, file: File }[]>([]);

  const [form, setForm] = useState({
    dateOfBirth: '',
    gender: 'Male',
    bloodGroup: 'O+',
    maritalStatus: 'Single',
    phone: '',
    personalEmail: '',
    currentAddress: '',
    permanentAddress: '',
  });

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`/api/public/onboarding/${token}`);
        setEmployeeData(res.data);
        setLoading(false);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Invalid or expired onboarding link.');
        setLoading(false);
      }
    };
    if (token) {
      fetchDetails();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await axios.post(`/api/public/onboarding/${token}`, form);

      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        await axios.post(`/api/public/onboarding/${token}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      for (const doc of documents) {
        const docData = new FormData();
        docData.append('documentType', doc.type);
        docData.append('file', doc.file);
        await axios.post(`/api/public/onboarding/${token}/documents`, docData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--gold-500)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[var(--paper)] p-8 rounded-lg shadow max-w-md w-full text-center border border-red-200">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--ink)] mb-2">Oops!</h2>
          <p className="text-[var(--ink-muted)]">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[var(--paper)] p-8 rounded-lg shadow max-w-md w-full text-center border border-emerald-200">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--ink)] mb-2">All Done!</h2>
          <p className="text-[var(--ink-muted)]">
            Your details have been submitted successfully. Welcome aboard, {employeeData?.employeeName}!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col py-10 px-4 items-center">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="bg-[var(--navy-900)] text-white p-6 rounded-t-xl">
          <h1 className="text-2xl font-bold mb-1">Welcome to the Team, {employeeData?.employeeName}!</h1>
          <p className="text-white/70 text-sm">Please complete your profile to finalize your onboarding.</p>
          
          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-white/10">
            {employeeData?.department && (
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Building size={14} className="text-[var(--gold-500)]" />
                {employeeData.department}
              </div>
            )}
            {employeeData?.designation && (
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Briefcase size={14} className="text-[var(--gold-500)]" />
                {employeeData.designation}
              </div>
            )}
            {employeeData?.branch && (
              <div className="flex items-center gap-2 text-sm text-white/80">
                <User size={14} className="text-[var(--gold-500)]" />
                {employeeData.branch}
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-[var(--paper)] rounded-b-xl shadow p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Photo Upload Section */}
            <div className="flex flex-col items-center pb-6 border-b border-[var(--rule)]">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-2 border-[var(--rule)] bg-[var(--surface)] overflow-hidden flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-[var(--ink-muted)]" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-1.5 bg-[var(--gold-500)] rounded-full text-white cursor-pointer shadow hover:bg-[var(--gold-600)] transition-colors">
                  <Camera size={14} />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/jpg,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (file.size > 5 * 1024 * 1024) {
                          alert("Photo must be less than 5MB");
                          return;
                        }
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </div>
              <span className="text-xs text-[var(--ink-muted)] mt-2">Upload Profile Photo (Max 5MB)</span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)] border-b pb-2 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Date of Birth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
                
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Gender</label>
                  <select
                    className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] px-3 py-2 text-sm text-[var(--ink)] focus:border-indigo-500 outline-none"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Blood Group</label>
                  <select
                    className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] px-3 py-2 text-sm text-[var(--ink)] focus:border-indigo-500 outline-none"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  >
                    <option>A+</option><option>A-</option>
                    <option>B+</option><option>B-</option>
                    <option>O+</option><option>O-</option>
                    <option>AB+</option><option>AB-</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Marital Status</label>
                  <select
                    className="w-full bg-[var(--paper)] border border-[var(--rule)] rounded-[4px] px-3 py-2 text-sm text-[var(--ink)] focus:border-indigo-500 outline-none"
                    value={form.maritalStatus}
                    onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  >
                    <option>Single</option>
                    <option>Married</option>
                    <option>Divorced</option>
                    <option>Widowed</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)] border-b pb-2 mb-4">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  type="tel"
                  required
                  placeholder="+91 "
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label="Personal Email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={form.personalEmail}
                  onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Current Address"
                    required
                    placeholder="Full current address"
                    value={form.currentAddress}
                    onChange={(e) => {
                      setForm(prev => ({
                        ...prev,
                        currentAddress: e.target.value,
                        ...(sameAsCurrent ? { permanentAddress: e.target.value } : {})
                      }));
                    }}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="sameAddress"
                      checked={sameAsCurrent}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSameAsCurrent(checked);
                        if (checked) {
                          setForm(prev => ({ ...prev, permanentAddress: prev.currentAddress }));
                        }
                      }}
                      className="rounded border-[var(--rule)] text-[var(--gold-500)] focus:ring-[var(--gold-500)] cursor-pointer"
                    />
                    <label htmlFor="sameAddress" className="text-xs text-[var(--ink)] cursor-pointer select-none">
                      Permanent Address is same as Current Address
                    </label>
                  </div>
                  <Input
                    label="Permanent Address"
                    required
                    placeholder="Full permanent address"
                    value={form.permanentAddress}
                    onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
                    disabled={sameAsCurrent}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)] border-b pb-2 mb-4">Verification Documents</h3>
              <div className="space-y-4">
                {documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
                    <FileText className="text-[var(--gold-500)]" size={18} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--ink)]">{doc.type}</p>
                      <p className="text-[10px] text-[var(--ink-muted)] font-mono">{doc.file.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocuments(docs => docs.filter((_, i) => i !== index))}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                
                <div className="flex items-center gap-2">
                  <select
                    id="docTypeSelect"
                    className="register-input text-xs flex-1"
                    defaultValue=""
                  >
                    <option value="" disabled>Select Document Type...</option>
                    <option value="Aadhar Card">Aadhar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Passport">Passport</option>
                    <option value="10th Marksheet / Certificate">10th Marksheet / Certificate</option>
                    <option value="12th Marksheet / Certificate">12th Marksheet / Certificate</option>
                    <option value="Degree Certificate">Degree Certificate</option>
                    <option value="Post Graduation Certificate">Post Graduation Certificate</option>
                    <option value="Resume">Resume / CV</option>
                    <option value="Bank Passbook">Bank Passbook / Cheque</option>
                    <option value="Offer Letter Signed">Signed Offer Letter</option>
                    <option value="Others">Others</option>
                  </select>
                  <label className="btn-outline flex items-center gap-1.5 px-3 py-2 cursor-pointer text-xs h-full">
                    <Plus size={14} /> Add File
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const typeSelect = document.getElementById('docTypeSelect') as HTMLSelectElement;
                        const type = typeSelect.value;
                        if (!type) {
                          alert('Please select a document type first.');
                          e.target.value = '';
                          return;
                        }
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.size > 10 * 1024 * 1024) {
                            alert("Document must be less than 10MB");
                            return;
                          }
                          setDocuments([...documents, { type, file }]);
                          typeSelect.value = '';
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-[var(--gold-500)] hover:bg-[var(--gold-600)] text-white px-6 py-2.5 rounded shadow-sm font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Complete Onboarding'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="text-center mt-6 text-xs text-[var(--ink-muted)]">
          &copy; {new Date().getFullYear()} HRDesk. Powered by Antigravity.
        </div>
      </div>
    </div>
  );
};
