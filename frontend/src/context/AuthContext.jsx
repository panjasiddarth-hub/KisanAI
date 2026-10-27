// src/context/AuthContext.jsx
// Authentication is always verified by the KisanAI backend API.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';

const AuthContext = createContext(null);

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
        .catch(() => persist(null, null));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (identifier, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      persist(data.user, data.token);
      return { success: true };
    } catch (err) {
      if (isOfflineError(err)) return { success: false, error: 'Sign-in service is unavailable. Start the backend and try again.' };
      return { success: false, error: apiErrorMessage(err, 'Login failed') };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name, contactType, contact, password) => {
    try {
      const { data } = await api.post('/auth/register', { name, contactType, contact, password });
      return { success: true, pending: true, message: data.message };
    } catch (err) {
      if (isOfflineError(err)) {
        return { success: false, error: 'Backend is offline — registration needs the API running (cd backend && npm start).' };
      }
      return { success: false, error: apiErrorMessage(err, 'Registration failed') };
    }
  }, []);

  const verifySignupOtp = useCallback(async (contactType, contact, code) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { contactType, contact, code });
      persist(data.user, data.token);
      return { success: true };
    } catch (err) {
      return { success: false, error: apiErrorMessage(err, 'Verification failed') };
    } finally { setLoading(false); }
  }, []);

  const requestPasswordReset = useCallback(async (contactType, contact) => {
    try {
      const { data } = await api.post('/auth/forgot-password', { contactType, contact });
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: apiErrorMessage(err, 'Could not request a reset code') };
    }
  }, []);

  const resetPassword = useCallback(async (contactType, contact, code, newPassword) => {
    try {
      const { data } = await api.post('/auth/reset-password', { contactType, contact, code, newPassword });
      persist(null, null);
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: apiErrorMessage(err, 'Password could not be reset') };
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

  const deleteAccount = useCallback(async (password, confirmContact) => {
    try {
      const { data } = await api.delete('/auth/account', { data: { password, confirmContact } });
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
    <AuthContext.Provider value={{ user, token, loading, login, register, verifySignupOtp, requestPasswordReset, resetPassword, changePassword, deleteAccount, logout, updateProfile, isAuthenticated: !!user }}>
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
