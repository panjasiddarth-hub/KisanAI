// src/context/AuthContext.jsx
// Authentication via the KisanAI backend API, with an offline demo fallback
// so the UI still demos when the server isn't running (e.g. static preview).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';

const AuthContext = createContext(null);

// Offline demo account (mirrors the backend's seeded user)
const DEMO_USER = { email: 'siddarth@kisan.com', password: 'password123', profile: { id: 'demo-1', name: 'Siddarth R.', email: 'siddarth@kisan.com', role: 'farmer', avatar: null, phone: '+91 98491 23456', location: 'Warangal, Telangana' } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persist = (u, t) => {
    setUser(u); setToken(t);
    try {
      if (u && t) { localStorage.setItem('kisan_user', JSON.stringify(u)); localStorage.setItem('kisan_token', t); }
      else { localStorage.removeItem('kisan_user'); localStorage.removeItem('kisan_token'); }
    } catch { /* sandboxed preview */ }
  };

  // Hydrate from localStorage, then quietly re-validate with the API when it's up
  useEffect(() => {
    let savedUser = null, savedToken = null;
    try { savedUser = localStorage.getItem('kisan_user'); savedToken = localStorage.getItem('kisan_token'); } catch { /* sandbox */ }
    if (savedUser && savedToken) {
      try { setUser(JSON.parse(savedUser)); } catch { /* corrupt */ }
      setToken(savedToken);
      api.get('/auth/me')
        .then(r => { setUser(r.data.user); try { localStorage.setItem('kisan_user', JSON.stringify(r.data.user)); } catch {} })
        .catch(err => { if (err?.response?.status === 401) persist(null, null); /* stale token on fresh backend */ });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      persist(data.user, data.token);
      return { success: true };
    } catch (err) {
      if (isOfflineError(err)) {
        // Offline fallback — demo account only
        if (import.meta.env.DEV && email === DEMO_USER.email && password === DEMO_USER.password) {
          persist(DEMO_USER.profile, btoa(`demo:${Date.now()}`));
          return { success: true, offline: true };
        }
        return {
          success: false,
          error: import.meta.env.DEV
            ? 'Backend is offline. Start it with "cd backend && npm start", or use the local demo login.'
            : 'Sign-in service is unavailable. Please try again later.',
        };
      }
      return { success: false, error: apiErrorMessage(err, 'Login failed') };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      persist(data.user, data.token);
      return { success: true };
    } catch (err) {
      if (isOfflineError(err)) {
        return { success: false, error: 'Backend is offline — registration needs the API running (cd backend && npm start).' };
      }
      return { success: false, error: apiErrorMessage(err, 'Registration failed') };
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      persist(data.user, data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: apiErrorMessage(err, 'Password could not be changed') };
    }
  }, []);

  const deleteAccount = useCallback(async (password, confirmEmail) => {
    try {
      const { data } = await api.delete('/auth/account', { data: { password, confirmEmail } });
      persist(null, null);
      return { success: true, deleted: data.deleted };
    } catch (err) {
      return { success: false, error: apiErrorMessage(err, 'Account could not be deleted') };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      let hasToken = false;
      try { hasToken = !!localStorage.getItem('kisan_token'); } catch { /* sandbox */ }
      if (hasToken) await api.post('/auth/logout', {}, { timeout: 5000 });
    } catch { /* Always clear this device locally if the API is offline. */ }
    finally { persist(null, null); }
  }, []);

  const updateProfile = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      try { localStorage.setItem('kisan_user', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, changePassword, deleteAccount, logout, updateProfile, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
