// src/pages/Dashboard.jsx
// Main dashboard with all widgets

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import PageHeader from '../components/ui/PageHeader';
import {
  Warehouse, Sprout, Droplets, TrendingUp, Wind, Thermometer,
  CloudRain, CheckCircle, Clock, AlertTriangle, Bot, Zap,
  Sun, Cloud, Leaf, ArrowRight
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

// Mock data
const PROFIT_DATA = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  datasets: [{
    label: 'Profit (₹)',
    data: [42000, 38000, 55000, 61000, 48000, 72000, 85000],
    borderColor: '#16a34a',
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderWidth: 2.5,
    tension: 0.4,
    fill: true,
    pointBackgroundColor: '#16a34a',
    pointRadius: 4,
    pointHoverRadius: 6,
  }],
};

const CROP_DIST = {
  labels: ['Wheat', 'Onion', 'Tomato', 'Sugarcane', 'Soybean'],
  datasets: [{
    data: [30, 20, 18, 15, 17],
    backgroundColor: ['#16a34a', '#22c55e', '#86efac', '#4ade80', '#bbf7d0'],
    borderWidth: 0,
    hoverOffset: 6,
  }],
};

const TASKS = [
  { id: 1, text: 'Apply urea to Wheat field (North)', done: false, priority: 'high', time: '08:00 AM' },
  { id: 2, text: 'Irrigate Green Valley Plot', done: true, priority: 'medium', time: '10:00 AM' },
  { id: 3, text: 'Collect soil sample from North Field', done: false, priority: 'medium', time: '12:00 PM' },
  { id: 4, text: 'Check PM Kisan portal for update', done: false, priority: 'low', time: '02:00 PM' },
  { id: 5, text: 'Review market prices for Onion', done: true, priority: 'low', time: '04:00 PM' },
];

const AI_AGENTS = [
  { name: 'Crop Agent', status: 'completed', lastRun: '2 min ago', description: 'Analyzed soil and recommended Rabi crops' },
  { name: 'Weather Agent', status: 'running', lastRun: 'Now', description: 'Fetching 7-day rainfall forecast' },
  { name: 'Disease Agent', status: 'waiting', lastRun: '1 hr ago', description: 'Ready to scan uploaded images' },
  { name: 'Market Agent', status: 'generating', lastRun: 'Now', description: 'Generating price trend report' },
  { name: 'Finance Agent', status: 'completed', lastRun: '10 min ago', description: 'Profit forecast updated' },
  { name: 'Gov. Scheme Agent', status: 'completed', lastRun: '30 min ago', description: 'Found 3 new eligible schemes' },
];

const ALERTS = [
  { type: 'warning', msg: 'Heavy rain expected in 24 hours. Delay irrigation.', time: '10 min ago' },
  { type: 'error', msg: 'Possible blight detected in Tomato (plot B2).', time: '1 hr ago' },
  { type: 'info', msg: 'PM Kisan ₹2000 credited to your account.', time: '2 hr ago' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState(TASKS);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: v => `₹${(v / 1000).toFixed(0)}k` } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 10, padding: 12, color: '#64748b', font: { size: 11 } } },
    },
    cutout: '68%',
  };

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const agentStatusClass = { completed: 'completed', running: 'running', waiting: 'waiting', generating: 'generating' };

  return (
    <div className="page-content">
      {/* Welcome Banner */}
      <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Leaf className="w-48 h-48 text-white -mr-8 -mt-8" />
        </div>
        <div className="relative">
          <p className="text-green-100 text-sm mb-1">
            {greeting()}, {user?.name?.split(' ')[0]} 🌾 — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h2 className="text-xl font-bold text-white mb-3">Your Farm is Performing Well Today!</h2>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-green bg-white/20 text-white border-0">🌡️ 28°C Nashik</span>
            <span className="badge badge-yellow bg-white/20 text-white border-0">🌧️ Rain in 24h</span>
            <span className="badge badge-green bg-white/20 text-white border-0">✅ 3 Farms Active</span>
          </div>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard loading={loading} title="Total Farms" value="3" icon={Warehouse} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" trend="up" trendValue={12} subtitle="1 added this month" />
        <StatCard loading={loading} title="Active Crops" value="5" unit="varieties" icon={Sprout} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" subtitle="Across 3 farms" />
        <StatCard loading={loading} title="Water Usage" value="4,200" unit="L/day" icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400" trend="down" trendValue={8} subtitle="Below target ✓" />
        <StatCard loading={loading} title="Profit This Month" value="₹85K" icon={TrendingUp} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" trend="up" trendValue={22} subtitle="vs last month" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Profit Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-text)]">Monthly Profit Trend</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Last 7 months</p>
            </div>
            <span className="badge badge-green">+22% this month</span>
          </div>
          {loading
            ? <div className="skeleton h-48 rounded-xl" />
            : <div className="h-48"><Line data={PROFIT_DATA} options={chartOptions} /></div>
          }
        </div>

        {/* Weather Widget */}
        <div className="card p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-blue-100 text-xs">Today's Weather</p>
              <p className="font-bold text-sm">Nashik, Maharashtra</p>
            </div>
            <Cloud className="w-6 h-6 text-white/70" />
          </div>
          {loading
            ? <div className="space-y-3"><div className="skeleton h-12 rounded-xl bg-white/10" /><div className="skeleton h-6 rounded-xl bg-white/10" /></div>
            : <>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-5xl font-bold">28°</span>
                <span className="text-blue-100 mb-2">C · Partly Cloudy</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Droplets, label: 'Humidity', val: '72%' },
                  { icon: Wind, label: 'Wind', val: '14 km/h' },
                  { icon: CloudRain, label: 'Rain', val: '40%' },
                ].map(m => (
                  <div key={m.label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/10">
                    <m.icon className="w-4 h-4 text-blue-100" />
                    <span className="text-[0.65rem] text-blue-200">{m.label}</span>
                    <span className="text-sm font-bold">{m.val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
                  <div key={d} className="flex flex-col items-center gap-1 min-w-[44px] p-1.5 rounded-lg bg-white/10 text-xs">
                    <span className="text-blue-200">{d}</span>
                    {i === 2 ? <CloudRain className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    <span className="font-semibold">{[28, 30, 25, 27, 29][i]}°</span>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Today's Tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--color-text)]">Today's Tasks</h3>
            <span className="badge badge-green">{tasks.filter(t => t.done).length}/{tasks.length} done</span>
          </div>
          {loading
            ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
            : <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${task.done ? 'opacity-50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                >
                  <div className={`mt-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${task.done ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-slate-500'}`} style={{ width: 18, height: 18 }}>
                    {task.done && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-tight ${task.done ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>{task.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-[var(--color-text-muted)]" />
                      <span className="text-[0.65rem] text-[var(--color-text-muted)]">{task.time}</span>
                      <span className={`badge ${task.priority === 'high' ? 'badge-red' : task.priority === 'medium' ? 'badge-yellow' : 'badge-green'}`}>{task.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>

        {/* Farm Health */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--color-text)]">Farm Health Overview</h3>
          </div>
          {loading
            ? <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
            : <div className="space-y-4">
              {[
                { name: 'Shri Ram Farm', score: 84, color: 'green' },
                { name: 'Green Valley Plot', score: 71, color: 'yellow' },
                { name: 'North Field', score: 90, color: 'green' },
              ].map(f => (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[var(--color-text)]">{f.name}</span>
                    <span className={`badge ${f.score >= 80 ? 'badge-green' : 'badge-yellow'}`}>{f.score}%</span>
                  </div>
                  <ProgressBar value={f.score} color={f.color} showPercent={false} />
                </div>
              ))}
              <div className="pt-3 border-t border-[var(--color-border)]">
                <div className="h-32">
                  <Doughnut data={CROP_DIST} options={doughnutOptions} />
                </div>
              </div>
            </div>
          }
        </div>

        {/* Alerts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-[var(--color-text)]">Alerts & Notifications</h3>
            <span className="badge badge-red">3 new</span>
          </div>
          {loading
            ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
            : <div className="space-y-3">
              {ALERTS.map((a, i) => (
                <div key={i} className={`p-3 rounded-xl border ${a.type === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30' : a.type === 'warning' ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30' : 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30'}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.type === 'error' ? 'text-red-500' : a.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <div>
                      <p className="text-xs font-medium text-[var(--color-text)] leading-snug">{a.msg}</p>
                      <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1">{a.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      </div>

      {/* AI Agents Status */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-sm text-[var(--color-text)]">AI Multi-Agent Status</h3>
          </div>
          <button onClick={() => navigate('/ai-assistant')} className="flex items-center gap-1 text-xs text-green-600 font-semibold hover:underline">
            Open Assistant <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {AI_AGENTS.map(agent => (
            <div key={agent.name} className={`p-3 rounded-xl border ${loading ? '' : 'hover:shadow-md transition-shadow cursor-pointer'} ${agent.status === 'running' || agent.status === 'generating' ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30' : agent.status === 'completed' ? 'border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/30' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
              {loading
                ? <div className="space-y-2"><div className="skeleton h-4 w-full rounded" /><div className="skeleton h-3 w-2/3 rounded" /></div>
                : <>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`agent-dot ${agentStatusClass[agent.status]}`} />
                    <span className="text-xs font-bold text-[var(--color-text)]">{agent.name}</span>
                  </div>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] leading-relaxed">{agent.description}</p>
                  <p className="text-[0.6rem] font-semibold mt-2 capitalize" style={{ color: agent.status === 'running' || agent.status === 'generating' ? '#f59e0b' : agent.status === 'completed' ? '#16a34a' : '#94a3b8' }}>
                    <Zap className="w-2.5 h-2.5 inline mr-0.5" />
                    {agent.status} · {agent.lastRun}
                  </p>
                </>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Add Crop', icon: Sprout, color: 'bg-green-500', path: '/crops' },
            { label: 'Check Disease', icon: Leaf, color: 'bg-red-500', path: '/disease' },
            { label: 'View Prices', icon: TrendingUp, color: 'bg-amber-500', path: '/market' },
            { label: 'Irrigation Plan', icon: Droplets, color: 'bg-blue-500', path: '/irrigation' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="flex items-center gap-3 p-3.5 rounded-xl hover:shadow-md transition-all border border-[var(--color-border)] hover:border-green-300 dark:hover:border-green-700 group"
            >
              <div className={`w-9 h-9 rounded-xl ${a.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <a.icon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <span className="text-sm font-semibold text-[var(--color-text)]">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
