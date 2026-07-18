// src/pages/Irrigation.jsx
// Irrigation control with soil moisture and schedule

import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import { Droplets, CheckCircle, Clock, Zap, AlertTriangle } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SOIL_DATA = [
  { farm: 'Shri Ram Farm', field: 'Field A (Wheat)', moisture: 68, status: 'Good', lastIrrigated: 'Today 08:00', nextScheduled: 'Jul 21, 08:00', recommendation: 'No irrigation needed for 2 days' },
  { farm: 'Green Valley Plot', field: 'Tomato Block', moisture: 28, status: 'Critical', lastIrrigated: 'Jul 15', nextScheduled: 'Immediate', recommendation: '⚠️ Immediate irrigation required! Moisture critically low.' },
  { farm: 'Shri Ram Farm', field: 'Field B (Onion)', moisture: 55, status: 'Moderate', lastIrrigated: 'Jul 16', nextScheduled: 'Jul 19, 06:00', recommendation: 'Irrigate in 24 hours for optimal bulb development.' },
  { farm: 'North Field', field: 'Soybean', moisture: 72, status: 'Good', lastIrrigated: 'Today 06:00', nextScheduled: 'Jul 22, 06:00', recommendation: 'Moisture adequate. Rain expected Wed — skip irrigation.' },
];

const SCHEDULE = [
  { field: 'Field A (Wheat)', date: 'Jul 21', time: '08:00 AM', duration: '45 min', method: 'Drip', volume: '1200 L', status: 'scheduled' },
  { field: 'Tomato Block', date: 'Today', time: 'Immediate', duration: '60 min', method: 'Sprinkler', volume: '1800 L', status: 'urgent' },
  { field: 'Field B (Onion)', date: 'Jul 19', time: '06:00 AM', duration: '30 min', method: 'Furrow', volume: '900 L', status: 'scheduled' },
  { field: 'Soybean', date: 'Jul 22', time: '06:00 AM', duration: '40 min', method: 'Drip', volume: '1100 L', status: 'scheduled' },
];

const waterUsageData = {
  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
  datasets: [
    { label: 'Actual (kL)', data: [28, 32, 25, 18], backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 8, borderSkipped: false },
    { label: 'Target (kL)', data: [30, 30, 30, 30], backgroundColor: 'rgba(100,116,139,0.2)', borderRadius: 8, borderSkipped: false },
  ],
};

export default function Irrigation() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const statusColor = (s) => ({ Good: 'badge-green', Moderate: 'badge-yellow', Critical: 'badge-red' }[s] || 'badge-blue');
  const scheduleColor = (s) => s === 'urgent' ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-[var(--color-border)]';

  return (
    <div className="page-content">
      <PageHeader title="Irrigation Control" subtitle="Monitor soil moisture and manage watering schedules" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Avg Soil Moisture" value="56%" icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Across 4 fields" />
        <StatCard loading={loading} title="Water Used Today" value="4,200 L" icon={Droplets} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-500" subtitle="↓ 15% vs yesterday" />
        <StatCard loading={loading} title="Fields Needing Water" value="1" icon={AlertTriangle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500" subtitle="Critical: Tomato Block" />
        <StatCard loading={loading} title="Water Saved This Week" value="12%" icon={Zap} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-500" subtitle="AI-optimized schedule" />
      </div>

      {/* Soil Moisture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {SOIL_DATA.map((f, i) => (
          <div key={i} className={`card p-5 fade-in border-2 ${f.status === 'Critical' ? 'border-red-200 dark:border-red-900/30' : 'border-transparent'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-sm text-[var(--color-text)]">{f.field}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{f.farm}</p>
              </div>
              <span className={`badge ${statusColor(f.status)}`}>{f.status}</span>
            </div>

            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Soil Moisture</p>
                <span className={`text-3xl font-bold ${f.moisture < 35 ? 'text-red-500' : f.moisture < 55 ? 'text-amber-500' : 'text-green-500'}`}>{f.moisture}%</span>
              </div>
              <div className="flex-1">
                <ProgressBar value={f.moisture} color={f.moisture < 35 ? 'red' : f.moisture < 55 ? 'yellow' : 'green'} showPercent={false} />
                <div className="flex justify-between text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                  <span>0% (Dry)</span><span>50% (Ideal)</span><span>100%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/30">
                <p className="text-[0.6rem] text-[var(--color-text-muted)]">Last Irrigated</p>
                <p className="text-xs font-semibold text-[var(--color-text)]">{f.lastIrrigated}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/30">
                <p className="text-[0.6rem] text-[var(--color-text-muted)]">Next Scheduled</p>
                <p className={`text-xs font-semibold ${f.nextScheduled === 'Immediate' ? 'text-red-500' : 'text-[var(--color-text)]'}`}>{f.nextScheduled}</p>
              </div>
            </div>

            <div className={`p-3 rounded-xl text-xs leading-relaxed ${f.status === 'Critical' ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400' : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'}`}>
              {f.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Schedule + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Irrigation Schedule */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Irrigation Schedule</h3>
          <div className="space-y-3">
            {SCHEDULE.map((s, i) => (
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${scheduleColor(s.status)}`}>
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.status === 'urgent' ? 'bg-red-500' : 'bg-blue-500'}`}>
                  {s.status === 'urgent' ? <AlertTriangle className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-xs text-[var(--color-text)]">{s.field}</p>
                    <span className={`badge ${s.status === 'urgent' ? 'badge-red' : 'badge-blue'}`}>{s.status}</span>
                  </div>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-0.5">{s.date} · {s.time} · {s.duration}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="badge badge-blue">{s.method}</span>
                    <span className="badge badge-green">{s.volume}</span>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-gray-300 cursor-pointer hover:text-green-500 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Water Usage Chart */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Water Usage (Monthly)</h3>
          {loading ? <div className="skeleton h-52 rounded-xl" /> :
            <div className="h-52">
              <Bar data={waterUsageData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                  y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: v => `${v} kL` } }
                }
              }} />
            </div>
          }
          <div className="mt-4 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 text-xs text-green-700 dark:text-green-400">
            💧 <strong>AI Insight:</strong> You've used 12% less water this month vs target. AI scheduling saved approx. 3,600 L this week.
          </div>
        </div>
      </div>
    </div>
  );
}
