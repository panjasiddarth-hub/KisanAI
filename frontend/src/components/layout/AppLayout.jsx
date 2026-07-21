// src/components/layout/AppLayout.jsx
// Main layout wrapper with sidebar + topbar

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

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
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-layout">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
