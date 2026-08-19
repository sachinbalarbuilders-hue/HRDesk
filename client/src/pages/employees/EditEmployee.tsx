import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useOrganization } from '../../context/CompanyContext';
import { EmployeeForm, type EmployeeFormData } from '../../components/forms/EmployeeForm';
import { ArrowLeft } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

export const EditEmployee: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const { currentOrganization } = useOrganization();
  
  const [lookups, setLookups] = useState<any>(null);
  const [employee, setEmployee] = useState<Partial<EmployeeFormData> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lookupsRes, empRes] = await Promise.all([
          apiClient.get('/employees/lookups'),
          apiClient.get(`/employees/${id}`)
        ]);
        setLookups(lookupsRes.data);
        setEmployee(empRes.data);
      } catch (err) {
        showError('Error', 'Failed to load employee details.');
        navigate('/employees');
      }
    };
    if (id) fetchData();
  }, [id, currentOrganization?.id, showError, navigate]);

  const handleSubmit = async (data: EmployeeFormData) => {
    try {
      setSubmitting(true);
      await apiClient.put(`/employees/${id}`, data);
      showSuccess('Success', 'Employee updated successfully.');
      navigate(`/employees/${id}`);
    } catch (err: any) {
      showError('Error', err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!lookups || !employee) {
    return <div className="p-8"><PageSkeleton /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--canvas)] p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(`/employees/${id}`)}
          className="p-2 rounded-full hover:bg-[var(--surface-sunken)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)]">Edit Employee</h1>
          <p className="text-sm text-[var(--ink-muted)] font-ui mt-1">Updating profile for {employee.employeeName}</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--rule)] rounded-[4px] shadow-sm p-6 overflow-visible">
        <EmployeeForm 
          initialData={employee}
          lookups={lookups}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/employees/${id}`)}
          isSubmitting={submitting}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
};
