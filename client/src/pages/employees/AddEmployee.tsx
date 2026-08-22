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
      // roleId comes from a <select> as a string; convert to int or null before posting
      // so the backend's int? DTO can deserialize it correctly.
      const payload = {
        ...data,
        roleId: data.roleId !== '' ? parseInt(data.roleId, 10) : null,
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
