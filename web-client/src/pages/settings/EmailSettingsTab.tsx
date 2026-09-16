import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import {
  Mail,
  Server,
  Key,
  Send,
  Save,
  RefreshCw,
  Globe,
  Lock,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { AlertBanner } from '../../components/ui/AlertBanner';

type Provider = 'Smtp' | 'SendGrid';

interface SmtpPreset {
  label: string;
  host: string;
  port: string;
  ssl: boolean;
}

const SMTP_PRESETS: SmtpPreset[] = [
  { label: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: '587', ssl: true },
  { label: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: '587', ssl: true },
  { label: 'Zoho Mail', host: 'smtp.zoho.com', port: '587', ssl: true },
  { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: '587', ssl: true },
];

export const EmailSettingsTab: React.FC = () => {
  const { currentOrganization, currentBranch } = useOrganization();
  const { showSuccess, showError } = useToast();

  const [provider, setProvider] = useState<Provider>('Smtp');
  const [from, setFrom] = useState('');
  const [fromName, setFromName] = useState('HRDesk');

  // SMTP Fields
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpUseSsl, setSmtpUseSsl] = useState(true);

  // SendGrid Fields
  const [sendGridApiKey, setSendGridApiKey] = useState('');

  // States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [currentOrganization?.id, currentBranch?.id]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setErrorBanner('');
      const res = await apiClient.get('/settings/email');
      const d = res.data;
      setProvider((d.provider || 'Smtp') as Provider);
      setFrom(d.from || '');
      setFromName(d.fromName || (currentOrganization?.name ? `${currentOrganization.name} HRDesk` : 'HRDesk'));
      setSmtpHost(d.smtpHost || '');
      setSmtpPort(d.smtpPort || '587');
      setSmtpUsername(d.smtpUsername || '');
      setSmtpPassword(d.smtpPassword || '');
      setSmtpUseSsl(d.smtpUseSsl !== 'false');
      setSendGridApiKey(d.sendGridApiKey || '');
      setIsConfigured(d.isConfigured || false);
    } catch {
      setErrorBanner('Failed to load email configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (preset: SmtpPreset) => {
    setSmtpHost(preset.host);
    setSmtpPort(preset.port);
    setSmtpUseSsl(preset.ssl);
    showSuccess('Preset Applied', `Loaded default host (${preset.host}) and port (${preset.port}).`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner('');
    setSuccessBanner('');

    if (!from.trim()) {
      setErrorBanner('From email address is required.');
      return;
    }

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

      setSuccessBanner('Email configuration updated successfully.');
      showSuccess('Saved', 'Email settings saved successfully.');
      setIsConfigured(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save email settings.';
      setErrorBanner(msg);
      showError('Save Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      showError('Required', 'Please enter a valid recipient email address.');
      return;
    }

    setErrorBanner('');
    setSuccessBanner('');
    setTesting(true);

    try {
      const res = await apiClient.post('/settings/email/test', { toEmail: testEmail.trim() });
      const msg = res.data.message || `Test dispatch sent successfully to ${testEmail.trim()}.`;
      setSuccessBanner(msg);
      showSuccess('Test Dispatch', msg);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to send test email. Please check credentials and server logs.';
      setErrorBanner(msg);
      showError('Dispatch Failed', msg);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
        <RefreshCw size={14} className="animate-spin text-[var(--accent)]" /> Loading email configuration...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. Header & Register Stamped Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs">
              <Mail size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Email Delivery Service
                </h2>
                <Badge variant={isConfigured ? 'success' : 'neutral'} dot>
                  {isConfigured ? 'Configured & Active' : 'Unconfigured'}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Configure outgoing mail transport for user onboarding, password resets, payslips, and administrative alerts.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading || saving}
          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          title="Reload configuration from server"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      {/* 2. Feedback Banners */}
      {errorBanner && (
        <AlertBanner
          type="error"
          title="Email Configuration Error"
          message={errorBanner}
          onDismiss={() => setErrorBanner('')}
        />
      )}
      {successBanner && (
        <AlertBanner
          type="success"
          title="Email Configuration Saved"
          message={successBanner}
          onDismiss={() => setSuccessBanner('')}
        />
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 3. Provider Selection (Administrative Radio Cards) */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Protocol</CardTitle>
            <CardDescription>Select the mail transport provider utilized by this organization.</CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SMTP Card */}
            <div
              onClick={() => setProvider('Smtp')}
              className={`p-4 rounded-[var(--radius-md)] border text-left flex items-start gap-3 transition-all cursor-pointer ${
                provider === 'Smtp'
                  ? 'bg-[var(--surface-secondary)] border-[var(--text-primary)] shadow-xs ring-1 ring-[var(--text-primary)]'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div
                className={`p-2 rounded-[var(--radius-sm)] shrink-0 ${
                  provider === 'Smtp'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <Server size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">SMTP Server</span>
                  {provider === 'Smtp' && (
                    <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px]">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug">
                  Connect to Google Workspace, Microsoft 365, Zoho Mail, or custom SMTP host.
                </p>
              </div>
            </div>

            {/* SendGrid Card */}
            <div
              onClick={() => setProvider('SendGrid')}
              className={`p-4 rounded-[var(--radius-md)] border text-left flex items-start gap-3 transition-all cursor-pointer ${
                provider === 'SendGrid'
                  ? 'bg-[var(--surface-secondary)] border-[var(--text-primary)] shadow-xs ring-1 ring-[var(--text-primary)]'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div
                className={`p-2 rounded-[var(--radius-sm)] shrink-0 ${
                  provider === 'SendGrid'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}
              >
                <Key size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">SendGrid API</span>
                  {provider === 'SendGrid' && (
                    <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px]">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-snug">
                  High-reliability cloud transactional email delivery through Twilio SendGrid API.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Sender Identity Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sender Identity</CardTitle>
            <CardDescription>
              The display name and mailbox address recipients will see in their email client.
            </CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="From Email Address"
              type="email"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="notifications@yourcompany.com"
              required
              icon={<Mail size={14} />}
              helperText="Must be an authorized sender or verified domain."
            />
            <Input
              label="From Display Name"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="HRDesk / Setu Developers"
              icon={<Globe size={14} />}
              helperText="e.g. Setu Developers HR Desk"
            />
          </div>
        </Card>

        {/* 5. Provider-Specific Credentials */}
        {provider === 'Smtp' ? (
          <Card>
            <CardHeader
              actions={
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <Server size={13} className="text-[var(--text-secondary)]" /> Standard Port: 587 (STARTTLS)
                </div>
              }
            >
              <CardTitle>SMTP Server Credentials</CardTitle>
              <CardDescription>
                Specify the outgoing SMTP relay host, port, and authentication credentials.
              </CardDescription>
            </CardHeader>

            <div className="space-y-4">
              {/* Presets bar */}
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] border border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--text-secondary)] block mb-2">
                  Quick Provider Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SMTP_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-xs"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="SMTP Host"
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    required
                    icon={<Server size={14} />}
                  />
                </div>
                <div>
                  <Input
                    label="Port"
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    required
                  />
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="SMTP Username / Account"
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="admin@yourcompany.com"
                  icon={<Mail size={14} />}
                  helperText="Full email address used to authenticate."
                />
                <Input
                  label="SMTP Password / App Password"
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  icon={<Lock size={14} />}
                  helperText="For Gmail, use a 16-character Google App Password."
                />
              </div>

              {/* SSL / TLS Toggle */}
              <div className="pt-2 border-t border-[var(--border)]">
                <Switch
                  checked={smtpUseSsl}
                  onChange={setSmtpUseSsl}
                  label="Enable SSL / TLS Encryption"
                  description="Enforces encrypted channel via STARTTLS (Port 587) or SSL (Port 465). Recommended for all modern mail servers."
                />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>SendGrid API Credentials</CardTitle>
              <CardDescription>
                Authenticate with your Twilio SendGrid API Key for high-volume delivery.
              </CardDescription>
            </CardHeader>

            <div className="space-y-3">
              <Input
                label="SendGrid API Key"
                type="password"
                value={sendGridApiKey}
                onChange={(e) => setSendGridApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                icon={<Key size={14} />}
                helperText="Must have 'Mail Send' full-access permission in SendGrid."
              />
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                <HelpCircle size={12} />
                <span>You can generate an API key from your{' '}</span>
                <a
                  href="https://app.sendgrid.com/settings/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-primary)] font-medium underline hover:text-[var(--accent)]"
                >
                  SendGrid Dashboard Settings → API Keys
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* 6. Save Action Bar */}
        <div className="flex items-center justify-between p-4 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <p className="text-xs text-[var(--text-secondary)]">
            Saved credentials are encrypted and stored per organization tenant.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-2 px-5 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={13} /> Save Configuration
              </>
            )}
          </button>
        </div>
      </form>

      {/* 7. Diagnostic Test Dispatch Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border)]">
              <Send size={13} />
            </div>
            <CardTitle>Send Diagnostic Test Email</CardTitle>
          </div>
          <CardDescription>
            Verify server handshakes, DNS records, and authentication by dispatching a live test message.
          </CardDescription>
        </CardHeader>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <Input
                label="Recipient Email Address"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@company.com"
                icon={<Mail size={14} />}
              />
            </div>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testing || !isConfigured}
              className="btn-secondary py-2 px-4 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {testing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Transmitting...
                </>
              ) : (
                <>
                  <Send size={13} /> Dispatch Test
                </>
              )}
            </button>
          </div>

          {!isConfigured && (
            <p className="text-[11px] text-[var(--warning)] flex items-center gap-1.5 pt-1">
              <AlertCircle size={12} /> Please save and verify your email configuration above before executing a test dispatch.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
