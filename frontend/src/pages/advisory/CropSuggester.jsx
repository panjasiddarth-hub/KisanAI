// src/pages/CropSuggester.jsx — AI agent: soil + weather → best crops
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, isOfflineError, apiErrorMessage } from '../../api/client';
import { FALLBACK_META } from '../../api/fallback';
import OfflineCard from '../../components/ui/OfflineCard';
import {
  Sprout, Loader2, Sparkles, CheckCircle2, AlertTriangle,
  Droplets, CalendarDays, Trophy, MapPin, ExternalLink,
} from 'lucide-react';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const WATER_BADGE = { low: 'badge-green', medium: 'badge-yellow', high: 'badge-red' };
const MODEL_FIELDS = [
  ['N', 'Nitrogen (N)'],
  ['P', 'Phosphorus (P)'],
  ['K', 'Potassium (K)'],
  ['ph', 'Soil pH'],
  ['temperature', 'Temperature (°C)'],
  ['humidity', 'Humidity (%)'],
  ['rainfall', 'Forecast rain (mm)'],
];
const SEASONS = ['kharif', 'rabi', 'zaid'];

function getMissingModelInputs(inputs, ph) {
  return MODEL_FIELDS
    .filter(([key]) => {
      const value = key === 'ph' ? ph : inputs[key];
      return value == null || value === '' || !Number.isFinite(Number(value));
    })
    .map(([, label]) => label);
}

function GovernmentResources({ state }) {
  const stateName = String(state || '').toLowerCase();
  const statePortal = stateName.includes('telangana')
    ? { name: 'Telangana Agriculture Department', url: 'https://agri.telangana.gov.in/' }
    : stateName.includes('maharashtra')
      ? { name: 'Maharashtra Agriculture Department', url: 'https://krishi.maharashtra.gov.in/' }
      : { name: 'Agriculture & Farmers Welfare Department', url: 'https://agriwelfare.gov.in/' };
  const resources = [
    { name: 'PM Fasal Bima Yojana', url: 'https://pmfby.gov.in/', detail: 'Check crop insurance enrollment and current deadlines.' },
    { name: 'PM-KISAN', url: 'https://pmkisan.gov.in/', detail: 'Check current registration and eligibility information.' },
    { name: 'Soil Health Card', url: 'https://soilhealth.dac.gov.in/', detail: 'Find soil testing and soil-health information.' },
    { name: statePortal.name, url: statePortal.url, detail: 'Check state agriculture notices and services.' },
  ];

  return (
    <section className="card p-4">
      <h4 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" /> Government resources to check</h4>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">These are official starting points, not confirmation that you qualify for a scheme. Rules, enrollment dates, and benefits can change; confirm them with the department.</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        {resources.map(resource => (
          <a key={resource.name} href={resource.url} target="_blank" rel="noreferrer"
            className="rounded-lg border border-[var(--color-border)] p-3 hover:border-green-500">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400 inline-flex items-center gap-1">{resource.name}<ExternalLink className="w-3 h-3" /></span>
            <span className="block text-[0.68rem] text-[var(--color-text-muted)] mt-1">{resource.detail}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function CropSuggester() {
  const [searchParams] = useSearchParams();
  const farmId = searchParams.get('farmId');
  const shouldAutoStart = searchParams.get('autostart') === '1';
  const [meta, setMeta] = useState(FALLBACK_META);
  const [form, setForm] = useState({ soilType: 'black', ph: 6.8, season: 'kharif', irrigation: 'irrigated' });
  const [modelInputs, setModelInputs] = useState({
    N: '', P: '', K: '', temperature: '', humidity: '', rainfall: '',
  });
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);
  const [farm, setFarm] = useState(null);
  const [farmReady, setFarmReady] = useState(!farmId);
  const [farmError, setFarmError] = useState('');
  const [weatherError, setWeatherError] = useState('');
  const [missingInputs, setMissingInputs] = useState([]);
  const [requestError, setRequestError] = useState('');
  const autoStarted = useRef(false);

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {/* offline — fallback meta already set */});
  }, []);

  useEffect(() => {
    if (!farmId) {
      autoStarted.current = false;
      setFarm(null);
      setFarmReady(true);
      setFarmError('');
      setWeatherError('');
      setModelInputs({ N: '', P: '', K: '', temperature: '', humidity: '', rainfall: '' });
      setForm({ soilType: 'black', ph: 6.8, season: 'kharif', irrigation: 'irrigated' });
      setMissingInputs([]);
      setRequestError('');
      setOffline(false);
      setResult(null);
      return undefined;
    }
    let active = true;
    autoStarted.current = false;
    setFarmReady(false);
    setFarmError('');
    setWeatherError('');
    setRequestError('');
    setOffline(false);
    setResult(null);
    api.get(`/farms/${encodeURIComponent(farmId)}`).then(async ({ data }) => {
      if (!active) return;
      const profile = data.profile || {};
      const soil = profile.soil || {};
      const soilTest = data.soilTest || profile.soilTest || {};
      const water = profile.water || {};
      const knownSoilTypes = new Set(['black', 'red', 'alluvial', 'loamy', 'sandy', 'clay', 'laterite']);
      const normalizedSoil = String((data.soilType && data.soilType !== 'unknown' ? data.soilType : soil.soilType) || '').toLowerCase()
        .replace('black cotton', 'black')
        .replace('red laterite', 'laterite')
        .replace('clayey', 'clay');
      const availability = String(water.availability || '').toLowerCase();
      const irrigation = ['reliable', 'available', 'irrigated', 'both'].includes(availability)
        ? 'irrigated'
        : ['limited', 'seasonal', 'rainfed', 'none'].includes(availability)
          ? 'rainfed'
          : '';
      const season = SEASONS.includes(profile.preferences?.season) ? profile.preferences.season : '';
      setFarm(data);
      setForm(current => ({
        ...current,
        soilType: knownSoilTypes.has(normalizedSoil) ? normalizedSoil : '',
        ph: soilTest.ph ?? soil.ph ?? '',
        season,
        irrigation,
      }));
      setModelInputs(current => ({
        ...current,
        N: soilTest.N ?? soil.nitrogen ?? '',
        P: soilTest.P ?? soil.phosphorus ?? '',
        K: soilTest.K ?? soil.potassium ?? '',
      }));

      const coordinates = data.coordinates || profile.basic?.coordinates;
      const lat = Number(coordinates?.lat);
      const lon = Number(coordinates?.lon);
      if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180) {
        try {
          const weatherResponse = await api.get('/weather', {
            params: { lat, lon, location: coordinates?.label || data.location },
          });
          if (!active) return;
          const current = weatherResponse.data.current || {};
          const today = weatherResponse.data.forecast?.[0] || {};
          setModelInputs(values => ({
            ...values,
            temperature: current.temperature ?? '',
            humidity: current.humidity ?? '',
            rainfall: today.rainfallMm ?? '',
          }));
          if (today.rainfallMm == null) setWeatherError('A local rainfall forecast is not available. Enter the forecast rain value if you have it.');
        } catch {
          if (active) setWeatherError('Local weather could not be loaded. Enter the weather values if you know them, or try again later.');
        }
      } else {
        setWeatherError('This farm has no usable map location, so local weather could not be loaded.');
      }
      if (active) setFarmReady(true);
    }).catch(error => {
      if (!active) return;
      setFarmError(error?.response?.data?.error || 'Could not load this farm profile.');
      setFarmReady(true);
    });
    return () => { active = false; };
  }, [farmId]);

  const runPrediction = useCallback(async (event) => {
    event?.preventDefault();
    setBusy(true);
    setOffline(false);
    setRequestError('');
    setMissingInputs([]);
    const missing = farmId ? getMissingModelInputs(modelInputs, form.ph) : [];
    if (missing.length) {
      setMissingInputs(missing);
      setResult(null);
      setBusy(false);
      return;
    }
    try {
      const payload = {
        ...form,
        ...(getMissingModelInputs(modelInputs, form.ph).length === 0
          ? Object.fromEntries(Object.entries(modelInputs).map(([key, value]) => [key, Number(value)]))
          : {}),
        ...(form.ph !== '' && form.ph != null ? { ph: Number(form.ph) } : {}),
      };
      console.log('Crop inputs submitted:', payload);
      const { data } = await api.post('/agents/crop', payload);
      console.log('Crop recommendations received:', data);
      if (!Array.isArray(data.recommendations) || !data.recommendations.length) {
        setResult(null);
        setRequestError('The crop service did not return crop recommendations. Please try again.');
      } else {
        setResult({ ...data, recommendations: data.recommendations.slice(0, 3) });
      }
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setResult(null); }
      else {
        setResult(null);
        setRequestError(apiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }, [farmId, form, modelInputs]);

  useEffect(() => {
    if (farmId && farm?.id === farmId && shouldAutoStart && farmReady && !farmError && !autoStarted.current) {
      autoStarted.current = true;
      runPrediction();
    }
  }, [farmId, farm, shouldAutoStart, farmReady, farmError, runPrediction]);

  const updateModelInput = (key, value) => {
    const next = { ...modelInputs, [key]: value };
    setModelInputs(next);
    if (missingInputs.length) setMissingInputs(getMissingModelInputs(next, form.ph));
  };
  const locationParts = String(farm?.coordinates?.label || farm?.location || '').split(',').map(part => part.trim()).filter(Boolean);
  const detectedState = farm?.profile?.basic?.state
    || (locationParts.at(-1)?.toLowerCase() === 'india' ? locationParts.at(-2) : locationParts.at(-1))
    || '';

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center"><Sprout className="w-5 h-5 text-green-600" /></span>
          Crop Suggester Agent
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">For saved farms, uses soil-test readings and local weather. Manual crop suggestions still work; missing report values are never guessed.</p>
      </div>

      {farmId && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm">
          {farmError
            ? <p className="text-red-700 dark:text-red-400">{farmError}</p>
            : <p className="text-green-800 dark:text-green-300">{farmReady ? `Using saved farm: ${farm?.name || 'Farm'}` : 'Loading your saved farm and local weather…'}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5 items-start">
        <form onSubmit={runPrediction} className="card p-5 space-y-4">
          {farmId && (
            <>
              <div className="rounded-lg bg-[var(--color-bg)] p-3">
                <p className="text-xs font-semibold text-[var(--color-text)]">Soil test and local weather inputs</p>
                <p className="text-[0.68rem] text-[var(--color-text-muted)] mt-1">Values from your report and farm forecast are filled in. Please check them; add any missing values to run the model.</p>
              </div>
              {weatherError && <p className="text-xs text-amber-700 dark:text-amber-400">{weatherError}</p>}
              <div className="grid grid-cols-2 gap-2">
                {MODEL_FIELDS.map(([key, label]) => (
                  <label className="text-[0.68rem] font-semibold text-[var(--color-text-muted)]" key={key}>
                    {label}
                    <input type="number"
                      min={['N', 'P', 'K', 'ph', 'humidity', 'rainfall'].includes(key) ? 0 : undefined}
                      max={key === 'ph' ? 14 : key === 'humidity' ? 100 : undefined}
                      step="any" value={key === 'ph' ? form.ph : modelInputs[key]}
                      onChange={event => key === 'ph'
                        ? (() => {
                          const ph = event.target.value;
                          setForm(current => ({ ...current, ph }));
                          if (missingInputs.length) setMissingInputs(getMissingModelInputs(modelInputs, ph));
                        })()
                        : updateModelInput(key, event.target.value)}
                      className="input !py-2 text-sm mt-1" aria-label={label} />
                  </label>
                ))}
              </div>
              {missingInputs.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400" role="alert">Please add these values from your report or local forecast: {missingInputs.join(', ')}.</p>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil Type</label>
            <select value={form.soilType} onChange={e => setForm(f => ({ ...f, soilType: e.target.value }))} className="input text-sm">
              {farmId && <option value="">Not in report / choose soil type</option>}
              {meta.soilTypes.map(s => <option key={s} value={s}>{cap(s)} soil</option>)}
            </select>
          </div>
          {!farmId && (
            <div>
              <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil pH — <span className="text-green-600">{form.ph}</span></label>
              <input type="range" min="4.5" max="9" step="0.1" value={form.ph}
                onChange={e => setForm(f => ({ ...f, ph: e.target.value }))} className="w-full accent-green-600" />
              <div className="flex justify-between text-[0.65rem] text-[var(--color-text-muted)]"><span>Acidic (4.5)</span><span>Neutral (7)</span><span>Alkaline (9)</span></div>
            </div>
          )}
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
          <button type="submit" disabled={busy || Boolean(farmError) || Boolean(farmId && !farmReady)} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Analyzing your field…' : 'Suggest Crops'}
          </button>
        </form>

        <div className="space-y-4">
          {offline && <OfflineCard onRetry={() => runPrediction()} />}
          {requestError && <div className="card p-4 text-sm text-red-700 dark:text-red-400" role="alert">{requestError}</div>}
          {!offline && !result && !requestError && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <Sprout className="w-10 h-10 mx-auto mb-3 text-green-300" />
              Fill in your field details and press <b>Suggest Crops</b> — the model will show up to three top crops.
            </div>
          )}
          {result && (
            <>
              <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#15803d] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[var(--color-text)]">Top crop suggestions</h4>
                    <span className={`badge ${result.explanationSource === 'gemini' ? 'badge-purple' : 'badge-blue'}`}>
                      {result.explanationSource === 'gemini'
                        ? '✨ Gemini AI'
                        : result.modelSource === 'rule_engine_fallback' ? 'Rule Engine' : 'Crop model'}
                    </span>
                  </div>
                  <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{result.explanation}</p>
                  <p className="text-[0.68rem] text-[var(--color-text-muted)] mt-2">These suggestions are not a guarantee of yield or profit. Confirm crop choice with local agricultural advice.</p>
                </div>
              </div>

              {result.recommendations.map((r, i) => {
                const rawScore = Number(r.score);
                const displayScore = rawScore >= 0 && rawScore <= 1 ? rawScore * 100 : rawScore;
                return (
                <div key={r.crop} className={`card p-4 fade-in ${i === 0 ? 'ring-2 ring-green-500/40' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {i === 0
                      ? <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center"><Trophy className="w-4.5 h-4.5 text-amber-500" style={{ width: 18, height: 18 }} /></span>
                      : <span className="w-9 h-9 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-xs font-extrabold text-[var(--color-text-muted)]">#{i + 1}</span>}
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--color-text)]">{r.crop}</h4>
                        {r.waterNeed && <span className={`badge ${WATER_BADGE[r.waterNeed] || 'badge-blue'}`}><Droplets className="w-3 h-3" /> {r.waterNeed} water</span>}
                        {Array.isArray(r.durationDays) && <span className="badge badge-blue"><CalendarDays className="w-3 h-3" /> {r.durationDays[0]}–{r.durationDays[1]} days</span>}
                      </div>
                      {Number.isFinite(rawScore) && (
                        <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden max-w-xs">
                          <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: `${Math.max(0, Math.min(100, displayScore))}%` }} />
                        </div>
                      )}
                    </div>
                    {Number.isFinite(rawScore) && <span className="text-right"><span className="block text-xl font-extrabold text-green-600">{displayScore.toFixed(1)}%</span><span className="block text-[0.62rem] text-[var(--color-text-muted)]">{result.modelSource === 'rule_engine_fallback' ? 'suitability score' : 'model score'}</span></span>}
                  </div>
                  {r.reasons?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.reasons.map((reason, j) => {
                        const good = !/not ideal|outside|risky|avoid/i.test(reason);
                        return (
                          <span key={j} className={`inline-flex items-center gap-1 text-[0.68rem] font-medium px-2 py-1 rounded-lg ${good ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                            {good ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {reason}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {r.hint && <p className="text-[0.72rem] text-[var(--color-text-muted)] italic mt-2">💡 {r.hint}</p>}
                </div>
                );
              })}
              {farmId && <GovernmentResources state={detectedState} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
