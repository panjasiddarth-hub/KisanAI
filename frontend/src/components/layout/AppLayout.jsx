// src/components/layout/AppLayout.jsx
// Main layout wrapper with sidebar + topbar

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/farms': 'My Farms',
  '/crops': 'Crop Management',
  '/weather': 'Weather Center',
  '/disease': 'Disease Detection',
  '/irrigation': 'Irrigation Control',
  '/market': 'Market Intelligence',
  '/schemes': 'Government Schemes',
  '/analytics': 'Analytics & Reports',
  '/ai-assistant': 'AI Multi-Agent Assistant',
  '/profile': 'My Profile',
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
