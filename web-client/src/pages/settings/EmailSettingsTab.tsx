import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useOrganization } from '../../context/CompanyContext';
import { Mail, Server, Key, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

type Provider = 'Smtp' | 'SendGrid';

export const EmailSettingsTab: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [provider, setProvider] = useState<Provider>('Smtp');
  const [from, setFrom] = useState('');
  const [fromName, setFromName] = useState('HRDesk');
  // SMTP
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpUseSsl, setSmtpUseSsl] = useState(true);
  // SendGrid
  const [sendGridApiKey, setSendGridApiKey] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [currentOrganization?.id]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/settings/email');
      const d = res.data;
      setProvider((d.provider || 'Smtp') as Provider);
      setFrom(d.from || '');
      setFromName(d.fromName || 'HRDesk');
      setSmtpHost(d.smtpHost || '');
      setSmtpPort(d.smtpPort || '587');
      setSmtpUsername(d.smtpUsername || '');
      setSmtpPassword(d.smtpPassword || '');
      setSmtpUseSsl(d.smtpUseSsl !== 'false');
      setSendGridApiKey(d.sendGridApiKey || '');
      setIsConfigured(d.isConfigured || false);
    } catch {
      setError('Failed to load email settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!from.trim()) { setError('From email is required.'); return; }

    setSaving(true);
    try {
      await apiClient.post('/settings/email', {
        provider,
        from: from.trim(),
        fromName: fromName.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: smtpPort.trim(),
        smtpUsername: smtpUsername.trim(),
        smtpPassword: smtpPassword,
        smtpUseSsl: smtpUseSsl ? 'true' : 'false',
        sendGridApiKey: sendGridApiKey,
      });
      setSuccess('Email settings saved successfully.');
      setIsConfigured(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) { setError('Enter a test email address.'); return; }
    setError('');
    setSuccess('');
    setTesting(true);
    try {
      const res = await apiClient.post('/settings/email/test', { toEmail: testEmail.trim() });
      setSuccess(res.data.message || 'Test email sent!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Test email failed.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-[var(--text-muted)] py-8 text-center">Loading email settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status */}
      <div className="flex items-center gap-3">
        <Mail size={18} className="text-[var(--accent)]" />
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Email Configuration</h2>
          <p className="text-xs text-[var(--text-secondary)]">Configure email delivery for password resets, notifications, and alerts.</p>
        </div>
        <Badge variant={isConfigured ? 'success' : 'warning'} className="ml-auto">
          {isConfigured ? 'Configured' : 'Not Configured'}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)] text-xs flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] text-xs flex items-center gap-2">
            <CheckCircle2 size={14} /> {success}
          </div>
        )}

        {/* Provider Selection */}
        <Card>
          <CardTitle>Email Provider</CardTitle>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">Select how emails are delivered from your organization.</p>
          <div className="flex gap-3">
            {(['Smtp', 'SendGrid'] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`px-4 py-2.5 rounded-[var(--radius-md)] border text-xs font-medium cursor-pointer transition-all ${
                  provider === p
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]'
                }`}
              >
                {p === 'Smtp' ? '📧 SMTP (Gmail, Outlook, Custom)' : '⚡ SendGrid'}
              </button>
            ))}
          </div>
        </Card>

        {/* Common Settings */}
        <Card>
          <CardTitle>Sender Details</CardTitle>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">From Email *</label>
              <input
                type="email"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="noreply@yourcompany.com"
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">From Name</label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="HRDesk"
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </Card>

        {/* SMTP Settings */}
        {provider === 'Smtp' && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Server size={15} className="text-[var(--accent)]" />
              <CardTitle>SMTP Server Settings</CardTitle>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">SMTP Host *</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Port</label>
                <input
                  type="text"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Username *</label>
                <input
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="your@gmail.com"
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password / App Password *</label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                id="smtpSsl"
                checked={smtpUseSsl}
                onChange={(e) => setSmtpUseSsl(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <label htmlFor="smtpSsl" className="text-xs text-[var(--text-primary)] cursor-pointer">Enable SSL/TLS</label>
            </div>

            {/* Quick presets */}
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <p className="text-[11px] text-[var(--text-muted)] mb-2">Quick presets:</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Gmail', host: 'smtp.gmail.com', port: '587' },
                  { label: 'Outlook', host: 'smtp.office365.com', port: '587' },
                  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: '587' },
                  { label: 'Zoho', host: 'smtp.zoho.com', port: '587' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setSmtpHost(preset.host); setSmtpPort(preset.port); setSmtpUseSsl(true); }}
                    className="px-2.5 py-1 text-[11px] rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* SendGrid Settings */}
        {provider === 'SendGrid' && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Key size={15} className="text-[var(--accent)]" />
              <CardTitle>SendGrid API Key</CardTitle>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key *</label>
              <input
                type="password"
                value={sendGridApiKey}
                onChange={(e) => setSendGridApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">SendGrid Dashboard</a></p>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 cursor-pointer">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Test Email Section */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Send size={15} className="text-[var(--accent)]" />
          <CardTitle>Send Test Email</CardTitle>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">Verify your configuration by sending a test email.</p>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="recipient@email.com"
            className="flex-1 px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing || !isConfigured}
            className="btn-secondary px-4 py-2 text-sm font-medium disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <Send size={14} /> {testing ? 'Sending...' : 'Send Test'}
          </button>
        </div>
        {!isConfigured && (
          <p className="text-[11px] text-[var(--warning)] mt-2">Save your settings first before sending a test email.</p>
        )}
      </Card>
    </div>
  );
};
