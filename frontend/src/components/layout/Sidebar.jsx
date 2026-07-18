// src/components/layout/Sidebar.jsx
// Collapsible sidebar navigation

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Warehouse, Sprout, CloudSun, Bug, Droplets,
  TrendingUp, BookOpen, BarChart3, Bot, User, LogOut, Leaf, X, ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'My Farms', icon: Warehouse, path: '/farms' },
  { label: 'Crops', icon: Sprout, path: '/crops' },
  { label: 'Weather', icon: CloudSun, path: '/weather' },
  { label: 'Disease Detection', icon: Bug, path: '/disease' },
  { label: 'Irrigation', icon: Droplets, path: '/irrigation' },
  { label: 'Market', icon: TrendingUp, path: '/market' },
  { label: 'Gov. Schemes', icon: BookOpen, path: '/schemes' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'AI Assistant', icon: Bot, path: '/ai-assistant' },
];

const BOTTOM_ITEMS = [
  { label: 'Profile', icon: User, path: '/profile' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        <div className="flex items-center justify-between px-5 py-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200 dark:shadow-green-900">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[0.85rem] leading-tight text-[var(--color-text)]">Sampoorn Kisan</p>
              <p className="text-[0.68rem] text-[var(--color-text-muted)]">AI Sahayak</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* User card */}
        <div className="mx-3 my-3 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-100 dark:border-green-900/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-[var(--color-text)] truncate">{user?.name || 'Guest'}</p>
              <span className="badge badge-green text-[0.6rem]">
                🌾 Farmer
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-1">
          <p className="px-4 py-1 text-[0.65rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">Main Menu</p>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ width: 14, height: 14 }} />
            </NavLink>
          ))}

          <div className="mt-4 border-t border-[var(--color-border)] pt-3">
            <p className="px-4 py-1 text-[0.65rem] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">Account</p>
            {BOTTOM_ITEMS.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon style={{ width: 18, height: 18 }} />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="sidebar-link w-full text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/30 hover:!text-red-600"
            >
              <LogOut style={{ width: 18, height: 18 }} />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--color-border)]">
          <p className="text-[0.65rem] text-[var(--color-text-muted)] text-center">
            Sampoorn Kisan AI Sahayak v1.0 <br />
            B.Tech Major Project 2026
          </p>
        </div>
      </aside>
    </>
  );
}
