// src/pages/Weather.jsx
// Weather module with forecast, charts, and rain prediction

import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Sun, Cloud, CloudRain, CloudLightning, Wind, Droplets, Thermometer, Eye, Gauge } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const WEEKLY_FORECAST = [
  { day: 'Monday', date: 'Jul 18', icon: Sun, condition: 'Sunny', high: 32, low: 22, rain: 5, humidity: 65, wind: 12 },
  { day: 'Tuesday', date: 'Jul 19', icon: Cloud, condition: 'Cloudy', high: 30, low: 21, rain: 15, humidity: 70, wind: 14 },
  { day: 'Wednesday', date: 'Jul 20', icon: CloudRain, condition: 'Rainy', high: 26, low: 20, rain: 80, humidity: 88, wind: 18 },
  { day: 'Thursday', date: 'Jul 21', icon: CloudRain, condition: 'Showers', high: 25, low: 19, rain: 70, humidity: 85, wind: 20 },
  { day: 'Friday', date: 'Jul 22', icon: Cloud, condition: 'Overcast', high: 28, low: 21, rain: 30, humidity: 72, wind: 15 },
  { day: 'Saturday', date: 'Jul 23', icon: Sun, condition: 'Partly Cloudy', high: 31, low: 22, rain: 10, humidity: 60, wind: 10 },
  { day: 'Sunday', date: 'Jul 24', icon: Sun, condition: 'Sunny', high: 33, low: 23, rain: 5, humidity: 55, wind: 8 },
];

const TEMP_DATA = {
  labels: WEEKLY_FORECAST.map(d => d.day.slice(0, 3)),
  datasets: [
    { label: 'High (°C)', data: WEEKLY_FORECAST.map(d => d.high), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
    { label: 'Low (°C)', data: WEEKLY_FORECAST.map(d => d.low), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
  ],
};

const RAIN_DATA = {
  labels: WEEKLY_FORECAST.map(d => d.day.slice(0, 3)),
  datasets: [{
    label: 'Rain Probability (%)',
    data: WEEKLY_FORECAST.map(d => d.rain),
    backgroundColor: WEEKLY_FORECAST.map(d => d.rain > 50 ? 'rgba(59,130,246,0.7)' : 'rgba(99,179,237,0.5)'),
    borderRadius: 8,
    borderSkipped: false,
  }],
};

const chartOpts = (yLabel) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
    y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 } }, title: { display: true, text: yLabel, color: '#94a3b8', font: { size: 10 } } }
  }
});

export default function Weather() {
  const [loading, setLoading] = useState(true);
  const [location] = useState('Nashik, Maharashtra');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="page-content">
      <PageHeader title="Weather Center" subtitle={`Live data for ${location}`} />

      {/* Current weather hero */}
      <div className="card mb-5 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 text-white relative">
          <div className="absolute right-6 top-6 opacity-20">
            <Sun className="w-32 h-32" />
          </div>
          {loading
            ? <div className="space-y-3"><div className="skeleton h-12 w-32 rounded bg-white/20" /><div className="skeleton h-6 w-48 rounded bg-white/20" /></div>
            : <>
              <p className="text-blue-100 text-sm mb-1">📍 {location} · Updated just now</p>
              <div className="flex items-end gap-4 mb-4">
                <span className="text-7xl font-bold">28°C</span>
                <div>
                  <p className="text-xl font-semibold">Partly Cloudy</p>
                  <p className="text-blue-200">Feels like 31°C</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: Droplets, label: 'Humidity', val: '72%' },
                  { icon: Wind, label: 'Wind', val: '14 km/h NW' },
                  { icon: Eye, label: 'Visibility', val: '8 km' },
                  { icon: Gauge, label: 'Pressure', val: '1012 hPa' },
                  { icon: CloudRain, label: 'Rain chance', val: '15%' },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-2">
                    <m.icon className="w-4 h-4 text-blue-200" />
                    <span className="text-sm text-blue-100">{m.label}:</span>
                    <span className="text-sm font-semibold">{m.val}</span>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Temperature" value="28°C" icon={Thermometer} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-500" subtitle="Max 32° · Min 22°" />
        <StatCard loading={loading} title="Humidity" value="72%" icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Comfortable range" />
        <StatCard loading={loading} title="Wind Speed" value="14 km/h" icon={Wind} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-500" subtitle="NW Direction" />
        <StatCard loading={loading} title="Rain Probability" value="15%" icon={CloudRain} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-500" subtitle="Low risk today" />
      </div>

      {/* 7-day forecast cards */}
      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">7-Day Forecast</h3>
        {loading
          ? <div className="flex gap-3 overflow-x-auto pb-2">{[...Array(7)].map((_, i) => <div key={i} className="skeleton min-w-[100px] h-28 rounded-xl" />)}</div>
          : <div className="flex gap-3 overflow-x-auto pb-2">
            {WEEKLY_FORECAST.map((day, i) => (
              <div key={day.day} className={`flex flex-col items-center gap-2 min-w-[90px] p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${i === 0 ? 'bg-blue-500 text-white border-blue-400' : 'border-[var(--color-border)] hover:border-blue-300'}`}>
                <span className={`text-xs font-bold ${i === 0 ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}`}>{day.day.slice(0, 3)}</span>
                <span className={`text-[0.65rem] ${i === 0 ? 'text-blue-200' : 'text-[var(--color-text-muted)]'}`}>{day.date}</span>
                <day.icon className={`w-7 h-7 ${i === 0 ? 'text-white' : 'text-blue-400'}`} />
                <span className={`text-xs font-semibold ${i === 0 ? 'text-white' : 'text-[var(--color-text)]'}`}>{day.condition}</span>
                <div className={`text-xs ${i === 0 ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}`}>
                  {day.high}° / {day.low}°
                </div>
                <div className={`flex items-center gap-1 text-xs ${day.rain > 50 ? (i === 0 ? 'text-blue-100' : 'text-blue-500') : (i === 0 ? 'text-blue-200' : 'text-[var(--color-text-muted)]')}`}>
                  <CloudRain className="w-3 h-3" /> {day.rain}%
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Temperature Trend (7 Days)</h3>
          {loading ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Line data={TEMP_DATA} options={chartOpts('°C')} /></div>}
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Rain Probability (7 Days)</h3>
          {loading ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Bar data={RAIN_DATA} options={chartOpts('%')} /></div>}
        </div>
      </div>

      {/* Agricultural advisory */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">🌾 Agricultural Weather Advisory</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: '💧', title: 'Irrigation', msg: 'No irrigation needed for next 48 hours. Rain expected on Wednesday. Save water!', color: 'blue' },
            { icon: '🌿', title: 'Spray Operations', msg: 'Avoid pesticide spray on Tuesday–Thursday due to rain. Best window is Friday afternoon.', color: 'green' },
            { icon: '⚡', title: 'Harvest Alert', msg: 'Soybean harvest should be completed before Wednesday. Rain may cause pod shattering.', color: 'amber' },
          ].map(a => (
            <div key={a.title} className={`p-4 rounded-xl border ${a.color === 'blue' ? 'bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30' : a.color === 'green' ? 'bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30' : 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30'}`}>
              <div className="text-2xl mb-2">{a.icon}</div>
              <h4 className="font-bold text-sm text-[var(--color-text)] mb-1">{a.title}</h4>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{a.msg}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
