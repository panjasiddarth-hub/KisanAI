// src/pages/Irrigation.jsx — weather-based irrigation advice for a saved farm.
// Real data only: the farm's own forecast (Open-Meteo, at its confirmed location), FAO-56 crop
// water use, and the farm calendar's irrigation events judged by the calendar's own rain rule.
// KisanAI has no soil-moisture sensors, so no moisture readings are shown.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import FarmPicker from '../components/farms/FarmPicker';
import { MissingInfo, Limitations } from '../components/farms/FarmNotes';
import { useFarms, useFarmParam, farmApi, isConfirmedLocation } from '../hooks/useFarms';
import { apiErrorMessage } from '../api/client';
import { Droplets, CloudRain, Sprout, CalendarCheck, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DECISION = {
  irrigate: { label: 'Go ahead', badge: 'badge-green', icon: Droplets, cls: 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/10' },
  skip: { label: 'Skip', badge: 'badge-blue', icon: CloudRain, cls: 'border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/10' },
  done: { label: 'Done', badge: 'badge-green', icon: CheckCircle, cls: 'border-[var(--color-border)]' },
  unknown: { label: 'Check manually', badge: 'badge-yellow', icon: HelpCircle, cls: 'border-amber-200 dark:border-amber-900/40' },
};
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const litres = (l) => (l >= 1000 ? `${(l / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} kL` : `${l} L`);
const show = (v, unit = '') => (v === null || v === undefined ? '–' : `${v}${unit}`);

function Advice({ data }) {
  const o = data.outlook;
  const crop = data.crop;
  const next = data.events.find((e) => e.decision !== 'done');
  const chart = {
    labels: data.days.map((d) => `${dayLabel(d.date)}${d.kind === 'recent-model-estimate' ? ' (est.)' : ''}`),
    datasets: [
      { label: 'Rain (mm)', data: data.days.map((d) => d.rainMm), backgroundColor: data.days.map((d) => (d.kind === 'forecast' ? 'rgba(59,130,246,0.75)' : 'rgba(59,130,246,0.35)')), borderRadius: 6 },
      o.etcMm !== null
        ? { label: 'Crop water use, ETc (mm)', data: data.days.map((d) => d.etcMm), backgroundColor: 'rgba(22,163,74,0.7)', borderRadius: 6 }
        : { label: 'Reference ET0 (mm)', data: data.days.map((d) => d.et0Mm), backgroundColor: 'rgba(100,116,139,0.45)', borderRadius: 6 },
    ],
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5" data-testid="irr-stats">
        {o.etcMm !== null
          ? <StatCard title="Crop water use · 7 days" value={`${o.etcMm} mm`} icon={Sprout} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600" subtitle={`${crop.name} · Kc ${show(crop.kcToday)} today`} />
          : <StatCard title="Reference ET0 · 7 days" value={`${o.et0Mm} mm`} icon={Sprout} iconBg="bg-gray-100 dark:bg-slate-800" iconColor="text-gray-500" subtitle="Crop-specific value not available" />}
        <StatCard title="Forecast rain · 7 days" value={`${o.rainMm} mm`} icon={CloudRain} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle={`${dayLabel(o.from)} – ${dayLabel(o.to)}`} />
        <StatCard title="Water still needed" value={o.netMm === null ? '–' : `${o.netMm} mm`} icon={Droplets} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-500"
          subtitle={o.netMm === null ? 'Needs a crop with FAO-56 values' : o.netLitres !== null ? `≈ ${litres(o.netLitres)} for ${o.acres} acres (soil water not counted)` : 'ETc minus forecast rain'} />
        <StatCard title="Next calendar irrigation" value={next ? DECISION[next.decision].label : 'None this week'} icon={CalendarCheck} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-500"
          subtitle={next ? dayLabel(next.date) : data.nextEventAfterWindow ? `Next: ${dayLabel(data.nextEventAfterWindow.date)}` : 'No calendar events'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card p-5 space-y-3" data-testid="irr-events">
          <h3 className="font-bold text-sm text-[var(--color-text)]">Irrigation events in your calendar · next 7 days</h3>
          {crop ? (
            <p className="text-[0.72rem] text-[var(--color-text-muted)]" data-testid="irr-crop">
              <b className="text-[var(--color-text)]">{crop.name}</b>, sown {crop.sowingDate} (day {crop.das}{crop.stage ? `, ${crop.stage}` : ''}) — from your {crop.from}.
              {crop.kcSource && <> Crop coefficient: {crop.kcSource}.</>}
            </p>
          ) : <p className="text-[0.72rem] text-[var(--color-text-muted)]">No crop or calendar for this farm yet.</p>}
          {data.events.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {data.nextEventAfterWindow ? `No irrigation event falls in the next 7 days. The next one is ${dayLabel(data.nextEventAfterWindow.date)}.` : 'No upcoming irrigation events.'}
            </p>
          )}
          {data.events.map((e) => {
            const d = DECISION[e.decision];
            return (
              <div key={e.date} className={`flex items-start gap-3 p-3 rounded-xl border ${d.cls}`} data-testid="irr-event" data-decision={e.decision}>
                <d.icon className="w-5 h-5 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-xs text-[var(--color-text)]">{dayLabel(e.date)} · {e.title}</p>
                    <span className={`badge ${d.badge}`}>{d.label}</span>
                  </div>
                  <p className="text-[0.7rem] text-[var(--color-text)] mt-0.5">{e.reason}</p>
                  {e.eventDay && <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-0.5">On the day: {show(e.eventDay.rainMm, ' mm')} rain forecast, {show(e.eventDay.rainProbability, '%')} chance.</p>}
                </div>
              </div>
            );
          })}
          <p className="text-[0.65rem] text-[var(--color-text-muted)]">Rule: {data.rule.text}.</p>
        </div>

        <div className="card p-5">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">Rain vs {o.etcMm !== null ? 'crop water use' : 'reference evapotranspiration'}</h3>
          <p className="text-[0.68rem] text-[var(--color-text-muted)] mb-3">Last 2 days are the weather model’s estimate (est.); the rest is forecast.</p>
          <div className="h-56"><Bar data={chart} options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#64748b', font: { size: 11 }, boxWidth: 12 } } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
              y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: (v) => `${v} mm` } },
            },
          }} /></div>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[0.68rem]" data-testid="irr-days">
              <thead><tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]"><th className="py-1">Day</th><th>Rain</th><th>Chance</th><th>ET0</th><th>Kc</th><th>ETc</th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.days.map((d) => (
                  <tr key={d.date} className={d.kind === 'forecast' ? '' : 'text-[var(--color-text-muted)]'}>
                    <td className="py-1">{dayLabel(d.date)}{d.kind === 'forecast' ? '' : ' (est.)'}</td>
                    <td>{show(d.rainMm, ' mm')}</td><td>{show(d.rainProbability, '%')}</td><td>{show(d.et0Mm, ' mm')}</td><td>{show(d.kc)}</td><td>{show(d.etcMm, ' mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Irrigation() {
  const { farms, loading: farmsLoading } = useFarms();
  const located = farms.filter((f) => isConfirmedLocation(f.coordinates));
  const [farmId, setFarmId] = useFarmParam(located);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!farmId) return undefined;
    let alive = true;
    setLoading(true);
    setError(null);
    farmApi.irrigation(farmId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) { setData(null); setError(apiErrorMessage(e)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [farmId]);

  return (
    <div className="page-content">
      <PageHeader title="Irrigation Planner" subtitle="Weather-based irrigation advice for your farm — from its own forecast and season calendar" />

      {farmsLoading ? <div className="skeleton h-40 rounded-xl" />
        : farms.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--color-text-muted)]" data-testid="irr-empty">No farms yet. <Link to="/farms" className="text-green-700 dark:text-green-400 font-semibold underline">Add your farm</Link> and confirm its location to get irrigation advice.</div>
        ) : located.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--color-text-muted)]" data-testid="irr-no-location">None of your farms has a confirmed location yet. Open <Link to="/farms" className="text-green-700 dark:text-green-400 font-semibold underline">Farms</Link> → Edit → Farm location and confirm it — irrigation advice uses the farm’s own weather, never a default location.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <FarmPicker farms={located} value={farmId} onChange={setFarmId} testid="irr-farm-picker" />
              {farms.length > located.length && <span className="text-[0.7rem] text-[var(--color-text-muted)]">{farms.length - located.length} farm(s) hidden — location not confirmed.</span>}
            </div>
            {loading && <div className="card p-8 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Loading this farm’s weather…</div>}
            {!loading && error && <div className="card p-4 text-sm text-red-600" data-testid="irr-error">{error}</div>}
            {!loading && data && (
              <div data-testid="irr-result" data-status={data.status}>
                <Advice data={data} />
                <div className="space-y-3">
                  <MissingInfo missing={data.missing} testid="irr-missing" />
                  <Limitations limitations={data.limitations} sources={data.sources} testid="irr-limitations" />
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
