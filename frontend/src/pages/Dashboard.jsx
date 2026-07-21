// src/pages/Dashboard.jsx
// Smart-farming overview — stats, AI recommendation, agents, tasks, quick actions, weather rail

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Sprout, TrendingUp, IndianRupee, Droplets, Sparkles, ArrowRight,
  CheckCircle2, Clock, Loader2, Leaf, Bug, Landmark, MessageCircle,
  Camera, FlaskConical, BarChart3, Plus, MapPin, Sun, Cloud,
  CloudRain, CloudSun, Wind, Brain, Layers
} from 'lucide-react';
import cottonImg from '../assets/cotton.jpg';
import fieldImg from '../assets/field.jpg';
import farmAerialImg from '../assets/farm-aerial.jpg';

/* ---------------- mock data (mirrors reference design) ---------------- */

const AGENTS = [
  { name: 'Crop Planning Agent', status: 'completed' },
  { name: 'Weather Agent', status: 'completed' },
  { name: 'Disease Agent', status: 'completed' },
  { name: 'Market Agent', status: 'completed' },
  { name: 'Finance Agent', status: 'completed' },
  { name: 'Government Scheme Agent', status: 'in-progress' },
  { name: 'Explainable AI Agent', status: 'generating' },
];

const ALL_TASKS = [
  { id: 1, text: 'Check soil moisture', icon: Droplets, iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400', priority: 'High' },
  { id: 2, text: 'Apply fertilizer (Urea)', icon: Leaf, iconBg: 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400', priority: 'Medium' },
  { id: 3, text: 'Pest monitoring', icon: Bug, iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', priority: 'Medium' },
  { id: 4, text: 'Market price tracking', icon: TrendingUp, iconBg: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400', priority: 'Low' },
  { id: 5, text: 'Scout cotton field for pink bollworm', icon: Sprout, iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400', priority: 'Medium' },
  { id: 6, text: 'Upload soil test report', icon: FlaskConical, iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400', priority: 'Low' },
];

const QUICK_ACTIONS = [
  { label: 'Ask AI', icon: MessageCircle, tile: 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400', path: '/ai-assistant' },
  { label: 'Upload Image', icon: Camera, tile: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400', path: '/disease' },
  { label: 'Soil Test', icon: FlaskConical, tile: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', path: '/farms' },
  { label: 'Market Prices', icon: BarChart3, tile: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400', path: '/market' },
  { label: 'Schemes', icon: Landmark, tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400', path: '/schemes' },
  { label: 'Add Farm Log', icon: Plus, tile: 'bg-[#15803d] text-white', path: '/crops' },
];

const FORECAST = [
  { day: 'Today', icon: CloudRain, color: 'text-sky-500', hi: 28, lo: 22 },
  { day: 'Sat', icon: CloudRain, color: 'text-sky-500', hi: 27, lo: 21 },
  { day: 'Sun', icon: Sun, color: 'text-amber-400', hi: 30, lo: 23 },
  { day: 'Mon', icon: CloudSun, color: 'text-slate-400', hi: 29, lo: 22 },
  { day: 'Tue', icon: CloudRain, color: 'text-sky-500', hi: 28, lo: 21 },
];

const ALERTS = [
  { title: 'Disease Risk Alert', desc: 'High risk of fungal infection in cotton.', time: '2h ago', icon: Leaf, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' },
  { title: 'Market Update', desc: 'Cotton price increased by ₹150 in your mandi.', time: '5h ago', icon: TrendingUp, tint: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400' },
  { title: 'Government Scheme', desc: 'You are eligible for PM Kisan installment.', time: '1d ago', icon: Landmark, tint: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400' },
];

const HEX_RING = [
  { icon: Sprout, tint: 'bg-purple-100 text-purple-500 dark:bg-purple-950/60', x: 50, y: 4 },
  { icon: CloudSun, tint: 'bg-sky-100 text-sky-500 dark:bg-sky-950/60', x: 90, y: 27 },
  { icon: FlaskConical, tint: 'bg-orange-100 text-orange-500 dark:bg-orange-950/60', x: 90, y: 73 },
  { icon: TrendingUp, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60', x: 50, y: 96 },
  { icon: Landmark, tint: 'bg-amber-100 text-amber-500 dark:bg-amber-950/60', x: 10, y: 73 },
  { icon: Sparkles, tint: 'bg-pink-100 text-pink-500 dark:bg-pink-950/60', x: 10, y: 27 },
];

const PRIORITY_STYLE = {
  High: 'badge-red',
  Medium: 'badge-yellow',
  Low: 'badge-green',
};

/* ---------------- small presentational helpers ---------------- */

function MiniStat({ icon: Icon, tint, label, children }) {
  return (
    <div className="card p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tint}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-[0.72rem] font-medium text-[var(--color-text-muted)]">{label}</span>
      </div>
      {children}
    </div>
  );
}

function AgentStatus({ status }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 text-[0.7rem] font-semibold text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>
  );
  if (status === 'in-progress') return (
    <span className="flex items-center gap-1 text-[0.7rem] font-semibold text-amber-500"><Clock className="w-3.5 h-3.5" /> In Progress</span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-blue-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</span>
  );
}

/* ---------------- main component ---------------- */

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState(ALL_TASKS.slice(0, 4));
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [doneTasks, setDoneTasks] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const firstName = (user?.name || 'Farmer').split(' ')[0];
  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  const toggleAllTasks = () => {
    setShowAllTasks(v => {
      const next = !v;
      setTasks(next ? ALL_TASKS : ALL_TASKS.slice(0, 4));
      return next;
    });
  };

  const toggleDone = (id) => {
    setDoneTasks(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <div className="page-content" style={{ maxWidth: '1440px' }}>
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
          Good {daypart}, {firstName}! <span className="inline-block">🌱</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Here's what's happening on your farm today.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        {/* ================= CENTER ================= */}
        <div className="space-y-5 min-w-0">
          {/* Stat cards */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MiniStat icon={Sprout} tint="bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400" label="Farm Health">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-2xl font-extrabold text-[var(--color-text)] leading-none">92%</p>
                    <p className="text-[0.7rem] font-semibold text-green-600 mt-1.5">Excellent</p>
                  </div>
                  <svg viewBox="0 0 80 28" className="w-16 h-7 shrink-0" aria-hidden="true">
                    <polyline fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      points="0,21 12,15 22,18 33,10 44,13 55,6 66,10 79,3" />
                  </svg>
                </div>
              </MiniStat>

              <MiniStat icon={Leaf} tint="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" label="Active Crop">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-extrabold text-[var(--color-text)] leading-tight">Cotton</p>
                    <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-1">2 Acres</p>
                  </div>
                  <img src={cottonImg} alt="Cotton crop" className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0" />
                </div>
              </MiniStat>

              <MiniStat icon={IndianRupee} tint="bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400" label="Profit Prediction">
                <div>
                  <p className="text-2xl font-extrabold text-[var(--color-text)] leading-none">₹1,84,000</p>
                  <p className="flex items-center gap-1 text-[0.7rem] font-semibold text-green-600 mt-1.5">This Season <TrendingUp className="w-3 h-3" /></p>
                </div>
              </MiniStat>

              <MiniStat icon={Droplets} tint="bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400" label="Water Status">
                <div>
                  <p className="text-2xl font-extrabold text-[var(--color-text)] leading-none">Medium</p>
                  <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-1.5 mb-2">Update today</p>
                  <div className="h-1.5 w-full rounded-full bg-sky-100 dark:bg-sky-950/60 overflow-hidden">
                    <div className="h-full w-[55%] rounded-full bg-sky-500" />
                  </div>
                </div>
              </MiniStat>
            </div>
          )}

          {/* AI Recommendation */}
          <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-[#15803d] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </span>
              <h3 className="font-bold text-sm text-[var(--color-text)]">AI Recommendation for You</h3>
            </div>
            {loading
              ? <div className="skeleton h-36 rounded-xl" />
              : (
                <div className="flex flex-col md:flex-row gap-4 md:items-center">
                  <img src={fieldImg} alt="Crop field" className="w-full md:w-44 h-36 md:h-32 rounded-xl object-cover shadow-sm shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-lg text-[var(--color-text)]">Delay irrigation for 2 days</h4>
                    <p className="text-[0.8rem] text-[var(--color-text-muted)] leading-relaxed mt-1.5 max-w-xl">
                      Based on tomorrow's heavy rainfall forecast, soil moisture levels, and crop stage,
                      we recommend delaying irrigation to prevent waterlogging and root damage.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3.5">
                      <span className="agent-pill"><CloudSun className="w-3.5 h-3.5 text-sky-500" /> Weather Agent</span>
                      <span className="agent-pill"><Droplets className="w-3.5 h-3.5 text-cyan-500" /> Irrigation Agent</span>
                      <span className="agent-pill"><Layers className="w-3.5 h-3.5 text-amber-600" /> Soil Agent</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="flex items-center gap-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-green-900/15 transition-colors shrink-0 md:self-center"
                  >
                    View Full Plan <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )
            }
          </div>

          {/* Agents + Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* AI Agents Status */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-[var(--color-text)]">AI Agents Status</h3>
                <button
                  onClick={() => navigate('/ai-assistant')}
                  className="text-[0.7rem] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2.5 py-1.5 rounded-full hover:text-green-600 transition-colors"
                >
                  View All Agents
                </button>
              </div>
              <div className="flex items-center gap-4">
                {/* Hexagon cluster */}
                <div className="relative w-36 h-40 shrink-0 hidden sm:block">
                  {HEX_RING.map(h => (
                    <span
                      key={h.x + '-' + h.y}
                      style={{ left: `${h.x}%`, top: `${h.y}%` }}
                      className={`hex absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center ${h.tint}`}
                    >
                      <h.icon className="w-4 h-4" />
                    </span>
                  ))}
                  <span className="hex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-[#15803d] flex items-center justify-center shadow-lg shadow-green-900/20">
                    <Brain className="w-6 h-6 text-white" />
                  </span>
                </div>
                {/* Agent list */}
                <ul className="flex-1 min-w-0 space-y-2.5">
                  {AGENTS.map(a => (
                    <li key={a.name} className="flex items-center justify-between gap-2">
                      <span className="text-[0.72rem] font-medium text-[var(--color-text)] whitespace-nowrap">{a.name}</span>
                      <span className="whitespace-nowrap"><AgentStatus status={a.status} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Today's Tasks */}
            <div className="card p-5 flex flex-col">
              <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Today's Tasks</h3>
              <ul className="space-y-1 flex-1">
                {tasks.map(task => {
                  const done = doneTasks.includes(task.id);
                  return (
                    <li
                      key={task.id}
                      onClick={() => toggleDone(task.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/40 ${done ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${task.iconBg}`}>
                        <task.icon className="w-4 h-4" />
                      </span>
                      <span className={`flex-1 text-xs font-medium text-[var(--color-text)] ${done ? 'line-through' : ''}`}>{task.text}</span>
                      <span className={`badge ${PRIORITY_STYLE[task.priority]} !normal-case`}>{task.priority} Priority</span>
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={toggleAllTasks}
                className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-bg)] hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30 transition-colors"
              >
                {showAllTasks ? 'Show Less' : 'View All Tasks'}
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Quick Actions</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => navigate(a.path)} className="qa-tile">
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${a.tile}`}>
                    <a.icon className="w-5 h-5" />
                  </span>
                  <span className="text-[0.68rem] font-semibold text-[var(--color-text)] text-center leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= RIGHT RAIL ================= */}
        <div className="space-y-5">
          {/* Weather Forecast */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-sm text-[var(--color-text)]">Weather Forecast</h3>
              <button onClick={() => navigate('/weather')} className="text-[0.7rem] font-semibold text-green-600 hover:underline">View Full</button>
            </div>
            <p className="flex items-center gap-1 text-[0.72rem] text-[var(--color-text-muted)]"><MapPin className="w-3 h-3" /> Warangal, Telangana</p>
            {loading
              ? <div className="skeleton h-40 rounded-xl mt-3" />
              : (
                <>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-4xl font-extrabold text-[var(--color-text)] leading-none">28°C</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5">Partly Cloudy</p>
                    </div>
                    <div className="relative w-16 h-14">
                      <Sun className="w-8 h-8 text-amber-400 absolute top-0 right-0" />
                      <Cloud className="w-12 h-12 text-sky-400 absolute bottom-0 left-0" fill="currentColor" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 pb-3 border-b border-[var(--color-border)]">
                    {[
                      { icon: Droplets, val: '82%', label: 'Humidity', color: 'text-sky-500' },
                      { icon: Wind, val: '12 km/h', label: 'Wind', color: 'text-slate-400' },
                      { icon: CloudRain, val: '90%', label: 'Rain Chance', color: 'text-indigo-400' },
                    ].map(m => (
                      <div key={m.label} className="flex flex-col items-center gap-0.5">
                        <m.icon className={`w-4 h-4 ${m.color}`} />
                        <span className="text-[0.72rem] font-bold text-[var(--color-text)]">{m.val}</span>
                        <span className="text-[0.6rem] text-[var(--color-text-muted)]">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-3">
                    {FORECAST.map(f => (
                      <div key={f.day} className="flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">
                        <span className="text-[0.62rem] font-semibold text-[var(--color-text-muted)]">{f.day}</span>
                        <f.icon className={`w-4 h-4 ${f.color}`} />
                        <span className="text-[0.7rem] font-bold text-[var(--color-text)]">{f.hi}°</span>
                        <span className="text-[0.62rem] text-[var(--color-text-muted)] -mt-1">{f.lo}°</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </div>

          {/* Alerts & Notifications */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[var(--color-text)]">Alerts & Notifications</h3>
              <button onClick={() => navigate('/notifications')} className="text-[0.7rem] font-semibold text-red-500 hover:underline">View All</button>
            </div>
            <ul className="space-y-1">
              {ALERTS.map(a => (
                <li
                  key={a.title}
                  onClick={() => { toast(a.desc, { icon: '🔔' }); navigate('/notifications'); }}
                  className="flex items-start gap-3 p-2 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.tint}`}>
                    <a.icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-bold text-[var(--color-text)]">{a.title}</p>
                      <span className="text-[0.62rem] text-[var(--color-text-muted)] shrink-0">{a.time}</span>
                    </div>
                    <p className="text-[0.7rem] text-[var(--color-text-muted)] leading-snug mt-0.5">{a.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Farm Overview */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-[var(--color-text)]">Farm Overview</h3>
              <button onClick={() => navigate('/farms')} className="text-[0.7rem] font-semibold text-green-600 hover:underline">View Details</button>
            </div>
            <img src={farmAerialImg} alt="Aerial view of farm" className="w-full h-36 object-cover rounded-xl shadow-sm" />
            <dl className="mt-4 space-y-2.5">
              {[
                ['Farm Size', '2 Acres'],
                ['Soil Type', 'Black Soil'],
                ['Last Soil Test', '12 May 2024'],
                ['Organic Matter', '1.2%'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-xs text-[var(--color-text-muted)]">{k}</dt>
                  <dd className="text-xs font-bold text-[var(--color-text)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
