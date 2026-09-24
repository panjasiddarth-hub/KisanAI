// src/pages/Analytics.jsx
// Analytics dashboard with profit, yield, soil, and water charts

import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Bar, Line, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { TrendingUp, BarChart3, Droplets, Leaf } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, Title, Tooltip, Legend, Filler);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const profitData = {
  labels: MONTHS,
  datasets: [
    { label: 'Revenue (₹)', data: [65000, 72000, 88000, 91000, 79000, 105000, 120000, 95000, 110000, 130000, 115000, 140000], backgroundColor: 'rgba(22,163,74,0.7)', borderRadius: 8, borderSkipped: false },
    { label: 'Expenses (₹)', data: [38000, 42000, 50000, 55000, 48000, 60000, 65000, 58000, 62000, 70000, 65000, 75000], backgroundColor: 'rgba(99,102,241,0.5)', borderRadius: 8, borderSkipped: false },
  ],
};

const yieldData = {
  labels: ['Wheat', 'Onion', 'Tomato', 'Sugarcane', 'Soybean'],
  datasets: [
    { label: 'Actual Yield (q/acre)', data: [18, 120, 95, 280, 14], backgroundColor: 'rgba(22,163,74,0.7)', borderRadius: 8, borderSkipped: false },
    { label: 'Expected (q/acre)', data: [20, 130, 100, 300, 16], backgroundColor: 'rgba(251,191,36,0.5)', borderRadius: 8, borderSkipped: false },
  ],
};

const waterData = {
  labels: MONTHS.slice(0, 7),
  datasets: [{
    label: 'Water Used (kL)',
    data: [120, 105, 98, 115, 88, 72, 65],
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.1)',
    fill: true,
    tension: 0.4,
    borderWidth: 2,
    pointBackgroundColor: '#3b82f6',
    pointRadius: 4,
  }],
};

const soilData = {
  labels: ['Nitrogen', 'Phosphorus', 'Potassium', 'pH Balance', 'Organic Matter', 'Moisture Retention'],
  datasets: [
    { label: 'Shri Ram Farm', data: [75, 60, 80, 70, 65, 72], borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)', borderWidth: 2, pointBackgroundColor: '#16a34a' },
    { label: 'North Field', data: [85, 75, 90, 80, 78, 85], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 2, pointBackgroundColor: '#6366f1' },
  ],
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
    y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 10 } } }
  }
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="page-content">
      <PageHeader title="Analytics & Reports" subtitle="Comprehensive farm performance metrics">
        <div className="flex gap-1">
          {[['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']].map(([val, label]) => (
            <button key={val} onClick={() => setPeriod(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === val ? 'bg-green-500 text-white' : 'text-[var(--color-text-muted)] hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Total Revenue" value="₹12.1L" icon={TrendingUp} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600" trend="up" trendValue={18} subtitle="This year" />
        <StatCard loading={loading} title="Net Profit" value="₹5.3L" icon={BarChart3} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600" trend="up" trendValue={24} subtitle="After expenses" />
        <StatCard loading={loading} title="Total Water Used" value="918 kL" icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600" trend="down" trendValue={12} subtitle="↓ vs last year" />
        <StatCard loading={loading} title="Crop Yield Avg" value="91%" icon={Leaf} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600" trend="up" trendValue={6} subtitle="vs expected yield" />
      </div>

      {/* Profit chart */}
      <div className="card p-5 mb-4">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Revenue vs Expenses (2026)</h3>
        {loading ? <div className="skeleton h-56 rounded-xl" /> : <div className="h-56"><Bar data={profitData} options={{ ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `₹${(v / 1000).toFixed(0)}k` } } } }} /></div>}
      </div>

      {/* Two-col row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Yield comparison */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Crop Yield vs Target</h3>
          {loading ? <div className="skeleton h-48 rounded-xl" /> : <div className="h-48"><Bar data={yieldData} options={{ ...CHART_DEFAULTS, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v} q` } } } }} /></div>}
        </div>

        {/* Water usage */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Water Usage Trend (Jan–Jul)</h3>
          {loading ? <div className="skeleton h-48 rounded-xl" /> : <div className="h-48"><Line data={waterData} options={{ ...CHART_DEFAULTS, plugins: { legend: { display: false } }, scales: { ...CHART_DEFAULTS.scales, y: { ...CHART_DEFAULTS.scales.y, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => `${v} kL` } } } }} /></div>}
        </div>
      </div>

      {/* Soil radar + insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Soil radar */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Soil Health Comparison</h3>
          {loading ? <div className="skeleton h-52 rounded-xl" /> :
            <div className="h-52">
              <Radar data={soilData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
                scales: { r: { grid: { color: 'rgba(100,116,139,0.15)' }, ticks: { color: '#94a3b8', font: { size: 10 }, backdropColor: 'transparent' }, pointLabels: { color: '#64748b', font: { size: 10 } }, max: 100, min: 0 } }
              }} />
            </div>
          }
        </div>

        {/* Insights */}
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">🤖 AI-Generated Insights</h3>
          <div className="space-y-3">
            {[
              { icon: '📈', title: 'Revenue Growth', msg: 'Your revenue has grown 18% this year. Onion and Soybean are your top earners. Consider increasing Soybean area by 1 acre next season.', color: 'green' },
              { icon: '💧', title: 'Water Efficiency', msg: 'Water usage reduced 12% YoY through AI-optimized drip irrigation. Estimated ₹8,000 saved in energy costs.', color: 'blue' },
              { icon: '⚠️', title: 'Yield Gap', msg: 'Wheat yield is 10% below target. Low N fertilization during tillering stage likely cause. Apply recommended dose next Rabi.', color: 'amber' },
              { icon: '🌱', title: 'Soil Health', msg: 'North Field shows excellent soil health (85/100). Shri Ram Farm phosphorus is 40% below optimal — apply SSP 50 kg/acre.', color: 'purple' },
            ].map(ins => (
              <div key={ins.title} className={`p-3 rounded-xl border ${ins.color === 'green' ? 'bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30' : ins.color === 'blue' ? 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30' : ins.color === 'amber' ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30' : 'bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{ins.icon}</span>
                  <span className="font-bold text-xs text-[var(--color-text)]">{ins.title}</span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{ins.msg}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
