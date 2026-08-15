import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, BookOpen, ShieldCheck } from 'lucide-react';

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
      setError('Please provide valid operator credentials.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F6F2] p-4 text-[#1C1C1C] font-ui">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-[4px] bg-[#0A1F44] text-[#C9A84C] font-bold text-lg mb-2">
            <BookOpen size={20} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-[#1C1C1C] tracking-tight">
            HRDesk
          </h1>
          <p className="text-xs font-data text-[#6B6B63] uppercase tracking-wider">
            System of Record & Attendance Register
          </p>
        </div>

        {/* Ledger Login Card */}
        <div className="p-6 bg-white border border-[#D8D5CB] rounded-[4px] space-y-5 shadow-sm">
          <div className="pb-2 border-b border-[#D8D5CB]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1C1C1C]">
              Operator Authentication
            </h2>
            <p className="text-xs text-[#6B6B63] mt-0.5">Sign in to access official company registers</p>
          </div>

          {error && (
            <div className="p-2.5 rounded-[2px] bg-[#F7F6F2] border border-[#A8402E] text-[#A8402E] text-xs font-data">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C1C1C] mb-1 font-ui">
                Operator ID / Username
              </label>
              <div className="relative">
                <User size={14} className="absolute left-2.5 top-2.5 text-[#6B6B63]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or employee ID"
                  className="register-input w-full pl-8 font-data"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1C1C] mb-1 font-ui">
                Passcode
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-2.5 top-2.5 text-[#6B6B63]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="register-input w-full pl-8 pr-8 font-data"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-[#6B6B63] hover:text-[#1C1C1C]"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2 disabled:opacity-50 mt-2"
            >
              {loading ? 'Verifying Credentials...' : 'Sign into Register'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#D8D5CB] text-[11px] font-data text-[#6B6B63] flex items-center justify-between">
            <span className="flex items-center gap-1 text-[#2F6B4F]">
              <ShieldCheck size={13} /> Secure Single Source of Truth
            </span>
            <span>v2.0</span>
          </div>
        </div>

        <p className="text-center text-xs font-data text-[#6B6B63]">
          © {new Date().getFullYear()} HRDesk. All rights reserved.
        </p>
      </div>
    </div>
  );
};
