// src/components/layout/Sidebar.jsx
// Left navigation rail — logo, menu, profile card, upgrade card

import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Bot, Warehouse, CalendarDays, CloudSun, BarChart3,
  Stethoscope, Droplets, Landmark, TrendingUp, Bell, Settings,
  Sprout, ChevronDown, Sparkles, LogOut, User, X, FlaskConical, CalendarCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'AI Assistant', icon: Bot, path: '/ai-assistant' },
  { label: 'Crop Suggester', icon: Sprout, path: '/agents/crop' },
  { label: 'Fertilizer Agent', icon: FlaskConical, path: '/agents/fertilizer' },
  { label: 'Diseases', icon: Stethoscope, path: '/disease' },
  { label: 'Farm Calendar', icon: CalendarCheck, path: '/calendar' },
  { label: 'My Farm', icon: Warehouse, path: '/farms' },
  { label: 'Crop Planning', icon: CalendarDays, path: '/crops' },
  { label: 'Weather', icon: CloudSun, path: '/weather' },
  { label: 'Market Intelligence', icon: BarChart3, path: '/market' },
  { label: 'Irrigation', icon: Droplets, path: '/irrigation' },
  { label: 'Finance & Schemes', icon: Landmark, path: '/schemes' },
  { label: 'Analytics', icon: TrendingUp, path: '/analytics' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Settings', icon: Settings, path: '/profile' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || 'S').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-green-950 shrink-0">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-[0.92rem] leading-[1.15] text-[var(--color-text)]">Sampoorn Kisan<br />AI Sahayak</p>
              <p className="text-[0.68rem] text-[var(--color-text-muted)] mt-0.5">AI for Smarter Farming</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-1 px-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon style={{ width: 18, height: 18 }} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Profile card */}
        <div className="px-3 pb-2 relative" ref={profileRef}>
          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 card z-50 overflow-hidden shadow-2xl">
              <button
                onClick={() => { setProfileOpen(false); onClose?.(); navigate('/profile'); }}
                className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <User className="w-4 h-4 text-green-600" /> Profile & Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border-t border-[var(--color-border)]"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:shadow-md transition-shadow text-left"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-700 flex items-center justify-center font-bold text-white text-sm shadow shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-[var(--color-text)] truncate leading-tight">{user?.name || 'Guest Farmer'}</p>
              <p className="text-[0.7rem] text-[var(--color-text-muted)] truncate">{user?.location || 'Telangana, India'}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Upgrade card */}
        <div className="p-3">
          <div className="rounded-2xl bg-gradient-to-br from-green-700 to-emerald-900 p-4 text-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <Sparkles className="w-4 h-4" /> Upgrade to Pro
            </div>
            <p className="text-[0.72rem] text-green-100 mt-1.5 mb-3">Unlock advanced AI insights</p>
            <button
              onClick={() => navigate('/profile')}
              className="w-full bg-white text-green-800 font-bold text-xs py-2.5 rounded-xl hover:bg-green-50 transition-colors"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
