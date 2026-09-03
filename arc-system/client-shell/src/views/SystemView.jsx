import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Server, Shield, ClipboardList, RefreshCw, Activity, HardDrive, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';

const RATS_HOST = window.location.hostname || '127.0.0.1';
const RATS_HTTP_SCHEME = window.location.protocol === 'https:' ? 'https' : 'http';
const RATS_API_BASE = import.meta.env.VITE_RATS_API_BASE || `${RATS_HTTP_SCHEME}://${RATS_HOST}:8080`;

export const SystemView = ({ onOpenAuthModal }) => {
  const { currentRole, hasAdminPermission, authHeaders } = useAuth();
  const [auditSessions, setAuditSessions] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');

  const loadHealth = async () => {
    if (currentRole === 'Guest') return;
    setHealthLoading(true);
    setHealthError('');
    try {
      const res = await fetch(`${RATS_API_BASE}/api/health`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Request failed (${res.status})`);
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setHealthError(err.message);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadAuditSessions = async () => {
    if (!hasAdminPermission()) return;
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await fetch(`${RATS_API_BASE}/api/audit/employee-sessions?limit=200`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Request failed (${res.status})`);
      setAuditSessions(data.sessions || []);
    } catch (err) {
      setAuditError(err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    if (hasAdminPermission()) loadAuditSessions();
    else setAuditSessions([]);
  }, [currentRole]);

  const stateTone = (status) => {
    if (['READY', 'ONLINE'].includes(status)) return 'text-emerald-600 dark:text-emerald-400';
    if (['WARNING', 'DEGRADED'].includes(status)) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatTime = (value) => value ? new Date(value).toLocaleString() : 'ACTIVE';
  const actionText = (action) => {
    const target = action.machine_id ? ` ${action.machine_id}` : '';
    const recipe = action.recipe ? ` • ${action.recipe}` : '';
    const recipes = Array.isArray(action.recipes) && action.recipes.length ? ` • ${action.recipes.join(', ')}` : '';
    const filename = action.filename ? ` • ${action.filename}` : '';
    return `${formatTime(action.timestamp)} — ${action.action}${target}${recipe}${recipes}${filename}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-300 dark:border-slate-800 rounded-md shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-700 rounded text-sky-700 dark:text-sky-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-header text-xl font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              System Infrastructure & Role Security
            </h2>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              Backend Microservices, Database Connection, and Role Management
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAuthModal}
          className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white font-mono-industrial text-xs font-bold rounded shadow hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
        >
          <Shield className="w-4 h-4 text-amber-400" />
          <span>LOGIN / CHANGE ROLE</span>
        </button>
      </div>

      <div className="industrial-card">
        <div className="industrial-card-header">
          <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-sky-500" />PRODUCTION READINESS</span>
          <button type="button" onClick={loadHealth} disabled={healthLoading} className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} /> REFRESH
          </button>
        </div>
        {healthError ? (
          <div className="m-4 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">Health check unavailable: {healthError}</div>
        ) : health ? (
          <div className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 font-header font-bold text-slate-900 dark:text-white">
                {health.overall === 'READY' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                OVERALL: <span className={stateTone(health.overall)}>{health.overall}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">Checked {new Date(health.checked_at).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 font-mono text-xs">
              {[
                ['Backend API', health.checks.backend.status, `Uptime ${Math.floor(health.checks.backend.uptime_sec / 60)} min`, Server],
                ['Section Manager', health.checks.section_manager.status, health.checks.section_manager.age_sec == null ? 'No heartbeat' : `Heartbeat ${health.checks.section_manager.age_sec}s ago`, Activity],
                ['Machine Workers', health.checks.workers.status, `${health.checks.workers.alive}/${health.checks.workers.total} alive`, Users],
                ['Recipe Storage', health.checks.recipe_storage.status, `${health.checks.recipe_storage.recipes} recipes / ${health.checks.recipe_storage.archives} archives`, HardDrive],
                ['Audit Storage', health.checks.audit_storage.status, `${health.checks.audit_storage.sessions} sessions`, ClipboardList],
                ['Disk Space', health.checks.disk.status, `${health.checks.disk.free_gb} GB free`, HardDrive],
                ['Credential Policy', health.checks.security.status, health.checks.security.default_credentials.length ? `${health.checks.security.default_credentials.length} defaults remain` : 'No defaults detected', Shield],
              ].map(([label, status, detail, Icon]) => (
                <div key={label} className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 font-bold"><Icon className="h-3.5 w-3.5" />{label}</span><span className={`font-bold ${stateTone(status)}`}>{status}</span></div>
                  <div className="text-[10px] text-slate-500">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="p-4 text-xs text-slate-500">Loading production health...</div>}
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Service 1: RATS FastAPI Server */}
        <div className="industrial-card">
          <div className="industrial-card-header">
            <span>RATS FASTAPI ENGINE</span>
              <span className={`flex items-center gap-1 text-xs font-mono ${stateTone(health?.checks?.backend?.status || 'OFFLINE')}`}>
              <span className="w-2 h-2 rounded-full bg-current"></span> {health?.checks?.backend?.status || 'CHECKING'}
            </span>
          </div>
          <div className="p-4 space-y-2 font-mono text-xs text-slate-700 dark:text-slate-300">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 py-1">
              <span className="text-slate-500">Auth Route:</span>
              <span className="font-semibold text-slate-900 dark:text-white">/api/auth/login</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 py-1">
              <span className="text-slate-500">Recipe API:</span>
              <span className="font-semibold text-slate-900 dark:text-white">/api/*</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">SECS/GEM Driver:</span>
              <span className={`font-semibold ${stateTone(health?.checks?.section_manager?.status || 'OFFLINE')}`}>{health?.checks?.section_manager?.status || 'CHECKING'}</span>
            </div>
          </div>
        </div>

        {/* Security Summary */}
        <div className="industrial-card">
          <div className="industrial-card-header">
            <span>ACTIVE ROLE CREDENTIALS</span>
            <Shield className="w-4 h-4 text-amber-500" />
          </div>
          <div className="p-4 space-y-2 font-mono text-xs text-slate-700 dark:text-slate-300">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 py-1">
              <span className="text-slate-500">Current Role:</span>
              <span className="font-bold text-sky-600 uppercase">{currentRole}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 py-1">
              <span className="text-slate-500">Operator Level:</span>
              <span className="font-semibold text-emerald-600">ACTIVE</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 py-1">
              <span className="text-slate-500">Technician Level:</span>
              <span className="font-semibold">PROTECTED</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Administrator Level:</span>
              <span className="font-semibold">PROTECTED</span>
            </div>
          </div>
        </div>

      </div>

      {hasAdminPermission() && (
        <div className="industrial-card">
          <div className="industrial-card-header">
            <span className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-sky-500" />
              EMPLOYEE ACTIVITY AUDIT
            </span>
            <button
              type="button"
              onClick={loadAuditSessions}
              disabled={auditLoading}
              className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>

          {auditError ? (
            <div className="m-4 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {auditError}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-xs font-mono">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <tr>
                    <th className="px-3 py-2">EMPLOYEE NO.</th>
                    <th className="px-3 py-2">ROLE</th>
                    <th className="px-3 py-2">LOGIN</th>
                    <th className="px-3 py-2">LOGOUT</th>
                    <th className="px-3 py-2">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {auditSessions.map((session) => (
                    <tr key={session.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                      <td className="px-3 py-2 font-bold text-sky-700 dark:text-sky-400">{session.employee_number}</td>
                      <td className="px-3 py-2">{session.role}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatTime(session.login_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTime(session.logout_at)}
                        {session.logout_reason && <div className="text-[10px] text-slate-500">{session.logout_reason}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {session.actions?.length ? session.actions.map((action, index) => (
                          <div key={`${session.id}-${index}`} className="mb-1 last:mb-0">{actionText(action)}</div>
                        )) : <span className="text-slate-400">No recorded action</span>}
                      </td>
                    </tr>
                  ))}
                  {!auditLoading && auditSessions.length === 0 && (
                    <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-400">No employee activity recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
