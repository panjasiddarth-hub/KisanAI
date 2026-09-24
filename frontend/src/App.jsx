// src/App.jsx
// Main app with routing, providers, and toast notifications

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// Load pages on demand so the initial bundle stays small.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Farms = lazy(() => import('./pages/Farms'));
const Crops = lazy(() => import('./pages/Crops'));
const Weather = lazy(() => import('./pages/Weather'));
const Disease = lazy(() => import('./pages/Disease'));
const Irrigation = lazy(() => import('./pages/Irrigation'));
const Market = lazy(() => import('./pages/Market'));
const Schemes = lazy(() => import('./pages/Schemes'));
const Analytics = lazy(() => import('./pages/Analytics'));
const CropSuggester = lazy(() => import('./pages/CropSuggester'));
const FertilizerAgent = lazy(() => import('./pages/FertilizerAgent'));
const Calendar = lazy(() => import('./pages/Calendar'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--color-text-muted)]">Loading...</div>}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes wrapped in main layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="farms" element={<Farms />} />
              <Route path="crops" element={<Crops />} />
              <Route path="weather" element={<Weather />} />
              <Route path="disease" element={<Disease />} />
              <Route path="irrigation" element={<Irrigation />} />
              <Route path="market" element={<Market />} />
              <Route path="schemes" element={<Schemes />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="agents/crop" element={<CropSuggester />} />
              <Route path="agents/fertilizer" element={<FertilizerAgent />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>

        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              fontSize: '0.875rem',
              fontWeight: 500,
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
