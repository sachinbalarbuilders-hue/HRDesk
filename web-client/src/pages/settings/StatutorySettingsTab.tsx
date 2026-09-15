import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui';
import { Input } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../api/client';
import { Save, RefreshCw } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';

export const StatutorySettingsTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    pfEmployeeRate: '12',
    pfEmployerRate: '12',
    esiEmployeeRate: '0.75',
    esiEmployerRate: '3.25',
    esiGrossCeiling: '21000'
  });

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/settings/statutory');
      const data = res.data;
      if (data) {
        setFormData({
          pfEmployeeRate: String(data.pfEmployeeRate ?? '12'),
          pfEmployerRate: String(data.pfEmployerRate ?? '12'),
          esiEmployeeRate: String(data.esiEmployeeRate ?? '0.75'),
          esiEmployerRate: String(data.esiEmployerRate ?? '3.25'),
          esiGrossCeiling: String(data.esiGrossCeiling ?? '21000')
        });
      }
    } catch (err: any) {
      showError('Error', 'Failed to load statutory settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await apiClient.post('/settings/statutory', {
        pfEmployeeRate: Number(formData.pfEmployeeRate),
        pfEmployerRate: Number(formData.pfEmployerRate),
        esiEmployeeRate: Number(formData.esiEmployeeRate),
        esiEmployerRate: Number(formData.esiEmployerRate),
        esiGrossCeiling: Number(formData.esiGrossCeiling)
      });
      showSuccess('Success', 'Statutory limits updated successfully');
    } catch (err: any) {
      showError('Error', 'Failed to update statutory settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center text-[var(--ink-lighter)]">
        <RefreshCw className="animate-spin mr-2" size={16} /> Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertBanner 
        type="warning"
        title="System Wide Limits"
        message="The percentages set here will globally apply to all employees in the system for Provident Fund (EPF) and Employee State Insurance (ESI) deductions. Ensure these match the latest government gazette notifications."
      />

      <Card>
        <CardHeader>
          <CardTitle>Provident Fund (EPF)</CardTitle>
          <CardDescription>Configure the standard percentage limits for EPF</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink)]">Employee Contribution Rate (%)</label>
              <Input
                type="number"
                name="pfEmployeeRate"
                value={formData.pfEmployeeRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-[10px] text-[var(--ink-lighter)]">Statutory rate is usually 12%.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink)]">Employer Contribution Rate (%)</label>
              <Input
                type="number"
                name="pfEmployerRate"
                value={formData.pfEmployerRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-[10px] text-[var(--ink-lighter)]">Statutory rate is usually 12%.</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee State Insurance (ESI)</CardTitle>
          <CardDescription>Configure ESI percentage rates and eligibility ceiling</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink)]">Employee Contribution Rate (%)</label>
              <Input
                type="number"
                name="esiEmployeeRate"
                value={formData.esiEmployeeRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-[10px] text-[var(--ink-lighter)]">Statutory rate is usually 0.75%.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink)]">Employer Contribution Rate (%)</label>
              <Input
                type="number"
                name="esiEmployerRate"
                value={formData.esiEmployerRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.01"
              />
              <p className="text-[10px] text-[var(--ink-lighter)]">Statutory rate is usually 3.25%.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink)]">ESI Gross Wage Ceiling (₹)</label>
              <Input
                type="number"
                name="esiGrossCeiling"
                value={formData.esiGrossCeiling}
                onChange={handleChange}
                min="0"
              />
              <p className="text-[10px] text-[var(--ink-lighter)]">Employees earning above this gross are exempt from ESI (usually ₹21,000).</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
          Save Statutory Limits
        </button>
      </div>
    </div>
  );
};
