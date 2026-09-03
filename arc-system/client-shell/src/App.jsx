import React, { useState } from 'react';
import { AuthProvider, useAuth, ROLES } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { RatsView } from './views/RatsView';
import { SystemView } from './views/SystemView';
import { AlertTriangle } from 'lucide-react';

const MainContent = () => {
  const [activeTab, setActiveTab] = useState('rats');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [targetRoleRequired, setTargetRoleRequired] = useState(null);

  const { sessionWarningSeconds, staySignedIn } = useAuth();

  const handleOpenAuthModal = (requiredRole = null) => {
    setTargetRoleRequired(requiredRole);
    setIsAuthModalOpen(true);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Industrial Navigation Header */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange}
        onOpenAuthModal={() => handleOpenAuthModal(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {activeTab === 'rats' && (
          <RatsView 
            onRequireElevatedAuth={(requiredRole) => handleOpenAuthModal(requiredRole)} 
          />
        )}
        {activeTab === 'system' && (
          <SystemView 
            onOpenAuthModal={() => handleOpenAuthModal(null)} 
          />
        )}
      </main>

      {/* Industrial Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-800 py-3 px-6 text-center font-mono text-xs text-slate-500 dark:text-slate-400">
        ARC Command Center v0.2 • RATS Recipe Automation & Transfer System
      </footer>

      {/* Role Passcode Authentication Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        targetRoleRequired={targetRoleRequired}
      />

      <SessionTimeoutModal
        seconds={sessionWarningSeconds}
        onStaySignedIn={staySignedIn}
      />
    </div>
  );
};

const SessionTimeoutModal = ({ seconds, onStaySignedIn }) => {
  const { t } = useLanguage();
  if (seconds == null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm overflow-hidden rounded-lg border-2 border-amber-400 bg-white shadow-2xl dark:border-amber-600 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 bg-amber-500 px-5 py-3.5 text-slate-950 font-mono-industrial">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wide">{t('session_timeout_title')}</span>
        </div>
        <div className="space-y-4 p-5 text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {t('session_timeout_message')}
          </p>
          <div className="font-mono-industrial text-4xl font-black text-red-600 dark:text-red-400" aria-live="assertive">
            {seconds} <span className="text-base">{t('seconds')}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('session_timeout_help')}</p>
          <button
            type="button"
            onClick={onStaySignedIn}
            autoFocus
            className="w-full rounded bg-emerald-600 px-5 py-2.5 text-sm font-bold tracking-wide text-white shadow hover:bg-emerald-700 font-mono-industrial"
          >
            {t('stay_signed_in')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Guest authorization prompt shown when user tries to access RATS without login
const GuestAuthPrompt = ({ onLogin }) => {
  const { t } = useLanguage();
  return (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-xl p-10 max-w-md w-full text-center space-y-4">
      <div className="flex justify-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-950/60 border-2 border-sky-300 dark:border-sky-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </span>
      </div>
      <h2 className="font-header text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wider">{t('guest_auth_title')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">
        {t('guest_auth_access_before')} <strong className="text-sky-600 dark:text-sky-400">RATS Command System</strong> {t('guest_auth_access_after')}<br/>
        {t('guest_auth_instruction')}
      </p>
      <button
        onClick={onLogin}
        className="mt-2 w-full px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg font-mono-industrial text-sm uppercase tracking-widest transition-colors shadow"
      >
        {t('login_authenticate')}
      </button>
    </div>
  </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <MainContent />
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
