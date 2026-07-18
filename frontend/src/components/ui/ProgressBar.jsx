// src/components/ui/ProgressBar.jsx
// Animated progress bar with label

export default function ProgressBar({ value, max = 100, label, color = 'green', showPercent = true }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const colors = {
    green: 'from-green-400 to-emerald-500',
    yellow: 'from-amber-400 to-orange-500',
    red: 'from-red-400 to-rose-500',
    blue: 'from-blue-400 to-indigo-500',
    purple: 'from-purple-400 to-violet-500',
  };

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>}
          {showPercent && <span className="text-xs font-bold text-[var(--color-text)]">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[color]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
