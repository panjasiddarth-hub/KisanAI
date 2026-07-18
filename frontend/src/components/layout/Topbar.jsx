// src/components/layout/Topbar.jsx
// Sticky topbar with search, notifications, dark mode toggle

import { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, Sun, Moon, X, CheckCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const TYPE_COLORS = {
  alert: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  success: 'text-green-500',
};

export default function Topbar({ onMenuClick, title }) {
  const { dark, toggle } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [search, setSearch] = useState('');
  const notifRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="topbar">
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-[var(--color-text-muted)]" />
      </button>

      {/* Page title */}
      <h1 className="font-bold text-lg text-[var(--color-text)] hidden sm:block">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search crops, farms, schemes..."
          className="input pl-9 pr-4 py-2 text-sm w-64 h-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3">
            <X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          </button>
        )}
      </div>

      {/* Dark mode */}
      <button
        onClick={toggle}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle dark mode"
      >
        {dark
          ? <Sun className="w-5 h-5 text-amber-400" />
          : <Moon className="w-5 h-5 text-slate-600" />
        }
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif(v => !v)}
          className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-[var(--color-text-muted)]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[0.6rem] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute right-0 top-12 w-80 card z-50 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <span className="font-semibold text-sm text-[var(--color-text)]">Notifications</span>
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="text-center text-sm text-[var(--color-text-muted)] py-6">No notifications</p>
              )}
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-[var(--color-border)] last:border-0 transition-colors ${!n.read ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.read ? 'bg-green-500' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${TYPE_COLORS[n.type]} mb-0.5`}>{n.type.toUpperCase()}</p>
                    <p className="text-xs text-[var(--color-text)] leading-relaxed">{n.message}</p>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <button
        onClick={() => navigate('/profile')}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow hover:shadow-md transition-shadow"
      >
        {user?.name?.[0]?.toUpperCase() || 'U'}
      </button>
    </header>
  );
}
