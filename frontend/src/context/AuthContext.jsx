// src/context/AuthContext.jsx
// Provides authentication state and helpers via React Context API

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Mock user data for frontend demo
const MOCK_USERS = [
  { id: '1', name: 'Ramesh Kumar', email: 'ramesh@kisan.com', password: 'password123', role: 'farmer', avatar: null, phone: '+91 98765 43210', location: 'Pune, Maharashtra' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('kisan_user');
      const savedToken = localStorage.getItem('kisan_token');
      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      }
    } catch {
      // ignore corrupt data
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Login with email + password.
   * Returns { success, error }
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // simulate network delay
    const found = MOCK_USERS.find(u => u.email === email && u.password === password);
    if (!found) {
      setLoading(false);
      return { success: false, error: 'Invalid email or password.' };
    }
    const { password: _, ...safeUser } = found;
    const fakeToken = btoa(`${safeUser.id}:${Date.now()}`);
    setUser(safeUser);
    setToken(fakeToken);
    localStorage.setItem('kisan_user', JSON.stringify(safeUser));
    localStorage.setItem('kisan_token', fakeToken);
    setLoading(false);
    return { success: true };
  }, []);

  /**
   * Register new user (mock).
   */
  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    const exists = MOCK_USERS.find(u => u.email === email);
    if (exists) {
      setLoading(false);
      return { success: false, error: 'Email already registered.' };
    }
    const newUser = { id: String(Date.now()), name, email, role: 'farmer', avatar: null, phone: '', location: '' };
    const fakeToken = btoa(`${newUser.id}:${Date.now()}`);
    setUser(newUser);
    setToken(fakeToken);
    localStorage.setItem('kisan_user', JSON.stringify(newUser));
    localStorage.setItem('kisan_token', fakeToken);
    setLoading(false);
    return { success: true };
  }, []);

  /** Logout */
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kisan_user');
    localStorage.removeItem('kisan_token');
  }, []);

  /** Update profile */
  const updateProfile = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('kisan_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, isAuthenticated: !!user }}>
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
