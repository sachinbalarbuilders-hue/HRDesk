import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Lock, Mail, Eye, EyeOff, Building2, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';

type Mode = 'login' | 'forgotEmail' | 'forgotOtp' | 'forgotDone';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // ─── Login ─────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter your work email and password.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await login(username, password);
      navigate('/dashboard');
    } catch (err: any) {
      if (!err.response) {
        setError('Cannot reach the server. Please check your connection.');
      } else if (err.response.status >= 500) {
        setError('Server is temporarily unavailable.');
      } else if (err.response.status === 429) {
        setError('Too many login attempts. Please wait a minute and try again.');
      } else {
        setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot: Send OTP ──────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your email.'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: username.trim() });
      setResetMessage(res.data.message || 'Reset code sent to your email.');
      setMode('forgotOtp');
    } catch (err: any) {
      if (err.response?.status === 429) setError('Too many attempts. Please wait and try again.');
      else setError(err.response?.data?.message || 'Failed to send reset code.');
    } finally { setLoading(false); }
  };

  // ─── Forgot: Reset Password ────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setError('Please enter the OTP code.'); return; }
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/reset-password', { email: username.trim(), otp: otp.trim(), newPassword });
      setMode('forgotDone');
    } catch (err: any) {
      if (err.response?.status === 429) setError('Too many attempts. Please wait and try again.');
      else setError(err.response?.data?.message || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  // ─── Back to login ─────────────────────────────────────────
  const backToLogin = () => {
    setMode('login');
    setError('');
    setResetMessage('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // ─── Titles ────────────────────────────────────────────────
  const title = mode === 'login' ? 'Welcome back'
    : mode === 'forgotDone' ? 'Password Reset!'
    : 'Reset Password';
  const subtitle = mode === 'login' ? 'Sign in to your HRDesk account'
    : mode === 'forgotEmail' ? 'Enter your email to receive a reset code'
    : mode === 'forgotOtp' ? 'Enter the code sent to your email'
    : 'Your password has been updated successfully';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white mb-2">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] space-y-5">
          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}
          {resetMessage && mode === 'forgotOtp' && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] text-sm">
              {resetMessage}
            </div>
          )}

          {/* ─── LOGIN FORM ─── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Work Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="name@company.com" className="register-input !pl-10 py-2.5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="register-input !pl-10 !pr-10 py-2.5" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50 mt-1">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgotEmail'); setError(''); }} className="text-xs text-[var(--accent)] hover:underline cursor-pointer">
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* ─── FORGOT: EMAIL STEP ─── */}
          {mode === 'forgotEmail' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Work Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type="email" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your@email.com" className="register-input !pl-10 py-2.5" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
              <button type="button" onClick={backToLogin} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center gap-1">
                <ArrowLeft size={12} /> Back to Sign In
              </button>
            </form>
          )}

          {/* ─── FORGOT: OTP + NEW PASSWORD STEP ─── */}
          {mode === 'forgotOtp' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Verification Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type="text" required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" maxLength={6} className="register-input !pl-10 py-2.5 font-mono tracking-widest text-center" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type={showPassword ? 'text' : 'password'} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="register-input !pl-10 !pr-10 py-2.5" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] cursor-pointer">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                  <input type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="register-input !pl-10 py-2.5" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button type="button" onClick={backToLogin} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer flex items-center justify-center gap-1">
                <ArrowLeft size={12} /> Back to Sign In
              </button>
            </form>
          )}

          {/* ─── FORGOT: DONE ─── */}
          {mode === 'forgotDone' && (
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--success-light)]">
                <CheckCircle2 size={28} className="text-[var(--success)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">Your password has been reset. Sign in with your new password.</p>
              <button onClick={backToLogin} className="btn-primary px-6 py-2.5 text-sm cursor-pointer">
                Sign In
              </button>
            </div>
          )}

          {/* Footer — only on login */}
          {mode === 'login' && (
            <div className="pt-3 border-t border-[var(--border)] text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                Need a new workspace?{' '}
                <Link to="/register" className="text-[var(--gold-600)] dark:text-[var(--gold-400)] font-semibold hover:underline">
                  Create an Organization
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} HRDesk. All rights reserved.
        </p>
      </div>
    </div>
  );
};
