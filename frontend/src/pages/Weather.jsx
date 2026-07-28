// src/pages/Weather.jsx
import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Sun, Cloud, CloudRain, CloudLightning, Wind, Droplets, Thermometer, Eye, Gauge } from 'lucide-react';
import { api } from '../api/client';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const chartOpts = (yLabel) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
    y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 } }, title: { display: true, text: yLabel, color: '#94a3b8', font: { size: 10 } } }
  }
});

const getIcon = (name) => {
  if (name === 'Sun') return Sun;
  if (name === 'Cloud') return Cloud;
  if (name === 'CloudRain') return CloudRain;
  if (name === 'CloudLightning') return CloudLightning;
  return Cloud;
};

export default function Weather() {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      try {
        const { data } = await api.get('/weather');
        if (mounted) {
          setWeather(data);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          toast.error('Failed to load weather data');
          setLoading(false);
        }
      }
    };
    fetchWeather();
    return () => { mounted = false; };
  }, []);

  const TEMP_DATA = weather ? {
    labels: weather.forecast.map(d => d.day.slice(0, 3)),
    datasets: [
      { label: 'High (°C)', data: weather.forecast.map(d => d.high), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
      { label: 'Low (°C)', data: weather.forecast.map(d => d.low), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, borderWidth: 2 },
    ],
  } : null;

  const RAIN_DATA = weather ? {
    labels: weather.forecast.map(d => d.day.slice(0, 3)),
    datasets: [{
      label: 'Rain Probability (%)',
      data: weather.forecast.map(d => d.rain),
      backgroundColor: weather.forecast.map(d => d.rain > 50 ? 'rgba(59,130,246,0.7)' : 'rgba(99,179,237,0.5)'),
      borderRadius: 8,
      borderSkipped: false,
    }],
  } : null;

  const CurrentIcon = weather ? getIcon(weather.current.icon) : Sun;

  return (
    <div className="page-content">
      <PageHeader title="Weather Center" subtitle={weather ? `Live data for ${weather.current.location}` : 'Loading...'} />

      <div className="card mb-5 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 text-white relative">
          <div className="absolute right-6 top-6 opacity-20">
            <CurrentIcon className="w-32 h-32" />
          </div>
          {loading || !weather
            ? <div className="space-y-3"><div className="skeleton h-12 w-32 rounded bg-white/20" /><div className="skeleton h-6 w-48 rounded bg-white/20" /></div>
            : <>
              <p className="text-blue-100 text-sm mb-1">📍 {weather.current.location} · Updated just now</p>
              <div className="flex items-end gap-4 mb-4">
                <span className="text-7xl font-bold">{weather.current.temperature}°C</span>
                <div>
                  <p className="text-xl font-semibold">{weather.current.condition}</p>
                  <p className="text-blue-200">Feels like {weather.current.feelsLike}°C</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { icon: Droplets, label: 'Humidity', val: `${weather.current.humidity}%` },
                  { icon: Wind, label: 'Wind', val: `${weather.current.wind} km/h` },
                  { icon: Gauge, label: 'Pressure', val: `${weather.current.pressure} hPa` },
                  { icon: CloudRain, label: 'Rain chance', val: `${weather.current.rainChance}%` },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Temperature" value={weather ? `${weather.current.temperature}°C` : '-'} icon={Thermometer} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-500" subtitle={weather ? `Max ${weather.forecast[0].high}° · Min ${weather.forecast[0].low}°` : '-'} />
        <StatCard loading={loading} title="Humidity" value={weather ? `${weather.current.humidity}%` : '-'} icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Comfortable range" />
        <StatCard loading={loading} title="Wind Speed" value={weather ? `${weather.current.wind} km/h` : '-'} icon={Wind} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-500" subtitle="Current speed" />
        <StatCard loading={loading} title="Rain Probability" value={weather ? `${weather.current.rainChance}%` : '-'} icon={CloudRain} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-500" subtitle="Today's chance" />
      </div>

      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">7-Day Forecast</h3>
        {loading || !weather
          ? <div className="flex gap-3 overflow-x-auto pb-2">{[...Array(7)].map((_, i) => <div key={i} className="skeleton min-w-[100px] h-28 rounded-xl" />)}</div>
          : <div className="flex gap-3 overflow-x-auto pb-2">
            {weather.forecast.map((day, i) => {
              const DayIcon = getIcon(day.icon);
              return (
                <div key={day.day} className={`flex flex-col items-center gap-2 min-w-[90px] p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${i === 0 ? 'bg-blue-500 text-white border-blue-400' : 'border-[var(--color-border)] hover:border-blue-300'}`}>
                  <span className={`text-xs font-bold ${i === 0 ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}`}>{day.day.slice(0, 3)}</span>
                  <span className={`text-[0.65rem] ${i === 0 ? 'text-blue-200' : 'text-[var(--color-text-muted)]'}`}>{day.date}</span>
                  <DayIcon className={`w-7 h-7 ${i === 0 ? 'text-white' : 'text-blue-400'}`} />
                  <span className={`text-xs font-semibold ${i === 0 ? 'text-white' : 'text-[var(--color-text)]'}`}>{day.condition}</span>
                  <div className={`text-xs ${i === 0 ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}`}>
                    {day.high}° / {day.low}°
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${day.rain > 50 ? (i === 0 ? 'text-blue-100' : 'text-blue-500') : (i === 0 ? 'text-blue-200' : 'text-[var(--color-text-muted)]')}`}>
                    <CloudRain className="w-3 h-3" /> {day.rain}%
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Temperature Trend (7 Days)</h3>
          {loading || !weather ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Line data={TEMP_DATA} options={chartOpts('°C')} /></div>}
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Rain Probability (7 Days)</h3>
          {loading || !weather ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Bar data={RAIN_DATA} options={chartOpts('%')} /></div>}
        </div>
      </div>
    </div>
  );
}
