// src/pages/Weather.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Sun, Cloud, CloudRain, CloudLightning, Wind, Droplets, Thermometer, Gauge, AlertTriangle } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useFarms, isConfirmedLocation } from '../hooks/useFarms';
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
  const { farms, loading: farmsLoading } = useFarms();
  const locatedFarms = farms.filter(f => isConfirmedLocation(f.coordinates));
  // { type: 'farm', farmId } | { type: 'coords', lat, lon, label, source } | { type: 'default' }
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [searching, setSearching] = useState(false);
  const initialised = useRef(false);

  // Device location (original behaviour), labelled via reverse geocoding; falls back to the flagged default
  const locateDevice = useCallback(() => {
    if (!('geolocation' in navigator)) { setSelection({ type: 'default' }); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let label = 'Current Location';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              const parts = data.display_name.split(',').map(s => s.trim());
              label = parts.slice(0, Math.min(4, parts.length)).join(', ');
            }
          }
        } catch (err) {
          console.warn('Reverse geocoding failed', err);
        }
        setSelection({ type: 'coords', lat, lon, label, source: 'device' });
      },
      (err) => {
        console.warn('Geolocation failed, using the default location', err);
        setSelection({ type: 'default' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // First choice: a farm with confirmed coordinates; then the device; then the (clearly labelled) default
  useEffect(() => {
    if (farmsLoading || initialised.current) return;
    initialised.current = true;
    const firstFarm = farms.find(f => isConfirmedLocation(f.coordinates));
    if (firstFarm) setSelection({ type: 'farm', farmId: firstFarm.id });
    else locateDevice();
  }, [farmsLoading, farms, locateDevice]);

  useEffect(() => {
    if (!selection) return;
    let mounted = true;
    setLoading(true);
    setError('');
    const request = selection.type === 'farm'
      ? api.get(`/farms/${selection.farmId}/weather`)
      : selection.type === 'coords'
        ? api.get('/weather', { params: { lat: selection.lat, lon: selection.lon, location: selection.label } })
        : api.get('/weather');
    request
      .then(({ data }) => { if (mounted) setWeather(data); })
      .catch((err) => { if (mounted) { setWeather(null); setError(apiErrorMessage(err, 'Weather data is unavailable right now.')); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [selection]);

  // Manual location entry (fallback when a farm has no confirmed location or GPS is unavailable)
  const searchPlaces = async (e) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const { data } = await api.get('/weather/geocode', { params: { q: query.trim() } });
      setPlaces(data.results);
      if (!data.results.length) toast('No places found — try a nearby town or district.', { icon: '🔎' });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Place search is unavailable right now'));
    } finally { setSearching(false); }
  };

  const onPick = (value) => {
    if (value.startsWith('farm:')) setSelection({ type: 'farm', farmId: value.slice(5) });
    else if (value === 'device') locateDevice();
  };
  const selectValue = selection?.type === 'farm' ? `farm:${selection.farmId}` : selection?.type || '';

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
      <PageHeader title="Weather Center" subtitle={weather ? `${weather.farm ? 'Farm weather' : 'Weather'} for ${weather.current.location}${weather.isDefaultLocation ? ' (default location — not your farm)' : ''}` : error ? 'Weather unavailable' : 'Loading...'} />

      <div className="card p-4 mb-5 space-y-3" data-testid="weather-location-bar">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Show weather for</label>
            <select className="input text-sm !py-2" value={selectValue} onChange={(e) => onPick(e.target.value)} data-testid="weather-location-select">
              {!selection && <option value="">Choosing a location…</option>}
              {locatedFarms.map(f => <option key={f.id} value={`farm:${f.id}`}>🏡 {f.name}</option>)}
              <option value="device">📍 My device location</option>
              {selection?.type === 'coords' && <option value="coords">{selection.source === 'device' ? '📍' : '🔎'} {selection.label}</option>}
              {selection?.type === 'default' && <option value="default">Default location (Nashik) — not your farm</option>}
            </select>
          </div>
          <form onSubmit={searchPlaces} className="flex items-end gap-2 flex-1 min-w-[240px]">
            <div className="flex-1">
              <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Or enter a location</label>
              <input className="input text-sm !py-2" placeholder="Village, town or district" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button type="submit" disabled={searching} className="btn-secondary text-sm">{searching ? 'Searching…' : 'Search'}</button>
          </form>
        </div>
        {places.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {places.map(p => (
              <button key={`${p.lat},${p.lon}`} onClick={() => { setSelection({ type: 'coords', lat: p.lat, lon: p.lon, label: p.label, source: 'manual' }); setPlaces([]); }} className="badge badge-blue cursor-pointer">{p.label}</button>
            ))}
          </div>
        )}
        <p className="text-[0.7rem] text-[var(--color-text-muted)]">
          {farms.length > locatedFarms.length && `${farms.length - locatedFarms.length} farm(s) have no confirmed location yet — add it on My Farms. `}
          “Now” values are a weather-model estimate for the current 15 minutes, not a ground-station observation. Everything else on this page is a forecast.
        </p>
      </div>

      {error && !loading && (
        <div className="card p-5 mb-5 flex items-start gap-3" role="alert" data-testid="weather-error">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-[var(--color-text)]">Weather unavailable</p>
            <p className="text-[var(--color-text-muted)]">{error}</p>
            <button onClick={() => setSelection(sel => (sel ? { ...sel } : sel))} className="btn-secondary text-xs mt-2">Try again</button>
          </div>
        </div>
      )}

      {!error && (<>

      <div className="card mb-5 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 text-white relative">
          <div className="absolute right-6 top-6 opacity-20">
            <CurrentIcon className="w-32 h-32" />
          </div>
          {loading || !weather
            ? <div className="space-y-3"><div className="skeleton h-12 w-32 rounded bg-white/20" /><div className="skeleton h-6 w-48 rounded bg-white/20" /></div>
            : <>
              <p className="text-blue-100 text-sm mb-1">📍 {weather.current.location}{weather.isDefaultLocation ? ' (default location — not your farm)' : ''} · Current conditions: weather-model estimate, not a station observation</p>
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
        <StatCard loading={loading} title="Temperature" value={weather ? `${weather.current.temperature}°C` : '-'} icon={Thermometer} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-500" subtitle={weather ? `Today's forecast: max ${weather.forecast[0].high}° · min ${weather.forecast[0].low}°` : '-'} />
        <StatCard loading={loading} title="Humidity" value={weather ? `${weather.current.humidity}%` : '-'} icon={Droplets} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Now · model estimate" />
        <StatCard loading={loading} title="Wind Speed" value={weather ? `${weather.current.wind} km/h` : '-'} icon={Wind} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-500" subtitle="Now · model estimate" />
        <StatCard loading={loading} title="Rain Probability" value={weather ? `${weather.current.rainChance}%` : '-'} icon={CloudRain} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-500" subtitle="This hour · forecast" />
      </div>

      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">24-Hour Forecast</h3>
        {loading || !weather
          ? <div className="flex gap-3 overflow-x-auto pb-2">{[...Array(12)].map((_, i) => <div key={`sk-h-${i}`} className="skeleton min-w-[80px] h-28 rounded-xl" />)}</div>
          : <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {weather.hourly.map((hour, i) => {
              const HourIcon = getIcon(hour.icon);
              return (
                <div key={`h-${i}`} className={`flex flex-col items-center justify-center gap-1.5 min-w-[80px] p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${i === 0 ? 'bg-blue-500 text-white border-blue-400' : 'border-[var(--color-border)] hover:border-blue-300'}`}>
                  <span className={`text-xs font-bold ${i === 0 ? 'text-blue-100' : 'text-[var(--color-text-muted)]'}`}>{i === 0 ? 'Now' : hour.time}</span>
                  <HourIcon className={`w-7 h-7 my-1 ${i === 0 ? 'text-white' : 'text-blue-400'}`} />
                  <span className={`text-sm font-bold ${i === 0 ? 'text-white' : 'text-[var(--color-text)]'}`}>{hour.temp}°C</span>
                  <div className={`flex items-center gap-1 text-[0.65rem] ${hour.rain > 30 ? (i === 0 ? 'text-blue-100' : 'text-blue-500') : (i === 0 ? 'text-blue-200' : 'text-[var(--color-text-muted)]')}`}>
                    <CloudRain className="w-3 h-3" /> {hour.rain}%
                  </div>
                </div>
              );
            })}
          </div>
        }
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
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Temperature Forecast (7 Days)</h3>
          {loading || !weather ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Line data={TEMP_DATA} options={chartOpts('°C')} /></div>}
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">Rain Probability Forecast (7 Days)</h3>
          {loading || !weather ? <div className="skeleton h-44 rounded-xl" /> : <div className="h-44"><Bar data={RAIN_DATA} options={chartOpts('%')} /></div>}
        </div>
      </div>
      </>)}
    </div>
  );
}
