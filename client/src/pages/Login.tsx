import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, Building2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
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
        // No response at all: connection refused, DNS failure, timeout, etc. —
        // the backend is unreachable, not a credentials problem.
        setError('Cannot reach the server. Please check your connection or try again shortly.');
      } else if (err.response.status >= 500) {
        // 5xx (including the Vite dev proxy's 502 when the backend isn't running)
        // means the server/proxy failed, not that the credentials were wrong.
        setError('Server is temporarily unavailable. Please try again in a moment.');
      } else {
        setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white mb-2">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Welcome back
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Sign in to your HRDesk account
          </p>
        </div>

        {/* Login Card */}
        <div className="p-6 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] space-y-5">
          {error && (
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--danger-light)] border border-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Work Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@company.com"
                  className="register-input !pl-10 py-2.5"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="register-input !pl-10 !pr-10 py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50 mt-1"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="pt-3 border-t border-[var(--border)] text-center">
            <p className="text-xs text-[var(--text-secondary)]">
              Need a new workspace?{' '}
              <Link to="/register" className="text-[var(--gold-600)] dark:text-[var(--gold-400)] font-semibold hover:underline">
                Create an Organization
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} HRDesk. All rights reserved.
        </p>
      </div>
    </div>
  );
};
