import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Mail, ArrowLeft, KeyRound, Lock, Eye, EyeOff, CheckCircle2, Building2 } from 'lucide-react';

type Step = 'email' | 'otp' | 'newPassword' | 'done';

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: email.trim() });
      if (res.data.otp) {
        setOtp(res.data.otp);
        setMessage(`[Testing Mode] Your verification code is: ${res.data.otp}`);
      } else {
        setMessage(res.data.message || 'Reset code sent to your email.');
      }
      setStep('otp');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError(err.response?.data?.message || 'Failed to send reset code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setError('Please enter the OTP code.'); return; }
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/reset-password', { email: email.trim(), otp: otp.trim(), newPassword });
      setStep('done');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(err.response?.data?.message || 'Failed to reset password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm space-y-6 animate-fade-in">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white mb-2">
            <Building2 size={24} />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            {step === 'done' ? 'Password Reset!' : 'Reset Password'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {step === 'email' && 'Enter your email to receive a reset code'}
            {step === 'otp' && 'Enter the code sent to your email and set a new password'}
            {step === 'done' && 'Your password has been updated successfully'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]">
          {error && (
            <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] text-[var(--danger)] text-xs">
              {error}
            </div>
          )}
          {message && step === 'otp' && (
            <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[var(--success-light)] text-[var(--success)] text-xs">
              {message}
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Work Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer">
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP + New Password */}
          {step === 'otp' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Verification Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    maxLength={6}
                    className="w-full pl-10 pr-3 py-2.5 text-sm font-mono tracking-widest rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] cursor-pointer">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-[var(--radius-md)] bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setError(''); }} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer text-center">
                ← Back to email
              </button>
            </form>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--success-light)]">
                <CheckCircle2 size={28} className="text-[var(--success)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">Your password has been reset. You can now sign in with your new password.</p>
              <Link to="/auth/sign-in" className="btn-primary inline-block px-6 py-2.5 text-sm font-semibold">
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Back to login link */}
        {step !== 'done' && (
          <div className="text-center">
            <Link to="/auth/sign-in" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center justify-center gap-1">
              <ArrowLeft size={12} /> Back to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
