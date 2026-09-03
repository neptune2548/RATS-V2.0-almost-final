import React, { useState } from 'react';
import { useAuth, ROLES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Sun, Moon, Server, Cpu, LogOut, LogIn, AlertTriangle, X, Globe } from 'lucide-react';

export const Navbar = ({ activeTab, setActiveTab, onOpenAuthModal }) => {
  const { currentRole, employeeNumber, isGuest, logoutToGuest } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [showLogoffConfirm, setShowLogoffConfirm] = useState(false);

  const logoSrc = theme === 'light' 
    ? '/assets/Stars - Original Logo.png' 
    : '/assets/Stars - White Logo_Transparent.png';

  const getRoleBadgeStyle = () => {
    switch (currentRole) {
      case ROLES.ADMINISTRATOR:
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700';
      case ROLES.TECHNICIAN:
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700';
      case ROLES.OPERATOR:
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  return (
    <>
      <header className="bg-white dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-800 px-4 py-1.5 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Left: Branding & Stars Logo */}
          <div className="flex items-center gap-3">
            <img 
              src={logoSrc} 
              alt="Stars Logo" 
              className="h-7 w-auto object-contain max-w-[140px]" 
            />
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block"></div>
            <div>
              <h1 className="font-header text-lg font-bold tracking-wider text-slate-900 dark:text-white uppercase flex items-center gap-2">
                ARC <span className="text-sky-600 dark:text-sky-400">COMMAND CENTER</span>
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                RATS Recipe Automation & Transfer System v0.2
              </p>
            </div>
          </div>

          {/* Right Section: Navigation Tabs + Role Controls aligned to the FAR RIGHT */}
          <div className="ml-auto flex items-center gap-4">
            
            {/* Navigation Tabs (Right Aligned) */}
            <nav className={`flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-300 dark:border-slate-700 font-mono-industrial ${language === 'EN' ? 'text-[10px]' : 'text-xs'}`}>
              {/* RATS Command — always visible; auth handled on the page */}
              <button
                onClick={() => setActiveTab('rats')}
                className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'rats'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{t('rats_command')}</span>
              </button>

              {/* System Status */}
              <button
                onClick={() => setActiveTab('system')}
                className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'system'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>{t('system_status')}</span>
              </button>
            </nav>

            {/* Role, Language & Theme Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAuthModal}
                className={`px-2 py-1 border rounded flex items-center gap-1.5 font-mono text-[10px] font-semibold shadow-xs hover:opacity-95 transition-opacity ${getRoleBadgeStyle()}`}
                title="Login / Role Status"
              >
                {isGuest() ? <LogIn className="w-3.5 h-3.5 text-slate-500" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>
                  {!isGuest() && <strong className="mr-1">EN:{employeeNumber}</strong>}
                  {t('role')}<strong className="uppercase">{currentRole}</strong>
                </span>
              </button>

              {!isGuest() && (
                <button
                  onClick={() => setShowLogoffConfirm(true)}
                  className="p-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title={t('logoff')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Language Switcher Toggle */}
              <button
                onClick={toggleLanguage}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                title={t('switch_lang')}
              >
                <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{language}</span>
              </button>

              <button
                onClick={toggleTheme}
                className="p-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
              >
                {theme === 'light' ? (
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                )}
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Custom Logoff Confirmation Popup Modal */}
      {showLogoffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between font-mono-industrial">
              <div className="flex items-center gap-2.5">
                <LogOut className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-sm tracking-wide uppercase">{t('logoff_title')}</span>
              </div>
              <button 
                onClick={() => setShowLogoffConfirm(false)} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-950/60 rounded-full border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('logoff_question')}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {t('logoff_role_text')} <strong className="uppercase text-sky-600 dark:text-sky-400">{currentRole}</strong>. {t('logoff_return_guest')}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono-industrial text-xs">
                <button
                  onClick={() => setShowLogoffConfirm(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    setShowLogoffConfirm(false);
                    logoutToGuest();
                    // Stay on rats tab — the GuestAuthPrompt will show instead
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors shadow-sm uppercase tracking-wider"
                >
                  {t('confirm_logoff')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
