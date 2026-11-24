// src/components/layout/AppLayout.jsx
// Main layout wrapper with sidebar + topbar + mobile bottom navigation

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/farms': 'My Farm',
  '/crops': 'Crop Planning',
  '/weather': 'Weather',
  '/disease': 'Diseases',
  '/irrigation': 'Irrigation',
  '/market': 'Market Intelligence',
  '/schemes': 'Finance & Schemes',
  '/analytics': 'Analytics',
  '/ai-assistant': 'AI Assistant',
  '/agents/crop': 'Crop Suggester',
  '/agents/fertilizer': 'Fertilizer Agent',
  '/calendar': 'Farm Calendar',
  '/notifications': 'Notifications',
  '/profile': 'Settings & Profile',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Sampoorn Kisan';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-layout flex-1 flex flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav onMenuClick={() => setSidebarOpen(prev => !prev)} isMenuOpen={sidebarOpen} />
    </div>
  );
}
