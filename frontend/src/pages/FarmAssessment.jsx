import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FlaskConical, Loader2, MapPin, Sprout } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { apiErrorMessage } from '../api/client';
import { getWeather } from '../api/weather';
import { runFarmAssessment } from '../api/farmAssessment';
import { useFarms } from '../hooks/useFarms';

const EMPTY_ENVIRONMENT = { temperature: '', humidity: '', rainfall: '' };
const WEATHER_LOCATION = (farm) => {
  if (farm?.village && farm?.district && farm?.state) return `${farm.village}, ${farm.district}, ${farm.state}`;
  if (farm?.village && farm?.state) return `${farm.village}, ${farm.state}`;
  if (farm?.district && farm?.state) return `${farm.district}, ${farm.state}`;
  return farm?.location || '';
};

function StatusBadge({ status }) {
  const labels = {
    completed: 'Completed',
    needs_input: 'More information needed',
    needs_review: 'Needs review',
    failed: 'Could not run',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>{labels[status] || status}</span>;
}

function AgentResult({ agent, item }) {
  const crop = agent === 'crop';
  const title = crop ? 'Crop model' : 'Soil nutrient model';
  const Icon = crop ? Sprout : FlaskConical;
  return (
    <section className="card p-5" aria-label={title}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Icon className="h-5 w-5" /></span>
        <h3 className="mr-auto font-bold">{title}</h3>
        <StatusBadge status={item.status} />
      </div>
      {item.status === 'completed' && crop && <>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Top model option</p>
        <p className="text-xl font-extrabold capitalize">{item.result.prediction}</p>
        <ol className="mt-3 space-y-2">
          {item.result.recommendations?.map((option) => <li key={option.rank} className="flex justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"><span>{option.rank}. {option.crop}</span><span className="text-[var(--color-text-muted)]">{option.confidence}% model score</span></li>)}
        </ol>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">These are classifier scores, not probabilities of harvest success. The crop model’s training geography and rainfall reference period are undocumented; review locally before planting.</p>
      </>}
      {item.status === 'completed' && !crop && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(item.result.ratings || {}).map(([nutrient, rating]) => <div key={nutrient} className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-xs text-[var(--color-text-muted)]">{nutrient}</p><p className="font-bold">{rating}</p></div>)}
        <p className="col-span-full rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Nutrient ratings are not fertilizer product or dose recommendations.</p>
      </div>}
      {item.explanation?.statement && <p className="mt-3 text-sm text-[var(--color-text-muted)]">{item.explanation.statement}</p>}
      {item.explanation?.contextReview?.modelInputs && <details className="mt-3 text-xs text-[var(--color-text-muted)]"><summary className="cursor-pointer font-semibold">Review model inputs and their sources</summary><ul className="mt-2 space-y-1">{item.explanation.contextReview.modelInputs.map((input) => <li key={input.field}><b>{input.field}:</b> {input.value ?? 'missing'} · {input.source}</li>)}</ul></details>}
      {item.explanation?.inputs?.length > 0 && <details className="mt-3 text-xs text-[var(--color-text-muted)]"><summary className="cursor-pointer font-semibold">Review soil model inputs and their sources</summary><ul className="mt-2 space-y-1">{item.explanation.inputs.map((input) => <li key={input.field}><b>{input.field}:</b> {input.value} · {input.source}</li>)}</ul><p className="mt-2">These are the values submitted to the model; they do not explain which reading caused an individual rating.</p></details>}
      {item.status === 'needs_input' && <>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{item.message}</p>
        <ul className="mt-2 list-inside list-disc text-sm">{item.missingInputs?.map((field) => <li key={field}>{field}</li>)}</ul>
      </>}
      {(item.status === 'failed' || item.status === 'needs_review') && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{item.error || item.issues?.join('; ')}</p>}
    </section>
  );
}

export default function FarmAssessment() {
  const location = useLocation();
  const initialFarm = location.state?.farm || null;
  const { farms, loading: farmsLoading } = useFarms();
  const [farmId, setFarmId] = useState(initialFarm?.id || '');
  const farm = useMemo(() => farms.find((item) => item.id === farmId) || (initialFarm?.id === farmId ? initialFarm : null), [farms, farmId, initialFarm]);
  const [environment, setEnvironment] = useState(EMPTY_ENVIRONMENT);
  const [environmentSources, setEnvironmentSources] = useState({});
  const [weatherMessage, setWeatherMessage] = useState('');
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    if (!farm && farms.length === 1) setFarmId(farms[0].id);
  }, [farm, farms]);

  useEffect(() => {
    let active = true;
    setEnvironment(EMPTY_ENVIRONMENT);
    setEnvironmentSources({});
    setWeatherMessage('');
    setAssessment(null);
    if (!farm) return () => { active = false; };
    const locationName = WEATHER_LOCATION(farm);
    setWeatherBusy(true);
    getWeather({ location: locationName })
      .then((weather) => {
        if (!active) return;
        setEnvironment((current) => ({ ...current, temperature: weather.current.temperature, humidity: weather.current.humidity }));
        setEnvironmentSources((current) => ({ ...current, temperature: 'current_weather_service', humidity: 'current_weather_service' }));
        setWeatherMessage(`Current temperature and humidity loaded for ${weather.current.location}. Review these values before running the models.`);
      })
      .catch((weatherError) => {
        if (active) setWeatherMessage(apiErrorMessage(weatherError, 'Could not load current weather. You can enter temperature and humidity yourself.'));
      })
      .finally(() => { if (active) setWeatherBusy(false); });
    return () => { active = false; };
  }, [farm]);

  const updateEnvironment = (field, value) => {
    setEnvironment((current) => ({ ...current, [field]: value }));
    setEnvironmentSources((current) => ({ ...current, [field]: 'farmer_entered' }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!farm) return;
    setRunning(true);
    setError('');
    setAssessment(null);
    try {
      const result = await runFarmAssessment(farm.id, {
        agents: ['crop', 'fertilizer'],
        environment: {
          temperature: environment.temperature === '' ? undefined : Number(environment.temperature),
          humidity: environment.humidity === '' ? undefined : Number(environment.humidity),
          rainfall: environment.rainfall === '' ? undefined : Number(environment.rainfall),
          inputSources: environmentSources,
        },
      });
      setAssessment(result);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Could not run the farm assessment. Check that the backend and ML service are running.'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page-content mx-auto max-w-5xl space-y-5">
      <PageHeader title="Farm assessment" subtitle="Start with a saved farm. KisanAI fills model inputs from reviewed soil data and current weather, then validates each model result." />
      <section className="card p-5">
        <label htmlFor="assessment-farm" className="mb-2 block text-sm font-semibold">Saved farm</label>
        <select id="assessment-farm" value={farmId} onChange={(event) => { setFarmId(event.target.value); setAssessment(null); }} disabled={farmsLoading} className="input">
          <option value="">Choose a farm</option>
          {farms.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.location}</option>)}
          {initialFarm && !farms.some((item) => item.id === initialFarm.id) && <option value={initialFarm.id}>{initialFarm.name} · {initialFarm.location}</option>}
        </select>
        {farm && <div className="mt-3 space-y-1 text-sm text-[var(--color-text-muted)]"><p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{farm.location}{farm.area ? ` · ${farm.area} ${farm.areaUnit || 'acres'}` : ''}</p><p>Soil: {farm.soilType || 'not recorded'} · Season: {farm.season || 'not recorded'} · Crop: {farm.crops?.[0] || farm.previousCrop || 'not recorded'}</p><p>Water: {farm.waterSource || 'not recorded'} · Soil test: {farm.soilTestDate || 'date not recorded'}</p></div>}
      </section>

      {farm && <form onSubmit={submit} className="card space-y-4 p-5">
        <div><h3 className="font-bold">Weather inputs for crop model</h3><p className="mt-1 text-xs text-[var(--color-text-muted)]">Current temperature and humidity are prefilled when the weather service finds your farm. Confirm or edit them. Rainfall is required; the model’s rainfall reference period is undocumented, so use a verified value and review the result locally.</p></div>
        {weatherBusy && <p className="text-xs text-sky-700">Loading current farm weather…</p>}
        {weatherMessage && <p className="text-xs text-[var(--color-text-muted)]">{weatherMessage}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['temperature', 'Temperature', '°C'],
            ['humidity', 'Humidity', '%'],
            ['rainfall', 'Rainfall', 'mm'],
          ].map(([field, label, unit]) => <div key={field}>
            <label htmlFor={`assessment-${field}`} className="mb-1.5 block text-xs font-semibold">{label} ({unit})</label>
            <input id={`assessment-${field}`} type="number" required min={field === 'temperature' ? -50 : 0} max={field === 'humidity' ? 100 : field === 'temperature' ? 70 : undefined} step="any" value={environment[field]} onChange={(event) => updateEnvironment(field, event.target.value)} className="input" />
            <p className="mt-1 text-[0.65rem] text-[var(--color-text-muted)]">Source: {environmentSources[field] === 'current_weather_service' ? 'weather service (review before use)' : environment[field] === '' ? 'needed' : 'farmer entered'}</p>
          </div>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={running || !farmId} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}{running ? 'Running and validating…' : 'Run farm assessment'}</button>
          <span className="text-xs text-[var(--color-text-muted)]">Runs crop and soil nutrient models. Missing soil report values are reported, never estimated.</span>
        </div>
      </form>}

      {!farm && !farmsLoading && <div className="card p-5 text-sm text-[var(--color-text-muted)]">Select a saved farm to begin. If you have no farm yet, add one first in My Farms.</div>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</p>}
      {assessment && <div className="space-y-4">
        <section className="card p-4">
          <div className="flex flex-wrap items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-bold">Assessment for {assessment.farm?.name}</h3><span className="ml-auto text-xs font-semibold capitalize">{assessment.orchestration?.workflowStatus?.replace('_', ' ')}</span></div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Validation status: {assessment.orchestration?.validation?.status}. These checks catch missing or inconsistent data; they do not prove agronomic correctness.</p>
          <details className="mt-3 text-xs text-[var(--color-text-muted)]"><summary className="cursor-pointer font-semibold">Review validation checks</summary><ul className="mt-2 space-y-2">{assessment.orchestration?.validation?.checks?.map((check) => <li key={`${check.agent}-${check.status}`}><b className="capitalize">{check.agent}:</b> {check.status}{check.issues?.length ? ` — ${check.issues.join('; ')}` : ''}{check.message ? ` — ${check.message}` : ''}</li>)}</ul></details>
        </section>
        {Object.entries(assessment.agents || {}).map(([agent, item]) => <AgentResult key={agent} agent={agent} item={item} />)}
        <p className="text-xs text-[var(--color-text-muted)]">Market forecast is not included in this farm run because the profile does not contain verified recent mandi price history. Disease photo screening runs separately and does not use the farm profile as an image diagnosis.</p>
      </div>}
    </div>
  );
}
