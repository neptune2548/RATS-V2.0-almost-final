import React, { useState, useEffect, useRef } from 'react';
import { useAuth, ROLES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Cpu, Send, Download, Lock, ShieldCheck, CheckCircle2, 
  RefreshCw, Layers, Database, AlertCircle, Scan, Wifi, Trash2, Radio, Server, X,
  ChevronDown, ChevronUp, Map, Maximize2, Minimize2
} from 'lucide-react';

const RATS_HOST = window.location.hostname || '127.0.0.1';
const RATS_HTTP_SCHEME = window.location.protocol === 'https:' ? 'https' : 'http';
const RATS_WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws';
const RATS_API_BASE = import.meta.env.VITE_RATS_API_BASE || `${RATS_HTTP_SCHEME}://${RATS_HOST}:8080`;
const RATS_WS_URL = import.meta.env.VITE_RATS_WS_URL || `${RATS_WS_SCHEME}://${RATS_HOST}:8080/ws`;

const normalizeLinkState = (value) => {
  const state = String(value || 'UNKNOWN').toUpperCase();
  // Connection retries are intentionally hidden from operators.  A machine
  // stays OFFLINE in the UI until a connection has actually been established.
  if (state === 'CONNECTING' || state === 'CONN. LOST') return 'OFFLINE';
  return ['ONLINE', 'OFFLINE'].includes(state) ? state : 'UNKNOWN';
};

const linkStateClasses = {
  ONLINE: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700',
  OFFLINE: 'bg-red-100 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300 dark:border-red-700',
  CONNECTING: 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  UNKNOWN: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600',
};

const linkDotClasses = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-red-500',
  CONNECTING: 'bg-amber-400 animate-pulse',
  UNKNOWN: 'bg-slate-400',
};

const SECTION_ORDER = ['WB_ADVANCED', 'IC_WIRE_BOND', 'UNASSIGNED'];

const machineSectionId = (machine) => machine?.production_section || 'UNASSIGNED';

const isReconnectNoise = (log) => {
  const message = typeof log?.message === 'object'
    ? Object.values(log.message).join(' ')
    : String(log?.message || '');
  const normalized = message.toLowerCase();
  return [
    'connecting to ', 'retrying in ', 'reconnecting...',
    'กำลังเชื่อมต่อไปยัง', 'กำลังเชื่อมต่อใหม่', 'แล้วลองใหม่',
  ].some(fragment => normalized.includes(fragment));
};

export const RatsView = ({ onRequireElevatedAuth }) => {
  const { currentRole, hasPushPermission, hasDeletePermission, hasDeveloperPermission, authHeaders, logoutToGuest, setAuthError } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();

  const [serialInput, setSerialInput] = useState('');
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [actionStatus, setActionStatus] = useState(null);
  const [eventLogs, setEventLogs] = useState([]);
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState([]);
  const [customProgramInput, setCustomProgramInput] = useState('');
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);
  const [fuzzyModalConfig, setFuzzyModalConfig] = useState({ isOpen: false, original: '', suggestion: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, recipe: '' });
  const [pendingRecipeUpdates, setPendingRecipeUpdates] = useState([]);
  const [pendingDecisionBusy, setPendingDecisionBusy] = useState(false);
  const [deploymentFiles, setDeploymentFiles] = useState([]);
  const [deploymentBusy, setDeploymentBusy] = useState(false);
  const [isMachineExpanded, setIsMachineExpanded] = useState(false);

  const wsRef = useRef(null);
  const selectedMachineIdRef = useRef(selectedMachineId);
  const lastSelectedMachineBySectionRef = useRef({});
  const deploymentInputRef = useRef(null);
  const machineDetailsRef = useRef(null);

  useEffect(() => {
    selectedMachineIdRef.current = selectedMachineId;
  }, [selectedMachineId]);

  const logoSrc = theme === 'light' 
    ? '/assets/Stars - Original Logo.png' 
    : '/assets/Stars - White Logo_Transparent.png';

  // Format message string or dict from Python backend
  const formatLogMsg = (msg) => {
    if (typeof msg === 'string') return msg;
    if (typeof msg === 'object' && msg !== null) {
      if (language === 'TH' && msg.TH) return msg.TH;
      if (language === 'EN' && msg.EN) return msg.EN;
      return msg.EN || msg.TH || JSON.stringify(msg);
    }
    return String(msg || '');
  };

  // Connect to WebSocket on mount
  useEffect(() => {
    let ws;
    let isComponentMounted = true;

    const connectWS = () => {
      try {
        ws = new WebSocket(RATS_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isComponentMounted) setIsBackendOnline(true);
        };

        ws.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.machines) {
              setMachines(data.machines);
              setSelectedMachineId(prev => prev || selectedMachineIdRef.current || (data.machines[0] ? data.machines[0].id : ''));
            }
            if (data.events) {
              setEventLogs(data.events);
            }
            if (data.pending_recipe_updates) {
              setPendingRecipeUpdates(data.pending_recipe_updates);
            }
          } catch (e) {
            console.error('Failed to parse WS data:', e);
          }
        };

        ws.onerror = () => {
          if (isComponentMounted) setIsBackendOnline(false);
        };

        ws.onclose = () => {
          if (isComponentMounted) {
            setIsBackendOnline(false);
            setTimeout(connectWS, 3000);
          }
        };
      } catch (e) {
        if (isComponentMounted) setIsBackendOnline(false);
      }
    };

    connectWS();

    return () => {
      isComponentMounted = false;
      if (ws) ws.close();
    };
  }, []);

  // Fetch initial REST status as fallback
  useEffect(() => {
    fetch(`${RATS_API_BASE}/api/status`)
      .then(res => res.json())
      .then(data => {
        setIsBackendOnline(true);
        if (data.machines) {
          setMachines(data.machines);
          setSelectedMachineId(prev => prev || (data.machines[0] ? data.machines[0].id : ''));
        }
        if (data.events) {
          setEventLogs(data.events);
        }
        if (data.pending_recipe_updates) {
          setPendingRecipeUpdates(data.pending_recipe_updates);
        }
      })
      .catch(() => {
        setIsBackendOnline(false);
      });
  }, []);

  // Fetch available recipes for selected machine
  useEffect(() => {
    if (!selectedMachineId) return;
    fetch(`${RATS_API_BASE}/api/machines/${encodeURIComponent(selectedMachineId)}/recipes`)
      .then(res => res.json())
      .then(data => {
        if (data.recipes) {
          setAvailableRecipes(data.recipes);
        }
      })
      .catch(() => setAvailableRecipes([]));
  }, [selectedMachineId]);

  const activeMachine = machines.find(m => m.id === selectedMachineId) || machines[0] || {
    id: 'WB#81', name: 'Wire Bonder #81', ip: '169.254.13.81', port: 5000, status: 'IDLE', current_program: 'None', link_status: 'OFFLINE', bot_status: 'OFFLINE', machine_link_status: 'OFFLINE', production_section: 'WB_ADVANCED'
  };

  const groupedMachines = SECTION_ORDER
    .map(sectionId => ({
      sectionId,
      machines: machines.filter(machine => machineSectionId(machine) === sectionId),
    }))
    .filter(group => group.machines.length > 0);

  const activeSectionId = machineSectionId(activeMachine);
  const activeMachineGroup = groupedMachines.find(group => group.sectionId === activeSectionId) || groupedMachines[0];
  const sectionMachines = activeMachineGroup?.machines || [];
  const activeSectionLabel = activeSectionId === 'WB_ADVANCED'
    ? t('wb_advanced_section')
    : activeSectionId === 'IC_WIRE_BOND'
      ? t('ic_wire_bond_section')
      : t('unassigned_section');

  useEffect(() => {
    const selected = machines.find(machine => machine.id === selectedMachineId);
    if (selected) {
      lastSelectedMachineBySectionRef.current[machineSectionId(selected)] = selected.id;
    }
  }, [machines, selectedMachineId]);

  const selectProductionSection = (sectionId) => {
    const group = groupedMachines.find(item => item.sectionId === sectionId);
    if (!group?.machines.length) return;
    const rememberedMachineId = lastSelectedMachineBySectionRef.current[sectionId];
    const nextMachine = group.machines.find(machine => machine.id === rememberedMachineId) || group.machines[0];
    setSelectedMachineId(nextMachine.id);
    setIsMachineExpanded(false);
  };

  const selectAndExpandMachine = (machineId) => {
    if (currentRole === ROLES.GUEST) {
      setActionStatus({ type: 'AUTH', status: 'ERROR', msg: t('access_insufficient') });
      return;
    }
    setSelectedMachineId(machineId);
    setIsMachineExpanded(true);
    window.requestAnimationFrame(() => {
      machineDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const visibleEventLogs = eventLogs.filter(log => {
    if (isReconnectNoise(log)) return false;
    if (log.production_section) return log.production_section === activeSectionId;
    const serialized = typeof log.message === 'object'
      ? Object.values(log.message).join(' ')
      : String(log.message || '');
    const match = serialized.match(/WB#(\d+)/i) || serialized.match(/Wire Bonder\s*#(\d+)/i);
    if (!match) return false;
    const logMachine = machines.find(machine => machine.id === `WB#${match[1]}`);
    return machineSectionId(logMachine) === activeSectionId;
  });

  const pendingRecipeUpdate = pendingRecipeUpdates[0] || null;
  const isGuestUser = currentRole === ROLES.GUEST;

  const notifyRestrictedAccess = () => {
    setActionStatus({ type: 'AUTH', status: 'ERROR', msg: t('access_insufficient') });
  };

  const linkStateLabel = (state) => {
    if (state === 'ONLINE') return t('online');
    if (state === 'OFFLINE') return t('offline');
    return t('unchecked');
  };

  const resolvePendingRecipe = async (decision) => {
    if (!pendingRecipeUpdate || pendingDecisionBusy) return;
    if (!hasDeletePermission()) {
      onRequireElevatedAuth(ROLES.TECHNICIAN);
      return;
    }

    setPendingDecisionBusy(true);
    try {
      const res = await fetch(
        `${RATS_API_BASE}/api/recipes/pending/${encodeURIComponent(pendingRecipeUpdate.request_id)}/${decision}`,
        { method: 'POST', headers: authHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Request failed (${res.status})`);
      setPendingRecipeUpdates(prev => prev.filter(item => item.request_id !== pendingRecipeUpdate.request_id));
      setActionStatus({
        type: 'RECIPE UPDATE',
        status: decision === 'approve' ? 'SUCCESS' : 'IDLE',
        msg: decision === 'approve'
          ? `Accepted host recipe update '${pendingRecipeUpdate.ppid}' from ${pendingRecipeUpdate.machine_id}.`
          : `Rejected host recipe update '${pendingRecipeUpdate.ppid}' from ${pendingRecipeUpdate.machine_id}.`
      });
    } catch (err) {
      setActionStatus({ type: 'RECIPE UPDATE', status: 'ERROR', msg: err.message });
    } finally {
      setPendingDecisionBusy(false);
    }
  };

  // Barcode Lookup
  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (currentRole === ROLES.GUEST) {
      notifyRestrictedAccess();
      return;
    }
    if (!serialInput.trim()) return;
    const term = serialInput.trim();

    try {
      setActionStatus({ type: 'SCAN', status: 'RUNNING', msg: `Looking up barcode serial '${term}'...` });
      const res = await fetch(`${RATS_API_BASE}/api/lookup/${encodeURIComponent(term)}`);
      const data = await res.json();

      if (res.ok && data.machine) {
        selectAndExpandMachine(data.machine.id);
        setActionStatus({ type: 'SCAN', status: 'SUCCESS', msg: `Found barcode ${term} -> Assigned to ${data.machine.name}` });
        setSerialInput('');
      } else {
        setActionStatus({ type: 'SCAN', status: 'ERROR', msg: data.error || `Barcode lookup failed for '${term}'` });
      }
    } catch (err) {
      setActionStatus({ type: 'SCAN', status: 'ERROR', msg: `Server communication failed: ${err.message}` });
    }
  };



  // Pull Recipe
  const handlePullRecipe = async () => {
    if (!activeMachine.id) return;
    setActionStatus({ type: 'PULL', status: 'RUNNING', msg: `Executing Recipe Pull for ${activeMachine.name}...` });

    try {
      const res = await fetch(`${RATS_API_BASE}/api/machines/${encodeURIComponent(activeMachine.id)}/pull`, {
        method: 'POST',
        headers: authHeaders()
      });
      if (res.status === 401) {
        logoutToGuest();
        setAuthError('Your session has expired. Please log in again to continue.');
        return;
      }
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'PULL', status: 'SUCCESS', msg: `Recipe Pull SUCCESS for ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'ONLINE' } : m));
      } else {
        const err = data.result?.message || data.error || data.detail || 'Pull failed';
        setActionStatus({ type: 'PULL', status: 'ERROR', msg: `Recipe Pull FAILED: ${err}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'OFFLINE' } : m));
      }
    } catch (err) {
      setActionStatus({ type: 'PULL', status: 'ERROR', msg: `Network request failed: ${err.message}` });
    }
  };

  const handleDeployFiles = async () => {
    if (!hasDeveloperPermission()) {
      onRequireElevatedAuth(ROLES.DEVELOPER);
      return;
    }
    const allowedNames = new Set(['secs_proxy_bot.exe', 'config.ini']);
    const files = deploymentFiles.filter(file => allowedNames.has(file.name.toLowerCase()));
    if (files.length === 0) {
      setActionStatus({ type: 'DEPLOY', status: 'ERROR', msg: t('deploy_select_required') });
      return;
    }

    setDeploymentBusy(true);
    try {
      const results = [];
      for (const file of files) {
        setActionStatus({
          type: 'DEPLOY',
          status: 'RUNNING',
          msg: `${t('deploy_sending')} ${file.name} → ${activeMachine.id}:5004...`
        });
        const res = await fetch(
          `${RATS_API_BASE}/api/machines/${encodeURIComponent(activeMachine.id)}/deploy-file`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Deploy-Filename': file.name,
              ...authHeaders()
            },
            body: file
          }
        );
        if (res.status === 401) {
          logoutToGuest();
          setAuthError(t('session_expired'));
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || data.error || `${file.name}: request failed (${res.status})`);
        results.push(`${file.name}: ${data.message}`);
      }
      setActionStatus({
        type: 'DEPLOY',
        status: 'SUCCESS',
        msg: `${t('deploy_complete')} ${activeMachine.id}. ${results.join(' | ')}`
      });
      setDeploymentFiles([]);
      if (deploymentInputRef.current) deploymentInputRef.current.value = '';
    } catch (err) {
      setActionStatus({ type: 'DEPLOY', status: 'ERROR', msg: `${t('deploy_failed')}: ${err.message}` });
    } finally {
      setDeploymentBusy(false);
    }
  };

  // Push Recipe
  const handlePushRecipe = async (programOverride = null) => {
    if (!hasPushPermission()) {
      onRequireElevatedAuth(ROLES.OPERATOR);
      return;
    }

    const isStringOverride = typeof programOverride === 'string';
    let programToPush = isStringOverride ? programOverride : (customProgramInput.trim() || activeMachine.current_program);

    if (!programToPush || programToPush === 'None') {
      setActionStatus({ type: 'PUSH', status: 'ERROR', msg: 'Please enter or select a valid recipe program name to push.' });
      return;
    }

    // --- Fuzzy Suggestion Check ---
    if (!isStringOverride) {
      setActionStatus({ type: 'PUSH', status: 'RUNNING', msg: `Verifying recipe '${programToPush}'...` });
      try {
        const checkRes = await fetch(`${RATS_API_BASE}/api/recipes/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ recipe_name: programToPush })
        });
        
        if (checkRes.status === 401) {
          logoutToGuest();
          setAuthError('Your session has expired. Please log in again to continue.');
          return;
        }

        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (!checkData.exact_match) {
            if (checkData.suggestion) {
              setFuzzyModalConfig({ isOpen: true, original: programToPush, suggestion: checkData.suggestion });
              return;
            } else {
              setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Recipe '${programToPush}' not found and no close matches exist.` });
              return;
            }
          }
        } else {
          throw new Error('Suggestion API returned error');
        }
      } catch (err) {
        setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Failed to verify recipe with server: ${err.message}` });
        return;
      }
    }
    // ------------------------------

    setActionStatus({ type: 'PUSH', status: 'RUNNING', msg: `Executing Recipe Push '${programToPush}' to ${activeMachine.name}...` });

    try {
      const res = await fetch(`${RATS_API_BASE}/api/machines/${encodeURIComponent(activeMachine.id)}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ program_name: programToPush })
      });
      if (res.status === 401) {
        logoutToGuest();
        setAuthError('Your session has expired. Please log in again to continue.');
        return;
      }
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'PUSH', status: 'SUCCESS', msg: `Recipe Push SUCCESS: Loaded '${programToPush}' on ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, current_program: programToPush, link_status: 'ONLINE' } : m));
      } else {
        const err = data.result?.message || data.error || data.detail || 'Push failed';
        setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Recipe Push FAILED: ${err}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'OFFLINE' } : m));
      }
    } catch (err) {
      setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Network request failed: ${err.message}` });
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = () => {
    if (!hasDeletePermission()) {
      onRequireElevatedAuth(ROLES.TECHNICIAN);
      return;
    }

    const programToDelete = customProgramInput.trim();
    if (!programToDelete) {
      setActionStatus({ type: 'DELETE', status: 'ERROR', msg: 'Please enter a recipe program name to delete.' });
      return;
    }

    setDeleteConfirmModal({ isOpen: true, recipe: programToDelete });
  };

  const executeDelete = async (programToDelete) => {
    setActionStatus({ type: 'DELETE', status: 'RUNNING', msg: `Executing Recipe Deletion '${programToDelete}' from ${activeMachine.name}...` });

    try {
      const res = await fetch(`${RATS_API_BASE}/api/machines/${encodeURIComponent(activeMachine.id)}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ program_name: programToDelete })
      });
      if (res.status === 401) {
        logoutToGuest();
        setAuthError('Your session has expired. Please log in again to continue.');
        return;
      }
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'DELETE', status: 'SUCCESS', msg: `Recipe Deletion SUCCESS: Removed '${programToDelete}' from ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, current_program: (m.current_program === programToDelete ? 'None' : m.current_program), link_status: 'ONLINE' } : m));
        setCustomProgramInput('');
      } else {
        const err = data.result?.message || data.error || data.detail || 'Delete failed';
        setActionStatus({ type: 'DELETE', status: 'ERROR', msg: `Recipe Deletion FAILED: ${err}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'OFFLINE' } : m));
      }
    } catch (err) {
      setActionStatus({ type: 'DELETE', status: 'ERROR', msg: `Network request failed: ${err.message}` });
    }
  };

  // Purge logs endpoint call
  const handleClearLogs = async () => {
    try {
      await fetch(`${RATS_API_BASE}/api/logs/clear`, { method: 'POST', headers: authHeaders() });
      setEventLogs([]);
    } catch (e) {
      setEventLogs([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-300 dark:border-slate-800 rounded-md shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 flex-shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700"></div>
          <div>
            <h2 className="font-header text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
              {t('rats_header_title')}
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1.5 ${
                isBackendOnline 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-300 dark:border-red-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isBackendOnline ? t('python_online') : t('python_offline')}
              </span>
            </h2>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {t('rats_sub_title')}
            </p>
          </div>
        </div>

        {/* Barcode Search / Scan Strip */}
        <form onSubmit={handleBarcodeScan} className="flex items-center gap-2">
          <div className="relative">
            <Scan className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder={t('scan_placeholder')}
              className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 w-64"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-mono-industrial text-xs font-bold rounded shadow transition-colors"
          >
            {t('scan_btn')}
          </button>
        </form>
      </div>

      {!isBackendOnline && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-lg font-mono text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-bounce" />
            <span>
              <strong>{t('python_offline')}:</strong> {t('rats_offline_banner')}
            </span>
          </div>
        </div>
      )}

      {isGuestUser && (
        <div className="flex items-center gap-2.5 rounded-lg border-2 border-sky-300 bg-sky-50 p-3.5 text-xs text-sky-900 shadow-sm dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
          <Lock className="h-5 w-5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
          <span><strong>{t('guest_read_only_title')}:</strong> {t('guest_read_only_message')}</span>
        </div>
      )}

      {actionStatus?.type === 'AUTH' && (
        <div role="alert" className="flex items-center gap-2.5 rounded-lg border-2 border-amber-400 bg-amber-50 p-3.5 text-xs font-bold text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {actionStatus.msg}
        </div>
      )}

      {/* Machine floor map and expandable details */}
      <div className="space-y-6">
        <div className="industrial-card overflow-hidden">
          <div className="industrial-card-header">
            <span className="flex items-center gap-2">
              <Map className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              {t('factory_map')}
            </span>
            <div className="text-right">
              <span className="block text-xs text-slate-500 font-mono">{machines.length}{t('machines_count')}</span>
              <span className="block text-[9px] font-mono uppercase tracking-wide text-slate-400">{t('schematic_map')}</span>
            </div>
          </div>

          {groupedMachines.length > 0 && (
            <div
              role="tablist"
              aria-label={t('production_section')}
              className="industrial-scrollbar flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 pt-2 dark:border-slate-700 dark:bg-slate-900/70"
            >
              {groupedMachines.map(group => {
                const isActive = group.sectionId === activeSectionId;
                const onlineCount = group.machines.filter(machine => normalizeLinkState(machine.machine_link_status) === 'ONLINE').length;
                const sectionLabel = group.sectionId === 'WB_ADVANCED'
                  ? t('wb_advanced_section')
                  : group.sectionId === 'IC_WIRE_BOND'
                    ? t('ic_wire_bond_section')
                    : t('unassigned_section');
                return (
                  <button
                    key={group.sectionId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => selectProductionSection(group.sectionId)}
                    className={`min-w-max rounded-t-md border-x border-t px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'border-sky-500 bg-white text-sky-700 shadow-[0_2px_0_white] dark:bg-slate-800 dark:text-sky-300 dark:shadow-[0_2px_0_rgb(30,41,59)]'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="block text-[10px] font-extrabold">{sectionLabel}</span>
                    <span className="mt-0.5 block text-[9px] font-mono opacity-75">
                      {onlineCount}/{group.machines.length} {t('online')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {t('factory_map_hint')}
          </div>

          <div className="industrial-scrollbar max-h-[58vh] min-h-[310px] overflow-auto bg-slate-100/80 p-4 dark:bg-slate-950/50" role="tabpanel">
            {machines.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-400">Loading machines from database...</div>
            ) : (
              <div className="grid min-w-[920px] grid-cols-8 auto-rows-[132px] gap-4 rounded-lg border border-slate-300 bg-[linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:32px_32px] p-5 dark:border-slate-700 dark:bg-slate-900/70">
                {sectionMachines.map((m, index) => {
                    const machineState = normalizeLinkState(m.machine_link_status);
                    const botState = normalizeLinkState(m.bot_status);
                    const mapPosition = m.map_position || { row: Math.floor(index / 8) + 1, column: (index % 8) + 1 };
                    const frameClasses = machineState === 'ONLINE'
                      ? 'border-emerald-500 bg-emerald-50/95 shadow-[0_0_0_3px_rgba(16,185,129,0.12)] dark:border-emerald-500 dark:bg-emerald-950/70'
                      : machineState === 'OFFLINE'
                        ? 'border-red-500 bg-red-50/95 shadow-[0_0_0_3px_rgba(239,68,68,0.12)] dark:border-red-500 dark:bg-red-950/60'
                        : 'border-slate-400 bg-white/95 dark:border-slate-600 dark:bg-slate-800/90';
                    return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectAndExpandMachine(m.id)}
                    aria-label={`${isGuestUser ? t('access_insufficient') : t('expand_machine')} ${m.name}`}
                    style={{ gridRowStart: mapPosition.row, gridColumnStart: mapPosition.column }}
                    className={`group relative h-full min-w-0 rounded-lg border-[3px] p-3 text-left font-mono transition-all focus:outline-none focus:ring-4 focus:ring-sky-300 dark:focus:ring-sky-800 ${isGuestUser ? 'cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-lg'} ${frameClasses} ${
                      selectedMachineId === m.id
                        ? 'ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-950'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-slate-900 dark:text-white">{m.id}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-slate-500 dark:text-slate-400">{m.name}</span>
                      </div>
                      {isGuestUser
                        ? <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                        : <Maximize2 className="h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-sky-600" />}
                    </div>
                    <div className={`mt-3 flex items-center gap-2 text-sm font-extrabold ${machineState === 'ONLINE' ? 'text-emerald-700 dark:text-emerald-300' : machineState === 'OFFLINE' ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>
                      <span className={`h-3 w-3 rounded-sm ${linkDotClasses[machineState]}`} />
                      {linkStateLabel(machineState)}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">{m.current_program || t('none')}</span>
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${linkDotClasses[botState]}`} title={`${t('bot_status')}: ${linkStateLabel(botState)}`} />
                    </div>
                  </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Selected machine details remain collapsed until map/QR selection. */}
        {isMachineExpanded && (
        <div ref={machineDetailsRef} className="industrial-card scroll-mt-4 space-y-0">
          <div className="industrial-card-header">
            <span>{t('selected_machine')}{activeMachine.name} [{activeMachine.id}]</span>
            <button
              type="button"
              onClick={() => setIsMachineExpanded(false)}
              className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              {t('collapse_details')}
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Machine Details & Program Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div>
                <div className="text-slate-500">{t('machine_status')}</div>
                {(() => {
                  const state = normalizeLinkState(activeMachine.machine_link_status);
                  return (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold uppercase ${linkStateClasses[state]}`}>
                        <span className={`w-2 h-2 rounded-full ${linkDotClasses[state]}`} />
                        {linkStateLabel(state)}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div>
                <div className="text-slate-500">{t('current_recipe')}</div>
                <div className="text-base font-bold text-sky-600 dark:text-sky-400 mt-1 truncate">
                  {activeMachine.current_program || t('none')}
                </div>
              </div>
              <div>
                <div className="text-slate-500">{t('bot_status')}</div>
                <div className={`text-base font-bold mt-1 ${
                  normalizeLinkState(activeMachine.bot_status) === 'ONLINE' ? 'text-emerald-600' :
                  normalizeLinkState(activeMachine.bot_status) === 'OFFLINE' ? 'text-red-500' : 'text-slate-500'
                }`}>
                  {linkStateLabel(normalizeLinkState(activeMachine.bot_status))}
                </div>
              </div>
            </div>

            {/* Action Banner Message */}
            {actionStatus && (
              <div className={`p-3 rounded border font-mono text-xs flex items-center gap-2 ${
                actionStatus.status === 'RUNNING' ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800' :
                actionStatus.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800' :
                'bg-red-50 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800'
              }`}>
                {actionStatus.status === 'RUNNING' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                 actionStatus.status === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                 <AlertCircle className="w-4 h-4 text-red-600" />}
                <span>{actionStatus.msg}</span>
              </div>
            )}

            {/* SECS/GEM Workflow Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {isGuestUser ? (
                <button
                  type="button"
                  onClick={() => notifyRestrictedAccess(ROLES.OPERATOR)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono-industrial text-[11px] font-bold text-slate-400 flex flex-col items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>{t('pull_recipe')}</span>
                </button>
              ) : (
                <button
                  onClick={handlePullRecipe}
                  disabled={actionStatus?.status === 'RUNNING'}
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-mono-industrial text-[11px] font-bold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1 transition-colors"
                >
                  <Download className="w-4 h-4 text-amber-500" />
                  <span>{t('pull_recipe')}</span>
                </button>
              )}

              {hasPushPermission() ? (
                <button
                  onClick={handlePushRecipe}
                  disabled={actionStatus?.status === 'RUNNING'}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono-industrial text-[11px] font-bold flex flex-col items-center gap-1 shadow transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('push_recipe')}</span>
                </button>
              ) : (
                <button
                  onClick={() => notifyRestrictedAccess(ROLES.OPERATOR)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono-industrial text-[11px] font-bold text-slate-400 flex flex-col items-center gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>{t('push_recipe')}</span>
                </button>
              )}
            </div>

            {/* Authenticated TCP deployment receiver */}
            {hasDeveloperPermission() && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 rounded font-mono text-xs space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      {t('deploy_bot_title')}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {t('deploy_bot_description')}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded border border-sky-300 dark:border-sky-700 text-[10px] font-bold text-sky-700 dark:text-sky-300 flex-shrink-0">
                    TCP :5004
                  </span>
                </div>

                <input
                  ref={deploymentInputRef}
                  type="file"
                  multiple
                  accept=".exe,.ini"
                  disabled={deploymentBusy}
                  onChange={(event) => {
                    const selected = Array.from(event.target.files || []);
                    const allowed = selected.filter(file => ['secs_proxy_bot.exe', 'config.ini'].includes(file.name.toLowerCase()));
                    const rejected = selected.filter(file => !['secs_proxy_bot.exe', 'config.ini'].includes(file.name.toLowerCase()));
                    setDeploymentFiles(allowed);
                    if (rejected.length > 0) {
                      setActionStatus({ type: 'DEPLOY', status: 'ERROR', msg: t('deploy_only_allowed_files') });
                    }
                  }}
                  className="block w-full text-[11px] text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-sky-600 file:text-white file:font-bold hover:file:bg-sky-700 disabled:opacity-50"
                />

                {deploymentFiles.length > 0 && (
                  <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
                    {deploymentFiles.map(file => (
                      <div key={`${file.name}-${file.size}`} className="flex justify-between gap-3">
                        <span>{file.name}</span>
                        <span>{file.size.toLocaleString()} bytes</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDeployFiles}
                  disabled={deploymentBusy || deploymentFiles.length === 0}
                  className="w-full px-3 py-2 rounded bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {deploymentBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {deploymentBusy ? t('deploy_sending') : t('deploy_send_button')}
                </button>
              </div>
            )}

            {/* Push Recipe Selection options */}
            {hasPushPermission() && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded font-mono text-xs space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-300">{t('target_push')}</div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="flex items-center w-full">
                      <input
                        type="text"
                        value={customProgramInput}
                        onChange={(e) => {
                          setCustomProgramInput(e.target.value);
                          setShowRecipeDropdown(true);
                        }}
                        onFocus={() => setShowRecipeDropdown(true)}
                        onBlur={() => setTimeout(() => setShowRecipeDropdown(false), 200)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setShowRecipeDropdown(false);
                            handlePushRecipe();
                          }
                        }}
                        placeholder={t('custom_recipe_placeholder')}
                        className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-r-0 border-slate-300 dark:border-slate-700 rounded-l text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setShowRecipeDropdown(!showRecipeDropdown)}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-r text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors focus:outline-none"
                      >
                        {showRecipeDropdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    {showRecipeDropdown && availableRecipes.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white/90 dark:bg-slate-800/95 backdrop-blur-md border border-slate-300 dark:border-slate-700 rounded shadow-xl max-h-48 overflow-y-auto">
                        {availableRecipes
                          .filter(rcp => rcp.toLowerCase().includes(customProgramInput.toLowerCase()))
                          .map((rcp, idx) => (
                            <div 
                              key={idx}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setCustomProgramInput(rcp);
                                setShowRecipeDropdown(false);
                              }}
                              className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                            >
                              {rcp}
                            </div>
                        ))}
                        {availableRecipes.filter(rcp => rcp.toLowerCase().includes(customProgramInput.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-500 italic">No matches found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteRecipe}
                    disabled={actionStatus?.status === 'RUNNING'}
                    title="Delete recipe from machine"
                    className="p-1.5 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors focus:outline-none disabled:opacity-50 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Event Audit Terminal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono-industrial text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                  {t('section_event_log')}: {activeSectionLabel}
                </h3>
                <button
                  onClick={handleClearLogs}
                  className="text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('purge_log')}
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-800 font-mono text-xs h-48 overflow-y-auto space-y-1.5">
                {visibleEventLogs.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-600 text-center pt-8">{t('no_logs')}</div>
                ) : (
                  visibleEventLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed">
                      <span className="text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">[{log.timestamp}]</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 border ${
                        log.level === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' :
                        log.level === 'ERROR' || log.level === 'ALERT' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-300 dark:border-red-800' :
                        log.level === 'WARN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border-amber-300 dark:border-amber-800' :
                        'bg-sky-100 text-sky-800 dark:bg-slate-800 dark:text-sky-400 border-sky-300 dark:border-slate-700'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-mono">{formatLogMsg(log.message)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {pendingRecipeUpdate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-amber-500 text-slate-950 px-5 py-3.5 flex items-center gap-2.5 font-mono-industrial">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">{t('recipe_update_title')}</span>
            </div>

            <div className="p-5 space-y-4 font-mono-industrial">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {t('recipe_update_description')}
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-xs">
                <span className="text-slate-500">PPID</span>
                <span className="font-bold text-slate-900 dark:text-white break-all">{pendingRecipeUpdate.ppid}</span>
                <span className="text-slate-500">{t('machine')}</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{pendingRecipeUpdate.machine_id}</span>
                <span className="text-slate-500">{t('machine_file')}</span>
                <span className="text-slate-700 dark:text-slate-300">{pendingRecipeUpdate.source_filename}</span>
                <span className="text-slate-500">{t('host_file')}</span>
                <span className="text-slate-700 dark:text-slate-300">{pendingRecipeUpdate.existing_filename}</span>
                <span className="text-slate-500">{t('incoming_size')}</span>
                <span>{Number(pendingRecipeUpdate.incoming_size || 0).toLocaleString()} {t('bytes')}</span>
                <span className="text-slate-500">{t('current_size')}</span>
                <span>{Number(pendingRecipeUpdate.existing_size || 0).toLocaleString()} {t('bytes')}</span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('recipe_update_explanation')}
              </p>

              {!hasDeletePermission() && (
                <div className="text-xs rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-2">
                  {t('update_auth_required')}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                <button
                  disabled={pendingDecisionBusy}
                  onClick={() => resolvePendingRecipe('reject')}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold tracking-wide"
                >
                  {t('reject_update')}
                </button>
                <button
                  disabled={pendingDecisionBusy}
                  onClick={() => resolvePendingRecipe('approve')}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold tracking-wide"
                >
                  {pendingDecisionBusy ? t('processing') : t('accept_update')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-red-600 text-white px-5 py-3.5 flex items-center justify-between font-mono-industrial">
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-5 h-5" />
                <span className="font-semibold text-sm tracking-wide uppercase">{t('confirm_deletion')}</span>
              </div>
              <button
                onClick={() => setDeleteConfirmModal({ isOpen: false, recipe: '' })}
                className="text-red-200 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-100 dark:bg-red-950/60 rounded-full border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('delete_recipe_question')}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {t('delete_recipe_text_before')} <strong className="text-red-600 dark:text-red-400">'{deleteConfirmModal.recipe}'</strong> {language === 'TH' ? `ออกจาก ${activeMachine?.name} อย่างถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้` : `from ${activeMachine?.name}? This action cannot be undone.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono-industrial text-xs">
                <button
                  onClick={() => setDeleteConfirmModal({ isOpen: false, recipe: '' })}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    executeDelete(deleteConfirmModal.recipe);
                    setDeleteConfirmModal({ isOpen: false, recipe: '' });
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors shadow-sm uppercase tracking-wider"
                >
                  {t('confirm_delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fuzzy Suggestion Modal */}
      {fuzzyModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between font-mono-industrial">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-base tracking-wide">{t('recipe_not_found')}</span>
              </div>
              <button onClick={() => setFuzzyModalConfig({ isOpen: false, original: '', suggestion: '' })} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 font-mono-industrial">
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm leading-relaxed">
                {t('recipe_not_found_before')} <strong className="text-slate-900 dark:text-white">'{fuzzyModalConfig.original}'</strong> {t('recipe_not_found_after')}
              </p>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md mb-6">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t('did_you_mean')}</div>
                <div className="font-bold text-sky-600 dark:text-sky-400 text-base">{fuzzyModalConfig.suggestion}</div>
              </div>

              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => {
                    setFuzzyModalConfig({ isOpen: false, original: '', suggestion: '' });
                    setActionStatus({ type: 'PUSH', status: 'IDLE', msg: 'Push cancelled by user.' });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-semibold transition-colors text-sm"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={() => {
                    const sugg = fuzzyModalConfig.suggestion;
                    setCustomProgramInput(sugg);
                    setFuzzyModalConfig({ isOpen: false, original: '', suggestion: '' });
                    handlePushRecipe(sugg);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold shadow transition-colors flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('accept_and_push')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
