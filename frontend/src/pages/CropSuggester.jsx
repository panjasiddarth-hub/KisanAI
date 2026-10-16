// src/pages/CropSuggester.jsx — AI agent: soil + weather → best crops
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { FALLBACK_META } from '../api/fallback';
import OfflineCard from '../components/ui/OfflineCard';
import {
  Sprout, Loader2, Sparkles, CheckCircle2, AlertTriangle,
  Droplets, CalendarDays, Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const WATER_BADGE = { low: 'badge-green', medium: 'badge-yellow', high: 'badge-red' };
const DEFAULT_FORM = { soilType: 'black', ph: 6.8, season: 'kharif', irrigation: 'irrigated' };

function mapSoilType(value = '') {
  const soil = value.toLowerCase();
  if (soil.includes('black')) return 'black';
  if (soil.includes('red')) return 'red';
  if (soil.includes('laterite')) return 'laterite';
  if (soil.includes('alluvial')) return 'alluvial';
  if (soil.includes('sandy')) return 'sandy';
  if (soil.includes('clay')) return 'clay';
  if (soil.includes('loam')) return 'loamy';
  return '';
}

function formFromFarm(farm) {
  if (!farm) return DEFAULT_FORM;
  const waterDetails = [farm.waterSource, farm.waterAvailability, ...(farm.irrigationMethods || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const season = ['kharif', 'rabi', 'zaid'].includes(farm.season?.toLowerCase())
    ? farm.season.toLowerCase()
    : DEFAULT_FORM.season;

  return {
    soilType: mapSoilType(farm.soilType),
    ph: farm.soilPH ?? DEFAULT_FORM.ph,
    season,
    irrigation: /rain.?fed|limited|unreliable/.test(waterDetails) ? 'rainfed' : 'irrigated',
  };
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initialCalendarArea(farm) {
  const area = Number(farm?.area);
  if (!Number.isFinite(area) || area <= 0) return '';
  if (farm.areaUnit === 'hectares') return (area * 2.47105).toFixed(2);
  if (farm.areaUnit === 'acres') return String(area);
  return '';
}

async function requestRecommendations(form) {
  const { data } = await api.post('/agents/crop', { ...form, ph: Number(form.ph) });
  return data;
}

export default function CropSuggester() {
  const location = useLocation();
  const incomingFarm = location.state?.farm || null;
  const [meta, setMeta] = useState(FALLBACK_META);
  const [form, setForm] = useState(() => formFromFarm(incomingFarm));
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);
  const [farmContext, setFarmContext] = useState(incomingFarm);
  const [savingCrop, setSavingCrop] = useState('');
  const [sowingDate, setSowingDate] = useState(localDateValue);
  const [calendarAreaAcres, setCalendarAreaAcres] = useState(() => initialCalendarArea(incomingFarm));
  const [calendarStatus, setCalendarStatus] = useState({});

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {/* offline — fallback meta already set */});
  }, []);

  useEffect(() => {
    const farmForm = formFromFarm(incomingFarm);
    setFarmContext(incomingFarm);
    setCalendarAreaAcres(initialCalendarArea(incomingFarm));
    setCalendarStatus({});
    setForm(farmForm);
    setResult(null);
    setOffline(false);
    if (!incomingFarm || !farmForm.soilType) return;

    let active = true;
    setBusy(true);
    requestRecommendations(farmForm)
      .then(data => { if (active) setResult(data); })
      .catch(err => {
        if (!active) return;
        if (isOfflineError(err)) setOffline(true);
        else toast.error(apiErrorMessage(err));
      })
      .finally(() => { if (active) setBusy(false); });

    return () => { active = false; };
  }, [incomingFarm]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setOffline(false);
    try {
      setResult(await requestRecommendations(form));
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setResult(null); }
      else toast.error(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  const addCropToFarm = async (crop) => {
    if (!farmContext) return;
    const areaAcres = Number(calendarAreaAcres);
    if (!sowingDate) {
      toast.error('Choose a sowing date to generate the calendar');
      return;
    }
    if (!Number.isFinite(areaAcres) || areaAcres <= 0) {
      toast.error('Enter the crop area in acres for the calendar');
      return;
    }

    setSavingCrop(crop);
    let savedFarm = farmContext;
    try {
      const alreadyAdded = farmContext.crops?.some(item => item.toLowerCase() === crop.toLowerCase());
      if (!alreadyAdded) {
        const crops = [...new Set([...(farmContext.crops || []), crop])];
        const { data } = await api.patch(`/farms/${farmContext.id}`, { crops });
        savedFarm = data;
        setFarmContext(data);
      }

      const { data } = await api.post('/calendar/generate', {
        crop,
        sowingDate,
        areaAcres,
        farmName: savedFarm.name,
      });
      setCalendarStatus(current => ({ ...current, [crop]: 'created' }));
      toast.success(`${crop} added and calendar created with ${data.plan.events.length} activities`);
    } catch (err) {
      if (savedFarm.crops?.some(item => item.toLowerCase() === crop.toLowerCase())) {
        setCalendarStatus(current => ({ ...current, [crop]: 'failed' }));
        toast.error(`${crop} is saved, but its calendar could not be created. Retry from this crop.`);
      } else {
        toast.error(apiErrorMessage(err, 'Could not add crop to farm'));
      }
    } finally {
      setSavingCrop('');
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center"><Sprout className="w-5 h-5 text-green-600" /></span>
          {farmContext ? `Crop recommendations for ${farmContext.name}` : 'Crop Suggester Agent'}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Recommends the best crops for your soil type, pH, season and water availability.</p>
      </div>

      {farmContext && <div className="card mb-5 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="crop-sowing-date" className="mb-1.5 block text-xs font-semibold text-[var(--color-text)]">Sowing date for calendar</label>
          <input id="crop-sowing-date" type="date" value={sowingDate} onChange={event => setSowingDate(event.target.value)} className="input text-sm" />
        </div>
        <div>
          <label htmlFor="crop-calendar-area" className="mb-1.5 block text-xs font-semibold text-[var(--color-text)]">Area for this crop (acres)</label>
          <input id="crop-calendar-area" type="number" min="0.1" step="0.1" value={calendarAreaAcres} onChange={event => setCalendarAreaAcres(event.target.value)} placeholder="Enter acres" className="input text-sm" />
          <p className="mt-1 text-[0.68rem] text-[var(--color-text-muted)]">Set the area being planted. Bigha varies by region, so enter its acre equivalent.</p>
        </div>
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5 items-start">
        {/* Input form */}
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil Type</label>
            <select value={form.soilType} onChange={e => setForm(f => ({ ...f, soilType: e.target.value }))} className="input text-sm">
              {!form.soilType && <option value="">Select soil type</option>}
              {meta.soilTypes.map(s => <option key={s} value={s}>{cap(s)} soil</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil pH — <span className="text-green-600">{form.ph}</span></label>
            <input type="range" min="4.5" max="9" step="0.1" value={form.ph}
              onChange={e => setForm(f => ({ ...f, ph: e.target.value }))} className="w-full accent-green-600" />
            <div className="flex justify-between text-[0.65rem] text-[var(--color-text-muted)]"><span>Acidic (4.5)</span><span>Neutral (7)</span><span>Alkaline (9)</span></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Season</label>
            <div className="grid grid-cols-3 gap-2">
              {meta.seasons.map(s => (
                <button type="button" key={s} onClick={() => setForm(f => ({ ...f, season: s }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${form.season === s ? 'bg-[#15803d] text-white border-[#15803d]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-400'}`}>
                  {cap(s)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Water Availability</label>
            <div className="grid grid-cols-2 gap-2">
              {meta.irrigationModes.map(m => (
                <button type="button" key={m} onClick={() => setForm(f => ({ ...f, irrigation: m }))}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${form.irrigation === m ? 'bg-[#15803d] text-white border-[#15803d]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-400'}`}>
                  {m === 'irrigated' ? '💧 Irrigated' : '🌦️ Rainfed'}
                </button>
              ))}
            </div>
          </div>
          {farmContext && !form.soilType && <p className="text-xs text-amber-700">Select the soil type to get accurate recommendations.</p>}
          <button type="submit" disabled={busy || !form.soilType} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Analyzing your field…' : 'Suggest Crops'}
          </button>
        </form>

        {/* Results */}
        <div className="space-y-4">
          {offline && <OfflineCard onRetry={submit} />}
          {!offline && !result && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <Sprout className="w-10 h-10 mx-auto mb-3 text-green-300" />
              Fill in your field details and press <b>Suggest Crops</b> — the agent will show the top 3 crops with reasons.
            </div>
          )}
          {result && (
            <>
              <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#15803d] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[var(--color-text)]">Agent's Analysis</h4>
                    <span className={`badge ${result.explanationSource === 'gemini' ? 'badge-purple' : 'badge-blue'}`}>
                      {result.explanationSource === 'gemini' ? '✨ Gemini AI' : 'Rule Engine'}
                    </span>
                  </div>
                  <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{result.explanation}</p>
                </div>
              </div>

              {result.recommendations.slice(0, 3).map((r, i) => (
                <div key={r.crop} className={`card p-4 fade-in ${i === 0 ? 'ring-2 ring-green-500/40' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {i === 0
                      ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Trophy className="h-4 w-4" /> #{r.rank || i + 1} Best match</span>
                      : <span className="w-9 h-9 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-xs font-extrabold text-[var(--color-text-muted)]">#{r.rank || i + 1}</span>}
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--color-text)]">{r.crop}</h4>
                        {r.waterNeed && <span className={`badge ${WATER_BADGE[r.waterNeed]}`}><Droplets className="w-3 h-3" /> {r.waterNeed} water</span>}
                        {r.durationDays?.length > 1 && <span className="badge badge-blue"><CalendarDays className="w-3 h-3" /> {r.durationDays[0]}–{r.durationDays[1]} days</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(r.reasons || []).map((reason, j) => {
                      const good = !/not ideal|outside|risky|avoid/i.test(reason);
                      return (
                        <span key={j} className={`inline-flex items-center gap-1 text-[0.68rem] font-medium px-2 py-1 rounded-lg ${good ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                          {good ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {reason}
                        </span>
                      );
                    })}
                  </div>
                  {r.hint && <p className="text-[0.72rem] text-[var(--color-text-muted)] italic mt-2">💡 {r.hint}</p>}
                  {farmContext && (() => {
                    const added = farmContext.crops?.some(crop => crop.toLowerCase() === r.crop.toLowerCase());
                    const status = calendarStatus[r.crop];
                    if (status === 'created') {
                      return <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-green-700"><CheckCircle2 className="h-4 w-4" /> Calendar created</span>;
                    }
                    return (
                      <button
                        type="button"
                        disabled={savingCrop === r.crop}
                        onClick={() => addCropToFarm(r.crop)}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-700 px-3 py-2 text-xs font-semibold text-green-800 disabled:opacity-60"
                      >
                        {savingCrop === r.crop
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <CheckCircle2 className="h-4 w-4" />}
                        {status === 'failed'
                          ? 'Retry calendar'
                          : added ? 'Generate calendar' : 'Add crop & generate calendar'}
                      </button>
                    );
                  })()}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
