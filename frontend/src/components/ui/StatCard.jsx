// src/components/ui/StatCard.jsx
// Metric stat card with icon, value, trend

import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, unit, icon: Icon, iconBg, iconColor, trend, trendValue, subtitle, loading }) {
  if (loading) {
    return (
      <div className="card stat-card">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-7 w-16 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
      </div>
    );
  }

  // Overriding rainbow colors to standard clean theme
  const safeIconBg = iconBg?.includes('bg-') && !iconBg.includes('green') ? 'bg-slate-100 dark:bg-slate-800' : 'bg-emerald-100 dark:bg-emerald-900/30';
  const safeIconColor = iconColor?.includes('text-') && !iconColor.includes('green') ? 'text-slate-600 dark:text-slate-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="card stat-card fade-in group">
      <div className="flex items-start justify-between">
        <div className={`stat-icon ${safeIconBg}`}>
          {Icon && <Icon style={{ width: 18, height: 18 }} className={safeIconColor} />}
        </div>
        {trendValue !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp style={{ width: 14, height: 14 }} /> : <TrendingDown style={{ width: 14, height: 14 }} />}
            {trendValue}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">{title}</p>
        <p className="text-2xl font-bold text-[var(--color-text)]">
          {value}
          {unit && <span className="text-sm font-medium text-[var(--color-text-muted)] ml-1">{unit}</span>}
        </p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
