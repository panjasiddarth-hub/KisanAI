// src/pages/Calendar.jsx — AI crop season planner (timeline from sowing to harvest)
import { useCallback, useEffect, useState } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { getWeather } from '../api/weather';
import { FALLBACK_META } from '../api/fallback';
import { useFarms } from '../hooks/useFarms';
import OfflineCard from '../components/ui/OfflineCard';
import GovernmentAdvisoryLink from '../components/farm/GovernmentAdvisoryLink';
import {
  CalendarDays, Loader2, Sparkles, Droplets, FlaskConical, Bug,
  Sprout, Tractor, Scissors, CheckCircle2, Trash2, Wheat, Circle,
  MapPin, Bot, Bell, BellOff, CalendarClock, Save, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_META = {
  prep: { icon: Tractor, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700/40' },
  sowing: { icon: Sprout, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-950/40' },
  irrigation: { icon: Droplets, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-950/40' },
  fertilizer: { icon: FlaskConical, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950/40' },
  pest: { icon: Bug, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/40' },
  weeding: { icon: Scissors, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
  harvest: { icon: Wheat, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/40' },
  task: { icon: Circle, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-700/40' },
};

const AGENT_BADGE = {
  'fertilizer-agent': { label: 'Fertilizer Agent', cls: 'badge-yellow' },
  'disease-agent': { label: 'Disease Agent', cls: 'badge-red' },
  'calendar-agent': null,
};

const monthLabel = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const dayLabel = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const isPast = (dateStr) => dateStr <= localDate();
const REMINDER_STORAGE_KEY = 'kisanai-calendar-reminders-enabled';
const REMINDER_SENT_KEY = 'kisanai-calendar-reminders-sent';

export default function Calendar() {
  const { farms, loading: farmsLoading } = useFarms();
  const [meta, setMeta] = useState(FALLBACK_META);
  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState({ crop: 'Cotton', sowingDate: localDate(), areaAcres: 2 });
  const [busy, setBusy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [offline, setOffline] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [farmWeather, setFarmWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(() =>
    typeof window !== 'undefined'
    && window.localStorage.getItem(REMINDER_STORAGE_KEY) === 'enabled'
    && 'Notification' in window
    && Notification.permission === 'granted'
  );
  const [editingEventKey, setEditingEventKey] = useState(null);
  const [dateDraft, setDateDraft] = useState('');
  const [savingEventKey, setSavingEventKey] = useState(null);
  const selectedFarm = farms.find(farm => farm.id === selectedFarmId) || null;

  const load = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const { data } = await api.get('/calendar');
      setPlans(data.plans);
      setActiveId(prev => prev || data.plans[0]?.id || null);
      setOffline(false);
    } catch (err) {
      if (isOfflineError(err)) setOffline(true);
      else toast.error(apiErrorMessage(err));
    } finally { setLoadingPlans(false); }
  }, []);

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {});
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedFarmId && farms.length === 1) setSelectedFarmId(farms[0].id);
  }, [farms, selectedFarmId]);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/calendar/generate', {
        ...form,
        areaAcres: Number(form.areaAcres),
        farmId: selectedFarmId || undefined,
        farmName: selectedFarm?.name || 'My Farm',
      });
      setExplanation(data.explanation);
      toast.success(`${data.plan.crop} season planned — ${data.plan.events.length} activities scheduled!`);
      await load();
      setActiveId(data.plan.id);
    } catch (err) {
      if (isOfflineError(err)) setOffline(true);
      else toast.error(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  const toggleDone = async (plan, idx) => {
    // optimistic UI
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, events: p.events.map((ev, i) => i === idx ? { ...ev, done: !ev.done } : ev) } : p));
    try {
      await api.patch(`/calendar/${plan.id}/events/${idx}`, { done: !plan.events[idx].done });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update this task.'));
      load();
    }
  };

  const rescheduleEvent = async (plan, index) => {
    const key = `${plan.id}:${index}`;
    if (!dateDraft) return toast.error('Choose a valid task date.');
    setSavingEventKey(key);
    try {
      const { data } = await api.patch(`/calendar/${plan.id}/events/${index}`, { date: dateDraft });
      setPlans(prev => prev.map(item => item.id === plan.id ? data.plan : item));
      setEditingEventKey(null);
      toast.success('Task date updated. Its browser reminder follows the new date.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not reschedule this task.'));
    } finally {
      setSavingEventKey(null);
    }
  };

  const toggleReminders = async () => {
    if (remindersEnabled) {
      window.localStorage.removeItem(REMINDER_STORAGE_KEY);
      setRemindersEnabled(false);
      toast.success('Calendar reminders are off.');
      return;
    }
    if (!('Notification' in window)) {
      toast.error('This browser does not support notifications.');
      return;
    }
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Allow notifications in your browser to receive calendar reminders.');
        return;
      }
      window.localStorage.setItem(REMINDER_STORAGE_KEY, 'enabled');
      setRemindersEnabled(true);
      toast.success('Browser reminders enabled for tasks due today.');
    } catch {
      toast.error('Could not enable browser reminders in this browser.');
    }
  };

  const deletePlan = async (id) => {
    try {
      await api.delete(`/calendar/${id}`);
      toast.success('Plan deleted');
      setActiveId(null);
      load();
    } catch (err) { toast.error(apiErrorMessage(err)); }
  };

  const active = plans.find(p => p.id === activeId);
  const weatherFarm = active
    ? active.farmId ? farms.find(farm => farm.id === active.farmId) || null : null
    : selectedFarm;
  useEffect(() => {
    if (!weatherFarm?.location) {
      setFarmWeather(null);
      setWeatherError('');
      setWeatherLoading(false);
      return undefined;
    }
    let current = true;
    setWeatherLoading(true);
    setWeatherError('');
    getWeather({ location: weatherFarm.location })
      .then(data => { if (current) setFarmWeather(data); })
      .catch(error => { if (current) { setFarmWeather(null); setWeatherError(apiErrorMessage(error, 'Farm forecast is unavailable.')); } })
      .finally(() => { if (current) setWeatherLoading(false); });
    return () => { current = false; };
  }, [weatherFarm?.id, weatherFarm?.location]);
  const doneCount = active ? active.events.filter(e => e.done).length : 0;

  useEffect(() => {
    if (!remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    const checkDueTasks = () => {
      let sent = [];
      try { sent = JSON.parse(window.localStorage.getItem(REMINDER_SENT_KEY) || '[]'); } catch { sent = []; }
      const sentKeys = new Set(Array.isArray(sent) ? sent : []);
      const today = localDate();
      let updated = false;
      plans.forEach(plan => plan.events.forEach((event, index) => {
        if (event.done || event.date !== today) return;
        const key = `${plan.id}:${index}:${event.date}`;
        if (sentKeys.has(key)) return;
        try {
          new Notification('KisanAI task reminder', {
            body: `${event.title} · ${plan.crop} is scheduled for today.`,
            tag: key,
          });
          sentKeys.add(key);
          updated = true;
        } catch { /* Browser notifications can be blocked by device settings. */ }
      }));
      if (updated) {
        try { window.localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify([...sentKeys].slice(-200))); } catch { /* Optional reminder deduplication. */ }
      }
    };
    checkDueTasks();
    const timer = window.setInterval(checkDueTasks, 60_000);
    return () => window.clearInterval(timer);
  }, [plans, remindersEnabled]);

  // group events by month
  const grouped = {};
  active?.events.forEach((ev, idx) => {
    const key = monthLabel(ev.date);
    (grouped[key] = grouped[key] || []).push({ ...ev, idx });
  });

  if (offline) {
    return (
      <div className="page-content" style={{ maxWidth: '900px' }}>
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-blue-600" /></span>
            Farm Calendar
          </h2>
        </div>
        <OfflineCard onRetry={load} />
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-blue-600" /></span>
          Farm Calendar
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Create a draft timeline for field tasks and check-ins. Harvest dates are estimates; fertilizer doses and irrigation instructions require your soil report and local guidance.</p>
      </div>

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><Bell className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">Task reminders</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Optional browser alerts on the task date. Keep this tab open; these are not background push notifications.</p>
            {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' && !remindersEnabled && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Notifications are blocked in browser settings. Allow them for this site to enable reminders.</p>}
          </div>
        </div>
        <button type="button" onClick={toggleReminders} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-text)] hover:border-green-500">
          {remindersEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {remindersEnabled ? 'Turn reminders off' : 'Enable reminders'}
        </button>
      </div>

      {/* New plan form */}
      <form onSubmit={generate} className="card p-4 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="calendar-farm" className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Farm for local weather</label>
          <select id="calendar-farm" value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)} disabled={farmsLoading} className="input text-sm !py-2">
            <option value="">No saved farm selected</option>
            {farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name} · {farm.location}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Crop</label>
          <select value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))} className="input text-sm !py-2">
            {meta.crops.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Sowing date</label>
          <input type="date" value={form.sowingDate} onChange={e => setForm(f => ({ ...f, sowingDate: e.target.value }))} className="input text-sm !py-2" />
        </div>
        <div className="w-24">
          <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Acres</label>
          <input type="number" min="0.25" step="0.25" value={form.areaAcres} onChange={e => setForm(f => ({ ...f, areaAcres: e.target.value }))} className="input text-sm !py-2" />
        </div>
        <button type="submit" disabled={busy} className="flex items-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Plan My Season
        </button>
      </form>

      {weatherFarm && <div className="card p-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[var(--color-text)]">7-day forecast · {weatherFarm.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Forecast context for this farm only. It does not automatically change calendar tasks or prescribe irrigation.</p>
          </div>
          {weatherLoading && <span className="text-xs text-[var(--color-text-muted)]">Loading farm forecast…</span>}
          {weatherError && <span className="text-xs text-amber-700">{weatherError}</span>}
        </div>
        {farmWeather?.forecast?.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {farmWeather.forecast.map(day => <div key={day.dateISO} className="min-w-[100px] rounded-xl border border-[var(--color-border)] p-2 text-center">
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">{new Date(`${day.dateISO}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            <p className="mt-1 text-xs font-bold text-[var(--color-text)]">{day.condition}</p>
            <p className="mt-1 text-[0.68rem] text-[var(--color-text-muted)]">Rain {day.precipitationMm} mm · {day.rain}% chance</p>
          </div>)}
        </div>}
      </div>}

      {/* Plan picker chips */}
      {plans.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {plans.map(p => (
            <button key={p.id} onClick={() => setActiveId(p.id)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border transition-colors ${activeId === p.id ? 'bg-[#15803d] text-white border-[#15803d]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-400'}`}>
              <Sprout className="w-3.5 h-3.5" /> {p.crop} · {dayLabel(p.sowingDate)}
            </button>
          ))}
        </div>
      )}

      {loadingPlans ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : !active ? (
        <div className="card p-10 text-center text-sm text-[var(--color-text-muted)]">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-blue-200" />
          <p className="font-semibold text-[var(--color-text)]">No season planned yet</p>
          <p className="mt-1">Choose a crop and sowing date above to create a draft timeline of field tasks and check-ins.</p>
        </div>
      ) : (
        <div className="fade-in">
          {/* Summary card */}
          <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-5 mb-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-lg text-[var(--color-text)]">{active.crop} — {active.season} {new Date(active.sowingDate).getFullYear()}</h3>
                  <span className="badge badge-green capitalize">{active.season}</span>
                  <span className="badge badge-blue"><MapPin className="w-3 h-3" /> {active.areaAcres} acres</span>
                </div>
                <p className="text-[0.78rem] text-[var(--color-text-muted)] mt-1">
                  Sowing {dayLabel(active.sowingDate)} · Harvest {active.harvestWindow} · {doneCount}/{active.events.length} activities done
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-28">
                  <div className="h-2 rounded-full bg-white dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${active.events.length ? (doneCount / active.events.length) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[0.62rem] text-[var(--color-text-muted)] mt-1 text-right">{Math.round(active.events.length ? (doneCount / active.events.length) * 100 : 0)}% complete</p>
                </div>
                <button onClick={() => deletePlan(active.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Delete plan">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {explanation && (
              <p className="text-[0.8rem] text-[var(--color-text)] leading-relaxed mt-3 pt-3 border-t border-green-200/60 dark:border-green-900/30 flex gap-2">
                <Sparkles className="w-4 h-4 text-green-700 shrink-0 mt-0.5" /> {explanation}
              </p>
            )}
          </div>

          {weatherFarm && <div className="mb-4">
            <GovernmentAdvisoryLink farm={weatherFarm} crop={active.crop} />
          </div>}

          {/* Timeline by month */}
          {Object.entries(grouped).map(([month, events]) => (
            <div key={month} className="mb-4">
              <h4 className="text-[0.72rem] font-extrabold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">{month}</h4>
              <div className="card divide-y divide-[var(--color-border)]">
                {events.map(ev => {
                  const meta = TYPE_META[ev.type] || TYPE_META.task;
                  const badge = AGENT_BADGE[ev.agent];
                  const eventForecast = active.farmId && active.farmId === weatherFarm?.id
                    ? farmWeather?.forecast?.find(day => day.dateISO === ev.date)
                    : null;
                  return (
                    <div key={ev.idx}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors ${ev.done ? 'opacity-55' : ''}`}>
                      <button type="button" onClick={() => toggleDone(active, ev.idx)} aria-label={ev.done ? `Mark ${ev.title} incomplete` : `Mark ${ev.title} complete`} aria-pressed={ev.done} className={`mt-0.5 shrink-0 ${ev.done ? 'text-green-600' : 'text-gray-300 dark:text-slate-600'}`}>
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <meta.icon className={`w-4 h-4 ${meta.color}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-bold text-[var(--color-text)] ${ev.done ? 'line-through' : ''}`}>{ev.title}</p>
                          {badge && <span className={`badge ${badge.cls} !text-[0.58rem]`}><Bot className="w-2.5 h-2.5" /> {badge.label}</span>}
                          {isPast(ev.date) && !ev.done && <span className="badge badge-red !text-[0.58rem]">due</span>}
                        </div>
                        {ev.notes && <p className="text-[0.7rem] text-[var(--color-text-muted)] leading-snug mt-0.5">{ev.notes}</p>}
                        {eventForecast && <p className="mt-1 text-[0.68rem] font-medium text-sky-700 dark:text-sky-300">Farm forecast: {eventForecast.condition}, {eventForecast.precipitationMm} mm rain expected ({eventForecast.rain}% chance). Check the latest forecast before acting.</p>}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        {editingEventKey === `${active.id}:${ev.idx}` ? (
                          <form onSubmit={event => { event.preventDefault(); rescheduleEvent(active, ev.idx); }} className="flex items-center gap-1.5">
                            <input aria-label={`New date for ${ev.title}`} type="date" value={dateDraft} onChange={event => setDateDraft(event.target.value)} className="input !w-auto !px-2 !py-1 text-[0.68rem]" />
                            <button type="submit" disabled={savingEventKey === `${active.id}:${ev.idx}`} aria-label="Save new task date" className="rounded-lg p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-50 dark:text-green-300 dark:hover:bg-green-950/40">
                              {savingEventKey === `${active.id}:${ev.idx}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => setEditingEventKey(null)} aria-label="Cancel rescheduling" className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-gray-100 dark:hover:bg-slate-700"><X className="h-4 w-4" /></button>
                          </form>
                        ) : (
                          <>
                            <span className="mt-1 text-[0.68rem] font-semibold text-[var(--color-text-muted)]">{dayLabel(ev.date)}</span>
                            {!ev.done && <button type="button" onClick={() => { setEditingEventKey(`${active.id}:${ev.idx}`); setDateDraft(ev.date); }} aria-label={`Reschedule ${ev.title}`} title="Reschedule task" className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-950/40 dark:hover:text-green-300"><CalendarClock className="h-4 w-4" /></button>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
