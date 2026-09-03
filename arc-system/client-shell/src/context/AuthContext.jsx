import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export const ROLES = {
  GUEST: 'Guest',
  OPERATOR: 'Operator',
  TECHNICIAN: 'Technician',
  ADMINISTRATOR: 'Administrator',
  DEVELOPER: 'Developer'
};

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const INACTIVITY_WARNING_MS = 30 * 1000; // warn 30 seconds before automatic logoff
const RATS_HOST = window.location.hostname || '127.0.0.1';
const RATS_HTTP_SCHEME = window.location.protocol === 'https:' ? 'https' : 'http';
const RATS_API_BASE = import.meta.env.VITE_RATS_API_BASE || `${RATS_HTTP_SCHEME}://${RATS_HOST}:8080`;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize role from localStorage if activity was within the last 5 minutes
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      const savedRole = localStorage.getItem('activeUserRole');
      const savedToken = localStorage.getItem('ratsSessionToken');
      const lastActivity = localStorage.getItem('lastActivityTimestamp');
      
      if (savedRole && savedRole !== ROLES.GUEST && savedToken && lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed < INACTIVITY_TIMEOUT_MS) {
          localStorage.setItem('lastActivityTimestamp', Date.now().toString());
          return savedRole;
        } else {
          // Session expired due to inactivity
          localStorage.removeItem('activeUserRole');
          localStorage.removeItem('ratsSessionToken');
          localStorage.removeItem('activeEmployeeNumber');
          localStorage.removeItem('lastActivityTimestamp');
        }
      }
    } catch (err) {
      console.error('Error restoring auth session state:', err);
    }
    return ROLES.GUEST;
  });

  const [sessionToken, setSessionToken] = useState(() => {
    try {
      const savedRole = localStorage.getItem('activeUserRole');
      const savedToken = localStorage.getItem('ratsSessionToken');
      const lastActivity = localStorage.getItem('lastActivityTimestamp');
      if (savedRole && savedToken && lastActivity && Date.now() - parseInt(lastActivity, 10) < INACTIVITY_TIMEOUT_MS) {
        return savedToken;
      }
    } catch (err) {
      console.error('Error restoring auth token:', err);
    }
    return '';
  });

  const [employeeNumber, setEmployeeNumber] = useState(() => {
    return localStorage.getItem('activeEmployeeNumber') || '';
  });

  const [authError, setAuthError] = useState('');
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState(null);
  const lastUpdateRef = useRef(Date.now());
  const warningVisibleRef = useRef(false);

  // Function to update session role and localStorage
  const updateSessionRole = (role, token = '', employeeNo = '') => {
    setCurrentRole(role);
    if (role !== ROLES.GUEST) {
      const now = Date.now().toString();
      setSessionToken(token);
      setEmployeeNumber(employeeNo);
      localStorage.setItem('activeUserRole', role);
      localStorage.setItem('ratsSessionToken', token);
      localStorage.setItem('activeEmployeeNumber', employeeNo);
      localStorage.setItem('lastActivityTimestamp', now);
      lastUpdateRef.current = Date.now();
      warningVisibleRef.current = false;
      setSessionWarningSeconds(null);
    } else {
      setSessionToken('');
      setEmployeeNumber('');
      localStorage.removeItem('activeUserRole');
      localStorage.removeItem('ratsSessionToken');
      localStorage.removeItem('activeEmployeeNumber');
      localStorage.removeItem('lastActivityTimestamp');
      warningVisibleRef.current = false;
      setSessionWarningSeconds(null);
    }
  };

  // Activity handler to reset 5-minute timeout window
  const updateActivity = useCallback(() => {
    if (currentRole === ROLES.GUEST || warningVisibleRef.current) return;
    const now = Date.now();
    // Throttle updates to localStorage once every 2 seconds
    if (now - lastUpdateRef.current > 2000) {
      lastUpdateRef.current = now;
      try {
        localStorage.setItem('lastActivityTimestamp', now.toString());
      } catch (e) {
        console.error('Failed to update activity timestamp:', e);
      }
    }
  }, [currentRole]);

  const staySignedIn = useCallback(() => {
    if (currentRole === ROLES.GUEST) return;
    const now = Date.now();
    lastUpdateRef.current = now;
    localStorage.setItem('lastActivityTimestamp', now.toString());
    warningVisibleRef.current = false;
    setSessionWarningSeconds(null);
  }, [currentRole]);

  // Set up activity listeners & periodic inactivity check interval
  useEffect(() => {
    if (currentRole === ROLES.GUEST) return;

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, updateActivity));

    // Periodically check if 5 minutes of inactivity has passed
    const intervalId = setInterval(() => {
      const lastActivity = localStorage.getItem('lastActivityTimestamp');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
        if (remaining <= 0) {
          if (sessionToken) {
            fetch(`${RATS_API_BASE}/api/auth/logout`, {
              method: 'POST',
              headers: { 'X-Session-Token': sessionToken }
            }).catch(() => {});
          }
          updateSessionRole(ROLES.GUEST);
          setAuthError('Session expired due to 5 minutes of inactivity.');
        } else if (remaining <= INACTIVITY_WARNING_MS) {
          warningVisibleRef.current = true;
          setSessionWarningSeconds(Math.max(1, Math.ceil(remaining / 1000)));
        } else if (warningVisibleRef.current) {
          warningVisibleRef.current = false;
          setSessionWarningSeconds(null);
        }
      }
    }, 1000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(intervalId);
    };
  }, [currentRole, sessionToken, updateActivity]);

  const login = async (employeeNo, username, password) => {
    try {
      const res = await fetch(`${RATS_API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_number: employeeNo, username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || 'Invalid username or password';
        setAuthError(message);
        return { success: false, message };
      }
      if (sessionToken) {
        await fetch(`${RATS_API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-Session-Token': sessionToken }
        }).catch(() => {});
      }
      updateSessionRole(data.role, data.token, data.employee_number);
      setAuthError('');
      return { success: true, role: data.role };
    } catch (err) {
      const message = `Login server unavailable: ${err.message}`;
      setAuthError(message);
      return { success: false, message };
    }
  };

  const loginWithPasscode = (employeeNo, passcode) => {
    return login(employeeNo, passcode, passcode);
  };

  const logoutToGuest = () => {
    if (sessionToken) {
      fetch(`${RATS_API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'X-Session-Token': sessionToken }
      }).catch(() => {});
    }
    updateSessionRole(ROLES.GUEST);
    setAuthError('');
  };

  const isGuest = () => currentRole === ROLES.GUEST;
  const canViewRats = () => currentRole !== ROLES.GUEST;
  const hasPushPermission = () => currentRole === ROLES.OPERATOR || currentRole === ROLES.TECHNICIAN || currentRole === ROLES.ADMINISTRATOR || currentRole === ROLES.DEVELOPER;
  const hasDeletePermission = () => currentRole === ROLES.TECHNICIAN || currentRole === ROLES.ADMINISTRATOR || currentRole === ROLES.DEVELOPER;
  const hasAdminPermission = () => currentRole === ROLES.ADMINISTRATOR || currentRole === ROLES.DEVELOPER;
  const hasDeveloperPermission = () => currentRole === ROLES.DEVELOPER;
  const authHeaders = () => sessionToken ? { 'X-Session-Token': sessionToken } : {};

  return (
    <AuthContext.Provider value={{
      currentRole,
      employeeNumber,
      sessionToken,
      authHeaders,
      login,
      loginWithPasscode,
      logoutToGuest,
      isGuest,
      canViewRats,
      hasPushPermission,
      hasDeletePermission,
      hasAdminPermission,
      hasDeveloperPermission,
      authError,
      setAuthError,
      sessionWarningSeconds,
      staySignedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
