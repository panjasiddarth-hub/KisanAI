// src/components/layout/BottomNav.jsx
// Mobile-only bottom navigation bar with active indicators and safe-area padding

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Warehouse, Sparkles, CalendarCheck, Menu } from 'lucide-react';

export default function BottomNav({ onMenuClick, isMenuOpen }) {
  return (
    <nav 
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden safe-area-pb"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `
            flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200
            ${isActive ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'}
          `}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110 bg-green-50 dark:bg-green-950/40' : ''}`}>
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="text-[0.68rem] tracking-tight mt-0.5">Home</span>
            </>
          )}
        </NavLink>

        {/* My Farm */}
        <NavLink
          to="/farms"
          className={({ isActive }) => `
            flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200
            ${isActive ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'}
          `}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110 bg-green-50 dark:bg-green-950/40' : ''}`}>
                <Warehouse className="w-5 h-5" />
              </div>
              <span className="text-[0.68rem] tracking-tight mt-0.5">My Farm</span>
            </>
          )}
        </NavLink>

        {/* Center Ask AI Button */}
        <NavLink
          to="/ai-assistant"
          className="flex flex-col items-center justify-center -mt-5 mx-1 transition-all duration-200 group"
        >
          {({ isActive }) => (
            <>
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-green-600/30 transition-transform active:scale-95
                ${isActive 
                  ? 'bg-gradient-to-tr from-green-700 to-emerald-500 ring-4 ring-[var(--color-surface)] ring-offset-0 text-white' 
                  : 'bg-gradient-to-tr from-green-600 to-emerald-400 text-white group-hover:scale-105'}
              `}>
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <span className={`text-[0.68rem] tracking-tight mt-1 font-bold ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                Ask AI
              </span>
            </>
          )}
        </NavLink>

        {/* Calendar */}
        <NavLink
          to="/calendar"
          className={({ isActive }) => `
            flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200
            ${isActive ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'}
          `}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-lg transition-transform ${isActive ? 'scale-110 bg-green-50 dark:bg-green-950/40' : ''}`}>
                <CalendarCheck className="w-5 h-5" />
              </div>
              <span className="text-[0.68rem] tracking-tight mt-0.5">Calendar</span>
            </>
          )}
        </NavLink>

        {/* More / Menu Drawer Toggle */}
        <button
          onClick={onMenuClick}
          type="button"
          className={`
            flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-200
            ${isMenuOpen ? 'text-[var(--color-primary)] font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-medium'}
          `}
          aria-label="Open full menu"
        >
          <div className={`p-1 rounded-lg transition-transform ${isMenuOpen ? 'scale-110 bg-green-50 dark:bg-green-950/40' : ''}`}>
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[0.68rem] tracking-tight mt-0.5">Menu</span>
        </button>
      </div>
    </nav>
  );
}
