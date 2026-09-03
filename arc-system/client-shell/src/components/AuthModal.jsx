import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Shield, Lock, User, KeyRound, AlertCircle, X, Badge } from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, targetRoleRequired = null }) => {
  const { login, authError, setAuthError } = useAuth();
  const { language, t } = useLanguage();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedUsername = localStorage.getItem('rememberedUsername');
      if (savedUsername) {
        setUsername(savedUsername);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const localizedAuthError = (() => {
    if (language !== 'TH' || !authError) return authError;
    const error = authError.toLowerCase();
    if (error.includes('invalid username') || error.includes('incorrect')) return t('invalid_credentials');
    if (error.includes('employee number')) return t('employee_number_required');
    if (error.includes('session') && error.includes('expired')) return t('session_expired');
    if (error.includes('server unavailable') || error.includes('failed to fetch')) return t('login_server_unavailable');
    return authError;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!employeeNumber.trim()) {
      setAuthError(t('employee_number_required'));
      return;
    }
    if (!username.trim() || !password.trim()) return;
    const result = await login(employeeNumber, username, password);
    if (result.success) {
      localStorage.setItem('rememberedUsername', username.trim());
      setEmployeeNumber('');
      setPassword('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between font-mono-industrial">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-base tracking-wide">{t('login_title')}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {targetRoleRequired && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded text-xs font-mono-industrial text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{t('authorization_required')}: <strong>{targetRoleRequired}</strong> {t('role_or_higher')}.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Number input */}
            <div>
              <label className="block text-xs font-mono-industrial uppercase font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('employee_number')}
              </label>
              <div className="relative">
                <Badge className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => {
                    setEmployeeNumber(e.target.value.toUpperCase());
                    if (authError) setAuthError('');
                  }}
                  placeholder={t('employee_number_placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoFocus
                  autoComplete="off"
                  maxLength={20}
                  required
                />
              </div>
            </div>

            {/* Username input */}
            <div>
              <label className="block text-xs font-mono-industrial uppercase font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('username')}
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder={t('username_placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-xs font-mono-industrial uppercase font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('password')}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder={t('password_placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {authError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{localizedAuthError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-mono-industrial font-bold rounded shadow transition-colors uppercase tracking-wider"
            >
              {t('login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
