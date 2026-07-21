// src/components/layout/Topbar.jsx
// Sticky topbar — search (Ctrl+K), theme, language, notifications, Ask AI button

import { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, Sun, Moon, X, CheckCheck, Globe, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  alert: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  success: 'text-green-500',
};

export default function Topbar({ onMenuClick, title }) {
  const { dark, toggle } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [showNotif, setShowNotif] = useState(false);
  const [search, setSearch] = useState('');
  const notifRef = useRef(null);
  const searchRef = useRef(null);

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

  // Ctrl/Cmd + K focuses search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const iconBtn = 'relative p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:shadow-md transition-all';

  return (
    <header className="topbar" style={{ borderBottom: 'none' }}>
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-[var(--color-text-muted)]" />
      </button>

      {/* Page title (mobile only) */}
      <h1 className="font-bold text-base text-[var(--color-text)] md:hidden">{title}</h1>

      {/* Search */}
      <div className="relative hidden md:flex items-center w-full max-w-md">
        <Search className="absolute left-3.5 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && search.trim()) toast(`Searching for “${search.trim()}”`, { icon: '🔍' }); }}
          placeholder="Search anything..."
          className="input pl-10 pr-20 py-2.5 text-sm rounded-2xl border-[var(--color-border)] shadow-sm"
        />
        {search
          ? <button onClick={() => setSearch('')} className="absolute right-3"><X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /></button>
          : <span className="kbd absolute right-3">Ctrl + K</span>
        }
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dark mode */}
      <button onClick={toggle} className={iconBtn} aria-label="Toggle dark mode" title="Toggle theme">
        {dark
          ? <Sun className="w-[18px] h-[18px] text-amber-400" />
          : <Moon className="w-[18px] h-[18px] text-slate-500" />
        }
      </button>

      {/* Language */}
      <button
        onClick={() => toast('Language support (English / हिंदी / తెలుగు) coming soon!', { icon: '🌐' })}
        className={iconBtn}
        aria-label="Language"
        title="Language"
      >
        <Globe className="w-[18px] h-[18px] text-slate-500 dark:text-slate-300" />
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotif(v => !v)}
          className={iconBtn}
          aria-label="Notifications"
        >
          <Bell className="w-[18px] h-[18px] text-slate-500 dark:text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] px-0.5 bg-red-500 text-white text-[0.62rem] font-bold rounded-full flex items-center justify-center ring-2 ring-[var(--color-bg)]">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute right-0 top-14 w-80 card z-50 shadow-2xl overflow-hidden">
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

      {/* Ask AI */}
      <button
        onClick={() => navigate('/ai-assistant')}
        className="hidden sm:flex items-center gap-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-green-900/15 transition-colors"
      >
        <Sparkles className="w-4 h-4" /> Ask AI Assistant
      </button>
    </header>
  );
}
