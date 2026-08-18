import React, { useState, useEffect, useRef } from 'react';
import { useAuth, ROLES } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Cpu, Send, Download, Lock, ShieldCheck, CheckCircle2, 
  RefreshCw, Layers, Database, AlertCircle, Scan, Wifi, Trash2, Radio, Server, X,
  ChevronDown, ChevronUp
} from 'lucide-react';

const RATS_API_BASE = 'http://127.0.0.1:8080';
const RATS_WS_URL = 'ws://127.0.0.1:8080/ws';

export const RatsView = ({ onRequireElevatedAuth }) => {
  const { currentRole, hasPushPermission } = useAuth();
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
  const [memsStateMap, setMemsStateMap] = useState({});

  const wsRef = useRef(null);
  const selectedMachineIdRef = useRef(selectedMachineId);

  useEffect(() => {
    selectedMachineIdRef.current = selectedMachineId;
  }, [selectedMachineId]);

  // Poll MEMS for live machine states (RUNNING / IDLE / DOWN) every 3 seconds
  useEffect(() => {
    const fetchMemsStates = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/mems/machines', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const items = await res.json();
          const map = {};
          items.forEach(m => {
            if (m.id)   map[m.id]   = m.state;
            if (m.name) map[m.name] = m.state;
          });
          setMemsStateMap(map);
        }
      } catch (_) {}
    };
    fetchMemsStates();
    const interval = setInterval(fetchMemsStates, 3000);
    return () => clearInterval(interval);
  }, []);

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
    id: 'WB#81', name: 'Wire Bonder #81', ip: '169.254.13.81', port: 5000, status: 'IDLE', current_program: 'None', link_status: 'CONNECTING'
  };

  // Barcode Lookup
  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (!serialInput.trim()) return;
    const term = serialInput.trim();

    try {
      setActionStatus({ type: 'SCAN', status: 'RUNNING', msg: `Looking up barcode serial '${term}'...` });
      const res = await fetch(`${RATS_API_BASE}/api/lookup/${encodeURIComponent(term)}`);
      const data = await res.json();

      if (res.ok && data.machine) {
        setSelectedMachineId(data.machine.id);
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
        method: 'POST'
      });
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'PULL', status: 'SUCCESS', msg: `Recipe Pull SUCCESS for ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'ONLINE' } : m));
      } else {
        const err = data.result?.message || data.error || 'Pull failed';
        setActionStatus({ type: 'PULL', status: 'ERROR', msg: `Recipe Pull FAILED: ${err}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'OFFLINE' } : m));
      }
    } catch (err) {
      setActionStatus({ type: 'PULL', status: 'ERROR', msg: `Network request failed: ${err.message}` });
    }
  };

  // Push Recipe
  const handlePushRecipe = async (programOverride = null) => {
    if (!hasPushPermission()) {
      onRequireElevatedAuth(ROLES.TECHNICIAN);
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_name: programToPush })
        });
        
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_name: programToPush })
      });
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'PUSH', status: 'SUCCESS', msg: `Recipe Push SUCCESS: Loaded '${programToPush}' on ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, current_program: programToPush, link_status: 'ONLINE' } : m));
      } else {
        const err = data.result?.message || data.error || 'Push failed';
        setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Recipe Push FAILED: ${err}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, link_status: 'OFFLINE' } : m));
      }
    } catch (err) {
      setActionStatus({ type: 'PUSH', status: 'ERROR', msg: `Network request failed: ${err.message}` });
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = async () => {
    if (!hasPushPermission()) {
      onRequireElevatedAuth(ROLES.TECHNICIAN);
      return;
    }

    const programToDelete = customProgramInput.trim();
    if (!programToDelete) {
      setActionStatus({ type: 'DELETE', status: 'ERROR', msg: 'Please enter a recipe program name to delete.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete '${programToDelete}' from ${activeMachine.name}? This action cannot be undone.`)) {
      return;
    }

    setActionStatus({ type: 'DELETE', status: 'RUNNING', msg: `Executing Recipe Deletion '${programToDelete}' from ${activeMachine.name}...` });

    try {
      const res = await fetch(`${RATS_API_BASE}/api/machines/${encodeURIComponent(activeMachine.id)}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_name: programToDelete })
      });
      const data = await res.json();
      if (data.result && data.result.status === 'ok') {
        setActionStatus({ type: 'DELETE', status: 'SUCCESS', msg: `Recipe Deletion SUCCESS: Removed '${programToDelete}' from ${activeMachine.name}` });
        setMachines(prev => prev.map(m => m.id === activeMachine.id ? { ...m, current_program: (m.current_program === programToDelete ? 'None' : m.current_program), link_status: 'ONLINE' } : m));
        // Clear input after successful delete
        setCustomProgramInput('');
      } else {
        const err = data.result?.message || data.error || 'Delete failed';
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
      await fetch(`${RATS_API_BASE}/api/logs/clear`, { method: 'POST' });
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Machine Fleet List */}
        <div className="industrial-card lg:col-span-1">
          <div className="industrial-card-header">
            <span>{t('bonder_fleet')}</span>
            <span className="text-xs text-slate-500 font-mono">{machines.length}{t('machines_count')}</span>
          </div>

          <div className="p-3 space-y-2 max-h-[520px] overflow-y-auto">
            {machines.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-400">Loading machines from database...</div>
            ) : (
              machines.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMachineId(m.id)}
                  className={`w-full text-left p-3 rounded border font-mono transition-all ${
                    selectedMachineId === m.id
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{m.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      m.link_status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' :
                      m.link_status === 'CONNECTING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800' :
                      m.link_status === 'CONN. LOST' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800 animate-pulse' :
                      m.link_status === 'OFFLINE' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}>
                      {m.link_status === 'ONLINE' ? t('online') : 
                       m.link_status === 'OFFLINE' ? t('offline') : 
                       m.link_status === 'CONNECTING' ? t('connecting', 'CONNECTING') : 
                       m.link_status === 'CONN. LOST' ? t('conn_lost', 'CONN. LOST') : m.link_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="font-semibold">{m.id}</span>
                    <span className="font-mono text-slate-400 truncate max-w-[110px]">{m.current_program || t('none')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Selected Machine Action Panel */}
        <div className="industrial-card lg:col-span-2 space-y-0">
          <div className="industrial-card-header">
            <span>{t('selected_machine')}{activeMachine.name} [{activeMachine.id}]</span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-mono">
              {t('protocol_hsms')}
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Machine Details & Program Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div>
                <div className="text-slate-500">{t('machine_status')}</div>
                {(() => {
                  const memsState = memsStateMap[activeMachine.id] || memsStateMap[activeMachine.name];
                  const state = memsState || activeMachine.status || 'UNKNOWN';
                  const stateColors = {
                    RUNNING: 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700',
                    IDLE:    'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
                    DOWN:    'bg-red-100 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300 dark:border-red-700',
                    OFFLINE: 'bg-slate-100 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600',
                  };
                  const dotColors = {
                    RUNNING: 'bg-emerald-500 animate-pulse',
                    IDLE:    'bg-amber-400 animate-pulse',
                    DOWN:    'bg-red-500 animate-pulse',
                    OFFLINE: 'bg-slate-400',
                  };
                  const colorClass = stateColors[state] || stateColors.OFFLINE;
                  const dotClass  = dotColors[state]  || dotColors.OFFLINE;
                  return (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-bold uppercase ${colorClass}`}>
                        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                        {state}
                      </span>
                      {memsState && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">MEMS</span>
                      )}
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
                <div className="text-slate-500">{t('link_status')}</div>
                <div className={`text-base font-bold mt-1 ${
                  activeMachine.link_status === 'ONLINE' ? 'text-emerald-600' :
                  activeMachine.link_status === 'CONNECTING' ? 'text-amber-500' :
                  activeMachine.link_status === 'CONN. LOST' ? 'text-red-500 animate-pulse' :
                  activeMachine.link_status === 'OFFLINE' ? 'text-red-500' : 'text-slate-500'
                }`}>
                  {activeMachine.link_status === 'ONLINE' ? t('online') : 
                   activeMachine.link_status === 'OFFLINE' ? t('offline') : 
                   activeMachine.link_status === 'CONNECTING' ? t('connecting', 'CONNECTING') : 
                   activeMachine.link_status === 'CONN. LOST' ? t('conn_lost', 'CONN. LOST') : activeMachine.link_status}
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

              <button
                onClick={handlePullRecipe}
                disabled={actionStatus?.status === 'RUNNING'}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded font-mono-industrial text-[11px] font-bold text-slate-800 dark:text-slate-200 flex flex-col items-center gap-1 transition-colors"
              >
                <Download className="w-4 h-4 text-amber-500" />
                <span>{t('pull_recipe')}</span>
              </button>

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
                  onClick={() => onRequireElevatedAuth(ROLES.TECHNICIAN)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono-industrial text-[11px] font-bold text-slate-400 flex flex-col items-center gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Lock className="w-4 h-4 text-amber-500" />
                  <span>{t('push_recipe')}</span>
                </button>
              )}
            </div>

            {/* Push Recipe Selection options */}
            {hasPushPermission() && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded font-mono text-xs space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-300">{t('target_push')}</div>
                <div className="relative flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full">
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
                    <button
                      type="button"
                      onClick={handleDeleteRecipe}
                      disabled={actionStatus?.status === 'RUNNING'}
                      title="Delete recipe from machine"
                      className="ml-2 p-1.5 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800 rounded text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors focus:outline-none disabled:opacity-50 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                </div>
              </div>
            )}

            {/* Event Audit Terminal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono-industrial text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                  {t('event_log_title')}
                </h3>
                <button
                  onClick={handleClearLogs}
                  className="text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('purge_log')}
                </button>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-800 font-mono text-xs h-48 overflow-y-auto space-y-1.5">
                {eventLogs.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-600 text-center pt-8">{t('no_logs')}</div>
                ) : (
                  eventLogs.map((log, idx) => (
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
      </div>

      {/* Fuzzy Suggestion Modal */}
      {fuzzyModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between font-mono-industrial">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-base tracking-wide">RECIPE NOT FOUND</span>
              </div>
              <button onClick={() => setFuzzyModalConfig({ isOpen: false, original: '', suggestion: '' })} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 font-mono-industrial">
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm leading-relaxed">
                The exact recipe <strong className="text-slate-900 dark:text-white">'{fuzzyModalConfig.original}'</strong> was not found locally. 
                However, a closely matching recipe exists on the server.
              </p>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md mb-6">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Did you mean:</div>
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
                  Cancel
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
                  Accept & Push
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
