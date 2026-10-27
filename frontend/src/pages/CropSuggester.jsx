// src/pages/CropSuggester.jsx — AI agent: soil + weather → best crops
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { getWeather } from '../api/weather';
import { runOrchestratedAgent } from '../api/orchestrator';
import OfflineCard from '../components/ui/OfflineCard';
import GovernmentAdvisoryLink from '../components/farm/GovernmentAdvisoryLink';
import {
  Sprout, Loader2, Sparkles, CheckCircle2, Trophy, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEFAULT_FORM = { N: '', P: '', K: '', temperature: '', humidity: '', ph: '', rainfall: '' };
const MODEL_INPUTS = [
  ['N', 'Nitrogen (N)', 'kg/ha'],
  ['P', 'Phosphorus (P)', 'kg/ha'],
  ['K', 'Potassium (K)', 'kg/ha'],
  ['temperature', 'Temperature', '°C'],
  ['humidity', 'Humidity', '%'],
  ['ph', 'Soil pH', ''],
  ['rainfall', 'Rainfall', 'mm'],
];

function farmWeatherQuery(farm) {
  if (farm?.village && farm?.district && farm?.state) return `${farm.village}, ${farm.district}, ${farm.state}`;
  if (farm?.village && farm?.state) return `${farm.village}, ${farm.state}`;
  if (farm?.district && farm?.state) return `${farm.district}, ${farm.state}`;
  const parts = String(farm?.location || '').split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[0]}, ${parts.at(-2)}`;
  if (parts.length === 2) return parts.join(', ');
  return parts[0] || '';
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

function initialInputSources(farm) {
  const sourceFor = field => farm?.[field] != null
    ? farm.soilSources?.[field] || 'farm_profile_source_unknown'
    : 'not_recorded';
  return {
    N: sourceFor('soilN'), P: sourceFor('soilP'), K: sourceFor('soilK'), ph: sourceFor('soilPH'),
    temperature: 'not_recorded', humidity: 'not_recorded', rainfall: 'not_recorded',
  };
}

async function requestRecommendations(form, farm, inputSources) {
  const input = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]));
  return runOrchestratedAgent('crop', input, { farmId: farm?.id || null, inputSources });
}

export default function CropSuggester() {
  const location = useLocation();
  const navigate = useNavigate();
  const incomingFarm = location.state?.farm || null;
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formSources, setFormSources] = useState(() => initialInputSources(incomingFarm));
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);
  const [farmContext, setFarmContext] = useState(incomingFarm);
  const [savingCrop, setSavingCrop] = useState('');
  const [sowingDate, setSowingDate] = useState(localDateValue);
  const [calendarAreaAcres, setCalendarAreaAcres] = useState(() => initialCalendarArea(incomingFarm));
  const [calendarStatus, setCalendarStatus] = useState({});
  const [farmWeather, setFarmWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherAttempt, setWeatherAttempt] = useState(0);

  useEffect(() => {
    setFarmContext(incomingFarm);
    setForm({
      ...DEFAULT_FORM,
      N: incomingFarm?.soilN ?? '',
      P: incomingFarm?.soilP ?? '',
      K: incomingFarm?.soilK ?? '',
      ph: incomingFarm?.soilPH ?? '',
    });
    setFormSources(initialInputSources(incomingFarm));
    setCalendarAreaAcres(initialCalendarArea(incomingFarm));
    setCalendarStatus({});
    setResult(null);
    setOffline(false);
  }, [incomingFarm]);

  useEffect(() => {
    let active = true;
    const locationName = farmWeatherQuery(incomingFarm);
    setFarmWeather(null);
    setWeatherError('');
    if (!locationName) return () => { active = false; };
    setWeatherLoading(true);
    getWeather({ location: locationName })
      .then(data => {
        if (!active) return;
        setFarmWeather(data);
        setForm(current => ({
          ...current,
          temperature: data.current.temperature,
          humidity: data.current.humidity,
        }));
        setFormSources(current => ({
          ...current,
          temperature: 'current_weather_service',
          humidity: 'current_weather_service',
        }));
      })
      .catch(error => {
        if (!active) return;
        setWeatherError(apiErrorMessage(error, `Weather could not be found for ${locationName}.`));
      })
      .finally(() => { if (active) setWeatherLoading(false); });
    return () => { active = false; };
  }, [incomingFarm, weatherAttempt]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setOffline(false);
    try {
      setResult(await requestRecommendations(form, farmContext, formSources));
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setResult(null); }
      else toast.error(apiErrorMessage(err, err.message || 'Crop agent request failed'));
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
        farmId: savedFarm.id,
        farmName: savedFarm.name,
      });
      setCalendarStatus(current => ({ ...current, [crop]: 'created' }));
      toast.success(`${crop} added and calendar created with ${data.plan.events.length} activities`);
    } catch (err) {
      if (savedFarm.crops?.some(item => item.toLowerCase() === crop.toLowerCase())) {
        setCalendarStatus(current => ({ ...current, [crop]: 'failed' }));
        const detail = apiErrorMessage(err, 'Check the sowing date and crop area, then retry.');
        toast.error(`${crop} is saved, but its calendar could not be created: ${detail}`);
      } else {
        toast.error(apiErrorMessage(err, 'Could not add crop to farm'));
      }
    } finally {
      setSavingCrop('');
    }
  };

  const cropValidation = result?.orchestration?.validation?.checks?.find(check => check.agent === 'crop');

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center"><Sprout className="w-5 h-5 text-green-600" /></span>
          {farmContext ? `Crop recommendations for ${farmContext.name}` : 'Crop Suggester Agent'}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">The trained classifier returns three crop options from soil and weather measurements. We’ll show which saved farm details the model does not use.</p>
      </div>

      {farmContext && <div className="card mb-5 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><h3 className="text-sm font-bold text-[var(--color-text)]">Farm context</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">Use this information to review the shortlist; these profile details are not inputs to the current crop model.</p></div>
          <button type="button" onClick={() => navigate('/farms')} className="text-xs font-semibold text-green-700">Review farm profile</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['Location', farmContext.location], ['Season', farmContext.season], ['Soil', farmContext.soilType],
            ['Water', [farmContext.waterSource, farmContext.waterAvailability].filter(Boolean).join(' · ')],
            ['Previous crop', farmContext.previousCrop],
          ].filter(([, value]) => value).map(([label, value]) => <span key={label} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)]"><b>{label}:</b> {value}</span>)}
        </div>
      </div>}

      {farmContext && <div className="mb-5">
        <GovernmentAdvisoryLink
          farm={farmContext}
          crop={result?.recommendations?.slice(0, 3).map(item => item.crop).join(', ')}
        />
      </div>}

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
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
            <p className="text-xs font-semibold text-sky-900 dark:text-sky-200">{weatherLoading ? 'Getting current weather for your farm…' : farmWeather ? `Weather loaded for ${farmWeather.current.location}` : farmContext ? 'Farm weather needs attention' : 'Enter your soil and weather readings'}</p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-sky-800/80 dark:text-sky-200/75">{farmWeather ? 'Temperature and humidity were filled from the weather service. Confirm them before requesting a prediction.' : weatherError || 'Saved soil-test values are prefilled when available. The model will not guess missing readings.'} Rainfall is required in millimetres. This project does not document the model’s rainfall reference period yet, so verify the rainfall value before relying on the result.</p>
            {weatherError && farmContext && <button type="button" onClick={() => setWeatherAttempt(value => value + 1)} disabled={weatherLoading} className="mt-2 text-xs font-bold text-sky-900 underline disabled:opacity-60 dark:text-sky-200">{weatherLoading ? 'Retrying…' : 'Retry farm weather'}</button>}
          </div>
          {farmWeather?.forecast?.length > 0 && <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-semibold text-blue-950 dark:text-blue-100">7-day forecast precipitation</p>
              <p className="text-sm font-extrabold text-blue-900 dark:text-blue-100">{farmWeather.forecast.reduce((total, day) => total + (Number(day.precipitationMm) || 0), 0).toFixed(1)} mm</p>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {farmWeather.forecast.map(day => <div key={`${day.day}-${day.date}`} className="rounded-lg bg-white/70 px-1.5 py-2 text-center dark:bg-slate-900/40">
                <p className="text-[0.62rem] font-semibold text-[var(--color-text-muted)]">{day.day.slice(0, 3)}</p>
                <p className="mt-0.5 text-xs font-bold text-[var(--color-text)]">{Number(day.precipitationMm || 0).toFixed(1)} mm</p>
                <p className="text-[0.6rem] text-[var(--color-text-muted)]">{day.rain}% chance</p>
              </div>)}
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-blue-900/80 dark:text-blue-100/75">Location-based forecast context from Open-Meteo. It is not substituted for the crop model’s rainfall input because the model’s rainfall period is undocumented.</p>
          </div>}
          {MODEL_INPUTS.map(([key, label, unit]) => (
            <div key={key}>
              <label htmlFor={`crop-${key}`} className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">{label}{unit ? ` (${unit})` : ''}</label>
              <input id={`crop-${key}`} type="number" required min={key === 'ph' ? 0 : undefined} max={key === 'ph' ? 14 : key === 'humidity' ? 100 : undefined} step="any" value={form[key]}
                onChange={event => {
                  setForm(current => ({ ...current, [key]: event.target.value }));
                  setFormSources(current => ({ ...current, [key]: 'farmer_entered' }));
                }} className="input text-sm" />
            </div>
          ))}
          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
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
              Enter all seven model inputs and press <b>Suggest Crops</b> to see the classifier’s top three predictions and scores.
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
                      {result.explanationSource === 'gemini' ? '✨ Gemini explanation' : 'Trained ML model'}
                    </span>
                  </div>
                  <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{result.explanation}</p>
                </div>
              </div>

              {cropValidation && <div className={`rounded-xl border p-3 ${cropValidation.status === 'passed'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100'}`}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-bold">Validation agent: {cropValidation.status === 'passed' ? 'basic checks passed' : 'needs review'}</p>
                </div>
                {cropValidation.checked?.length > 0 && <p className="mt-1 text-[0.68rem]">Checked: {cropValidation.checked.join(' · ')}.</p>}
                {cropValidation.issues?.length > 0 && <ul className="mt-1 list-disc pl-5 text-[0.68rem]">{cropValidation.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>}
                <p className="mt-1 text-[0.68rem]">{result.orchestration.validation.limitations?.[0] || 'These checks do not establish that a crop is suitable for this farm.'}</p>
              </div>}

              {result.contextReview && <div className="card p-4">
                <h4 className="text-sm font-bold text-[var(--color-text)]">What the crop model used</h4>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Check each value and its reported source before relying on this shortlist.</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {result.contextReview.modelInputs.map(item => <div key={item.field} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--color-text)]">{item.field}: {item.value ?? 'missing'}</p>
                    <p className="mt-0.5 text-[0.68rem] text-[var(--color-text-muted)]">Input: {item.source}{item.soilReadingSource ? ` · farm record: ${item.soilReadingSource}` : ''}</p>
                  </div>)}
                </div>
                <div className="mt-3 rounded-lg bg-[var(--color-bg)] p-3">
                  <p className="text-xs font-bold text-[var(--color-text)]">Farm context (not used to rank crops)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.contextReview.farmContext.filter(item => item.value).map(item => <span key={item.field} className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[0.68rem] text-[var(--color-text-muted)]"><b>{item.field}:</b> {item.value}</span>)}
                    {result.contextReview.farmContext.every(item => !item.value) && <span className="text-[0.68rem] text-[var(--color-text-muted)]">No farm context attached</span>}
                    {result.contextReview.soilTestDate && <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[0.68rem] text-[var(--color-text-muted)]"><b>Soil tested:</b> {result.contextReview.soilTestDate}</span>}
                  </div>
                </div>
              </div>}

              {result.recommendations.slice(0, 3).map((r, i) => (
                <div key={r.crop} className={`card p-4 fade-in ${i === 0 ? 'ring-2 ring-green-500/40' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {i === 0
                      ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"><Trophy className="h-4 w-4" /> #{r.rank || i + 1} Top model result</span>
                      : <span className="w-9 h-9 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-xs font-extrabold text-[var(--color-text-muted)]">#{r.rank || i + 1}</span>}
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--color-text)]">{r.crop}</h4>
                        {Number.isFinite(r.confidence) && <span className="badge badge-blue">{r.confidence}% classifier score</span>}
                      </div>
                    </div>
                  </div>
                  {farmContext && (() => {
                    const added = farmContext.crops?.some(crop => crop.toLowerCase() === r.crop.toLowerCase());
                    const status = calendarStatus[r.crop];
                    if (r.calendarSupported !== true) {
                      return <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                        {added ? `${r.crop} is already listed on this farm, but calendar creation is not supported for it yet.` : `Calendar creation is not supported for ${r.crop} yet, so this result cannot be added through this action.`}
                      </p>;
                    }
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                <b>How to use this shortlist:</b> the classifier uses only N, P, K, temperature, humidity, pH, and rainfall. Its scores are model outputs, not calibrated probabilities of crop success. Saved season, soil type, water access, previous crop, and local advisories do not affect the ranking; review those factors with local agricultural guidance before choosing. The model’s rainfall reference period is not documented in this project.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
