import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/CompanyContext';
import { EmployeeForm, type EmployeeFormData } from '../../components/forms/EmployeeForm';
import { ArrowLeft } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

export const AddEmployee: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const { currentOrganization } = useOrganization();
  const [lookups, setLookups] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const res = await apiClient.get('/employees/lookups');
        setLookups(res.data);
      } catch (err) {
        showError('Error', 'Failed to load form lookups.');
      }
    };
    fetchLookups();
  }, [currentOrganization?.id, showError]);

  const handleSubmit = async (data: EmployeeFormData) => {
    try {
      setSubmitting(true);
      // All numeric/date fields come from <select> and <input> as strings.
      // Coerce them to the correct types (int, date, or null) before posting
      // so the backend's typed DTO can deserialize without a 400.
      const toInt = (v: any) => (v !== '' && v != null && !isNaN(Number(v))) ? parseInt(v, 10) : null;
      const toDate = (v: any) => (v !== '' && v != null) ? v : null;
      const payload = {
        ...data,
        employeeId:        toInt(data.employeeId),
        departmentId:      toInt(data.departmentId),
        designationId:     toInt(data.designationId),
        reportingManagerId: toInt(data.reportingManagerId),
        branchId:          toInt(data.branchId),
        roleId:            toInt(data.roleId),
        dateOfBirth:       toDate(data.dateOfBirth),
        joiningDate:       toDate(data.joiningDate),
        contractEndDate:   toDate(data.contractEndDate),
      };
      await apiClient.post('/employees', payload);
      showSuccess('Success', 'Employee created successfully.');
      navigate('/employees');
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to create employee.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!lookups) {
    return <div className="p-8"><PageSkeleton /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--canvas)] p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/employees')}
          className="p-2 rounded-full hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)]">Add New Employee</h1>
          <p className="text-sm text-[var(--ink-muted)] font-ui mt-1">Enter details to onboard a new team member.</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-sm p-6 overflow-visible">
        <EmployeeForm 
          lookups={lookups}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/employees')}
          isSubmitting={submitting}
          submitLabel="Create Employee Profile"
        />
      </div>
    </div>
  );
};
