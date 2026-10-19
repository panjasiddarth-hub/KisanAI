// src/components/farms/FarmRecommendations.jsx
// Farm-specific crop recommendations: shows the backend's saved result exactly as returned —
// real model probabilities (or a clearly labelled rule-engine fallback), knowledge-base checks,
// missing information, the inputs used and limitations. Selecting a crop saves it on the farm
// and opens the calendar prefilled for this farm.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, XCircle, Info, CalendarDays, CloudSun, FlaskConical, Check,
} from 'lucide-react';
import { farmApi } from '../../hooks/useFarms';
import { apiErrorMessage } from '../../api/client';

const ENGINE = {
  ml: { label: 'Ranked by the crop model (ML)', icon: CheckCircle2, cls: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-300' },
  'rule-engine': { label: 'Rule-engine fallback — the crop model was not used', icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300' },
  none: { label: 'Not enough information to recommend crops', icon: XCircle, cls: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300' },
};

const localToday = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the farmer's timezone
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const show = (v) => (v === undefined || v === null ? '–' : v);

function InputsUsed({ result }) {
  const { inputs = {}, model } = result;
  const cl = inputs.climate;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[0.7rem] text-[var(--color-text)]" data-testid="rec-inputs">
      <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-0.5">
        <p className="font-bold text-xs mb-1 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5 text-amber-600" /> Farm &amp; soil inputs</p>
        <p>Soil type: {inputs.soilType ? `${inputs.soilType.value}${inputs.soilType.usedAs ? ` (used as “${inputs.soilType.usedAs}”)` : ' (not recognised)'}` : 'not set'}</p>
        <p>Water source: {inputs.waterSource ? `${inputs.waterSource.value}${inputs.waterSource.usedAs ? ` → ${inputs.waterSource.usedAs}` : ' (not recognised)'}` : 'not set'}</p>
        <p>Soil test: {inputs.soilTest ? `N ${show(inputs.soilTest.N)} · P ${show(inputs.soilTest.P)} · K ${show(inputs.soilTest.K)} · pH ${show(inputs.soilTest.ph)}${inputs.soilTest.testedOn ? ` (tested ${inputs.soilTest.testedOn})` : ''}` : 'none saved'}</p>
        <p>Crop history: {inputs.cropHistory?.length ? inputs.cropHistory.join(', ') : 'none recorded'}</p>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-0.5">
        <p className="font-bold text-xs mb-1 flex items-center gap-1.5"><CloudSun className="w-3.5 h-3.5 text-sky-600" /> Season climate — historical, not a forecast</p>
        {cl ? (
          <>
            <p>{cl.temperature} °C mean · {cl.humidity}% humidity · {cl.rainfall} mm rain per 30 days ({cl.seasonRainfallTotal} mm over {cl.window.days} days)</p>
            <p>Average of {cl.window.years.join(', ')} for the {cl.window.days} days from {cl.window.startsOn} (MM-DD), at {cl.farmCoordinates.lat.toFixed(4)}, {cl.farmCoordinates.lon.toFixed(4)}{cl.locationLabel ? ` — ${cl.locationLabel}` : ''}</p>
            <p className="text-[var(--color-text-muted)]">{cl.source}</p>
          </>
        ) : <p className="text-[var(--color-text-muted)]">Not available — see missing information.</p>}
      </div>
      {model?.features && (
        <div className="md:col-span-2 rounded-xl border border-[var(--color-border)] p-3">
          <p className="font-bold text-xs mb-1">Crop model inputs {model.used ? '(model used)' : '(model not used)'}</p>
          <p className="font-mono break-words">{Object.entries(model.features).map(([k, v]) => `${k}=${v}`).join('  ·  ')}</p>
        </div>
      )}
    </div>
  );
}

export default function FarmRecommendations({ farm, onSelect, onEditFarm }) {
  const navigate = useNavigate();
  const [sowingDate, setSowingDate] = useState(localToday());
  const [result, setResult] = useState(null);
  const [fromHistory, setFromHistory] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(null);
  const [error, setError] = useState('');

  // Show the farm's most recent saved run (recommendation history is persisted per farm)
  useEffect(() => {
    let alive = true;
    farmApi.recommendations(farm.id)
      .then((list) => {
        if (!alive) return;
        setHistoryCount(list.length);
        if (list.length) { setResult(list[0]); setFromHistory(true); setSowingDate(list[0].plannedSowingDate); }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [farm.id]);

  const run = async () => {
    setBusy(true); setError('');
    try {
      const rec = await farmApi.recommend(farm.id, sowingDate);
      setResult(rec); setFromHistory(false); setHistoryCount((n) => n + 1);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not get recommendations right now'));
    } finally { setBusy(false); }
  };

  const openCalendar = () => navigate(`/calendar?farmId=${encodeURIComponent(farm.id)}`);

  const choose = async (item) => {
    setSelecting(item.crop);
    try {
      await onSelect(farm.id, result.id, item.crop);
      toast.success(`${item.displayName} selected for ${farm.name}`);
      openCalendar();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save your selection'));
      setSelecting(null);
    }
  };

  const eng = result ? ENGINE[result.engine] || ENGINE.none : null;

  return (
    <div data-testid="farm-recommendations">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="text-[0.68rem] font-semibold text-[var(--color-text)] block mb-1">Planned sowing date</label>
          <input type="date" value={sowingDate} onChange={(e) => setSowingDate(e.target.value)} className="input text-sm !py-2" />
        </div>
        <button onClick={run} disabled={busy || !sowingDate} className="btn-primary flex items-center gap-2" data-testid="get-recommendations">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Get AI Crop Recommendations
        </button>
        <p className="w-full text-[0.7rem] text-[var(--color-text-muted)]">
          Uses this farm’s soil type, water source, soil test, crop history and the historical season climate at its confirmed location. The season comes from the planned sowing date.
        </p>
      </div>

      {busy && <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 mb-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading this farm’s season climate and running the crop model…</p>}
      {error && <p className="text-xs text-red-600 mb-3" role="alert">{error}</p>}
      {!result && !busy && !error && (
        <p className="text-xs text-[var(--color-text-muted)]">No recommendations for this farm yet — choose a sowing date and press the button.</p>
      )}

      {result && (
        <div className="space-y-4" data-testid="recommendation-result">
          <div className={`rounded-xl border p-3 flex items-start gap-2 ${eng.cls}`}>
            <eng.icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-bold" data-testid="rec-engine">{eng.label}</p>
              <p>
                Season: {cap(result.season)} (planned sowing {result.plannedSowingDate}) ·{' '}
                {fromHistory ? `Saved result from ${when(result.createdAt)}` : `Generated ${when(result.createdAt)} and saved to this farm’s history`}
                {historyCount > 1 ? ` · ${historyCount} runs in history` : ''}
              </p>
            </div>
          </div>

          {result.missing?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-900/40 p-3" data-testid="rec-missing">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Missing information</p>
              <ul className="space-y-1">
                {result.missing.map((m) => (
                  <li key={m.field} className="text-xs text-[var(--color-text)]"><b>{m.label}</b> — {m.reason}. <span className="text-[var(--color-text-muted)]">{m.fix}.</span></li>
                ))}
              </ul>
              <button onClick={() => onEditFarm(farm)} className="btn-secondary text-xs mt-2">Edit farm details</button>
            </div>
          )}

          {result.shortlist?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="rec-shortlist">
              {result.shortlist.map((item, i) => (
                <div key={item.crop} className="card p-4 flex flex-col" data-testid="rec-card">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-extrabold text-sm text-[var(--color-text)]">#{i + 1} {item.displayName}</h4>
                    <span className={`badge ${item.score.kind === 'ml-probability' ? 'badge-green' : 'badge-yellow'} shrink-0`}>{item.score.label}</span>
                  </div>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-2">
                    {item.score.kind === 'ml-probability' ? 'Crop-model class probability' : 'Rule-engine knowledge-base match'}
                  </p>
                  {item.reasons.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {item.reasons.map((r) => <li key={r} className="flex gap-1.5 text-[0.7rem] text-[var(--color-text)]"><Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-px" />{r}</li>)}
                    </ul>
                  )}
                  {item.limitations.length > 0 && (
                    <ul className="space-y-1 mb-2">
                      {item.limitations.map((l) => <li key={l} className="flex gap-1.5 text-[0.7rem] text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{l}</li>)}
                    </ul>
                  )}
                  <div className="text-[0.66rem] text-[var(--color-text-muted)] mt-auto pt-2 border-t border-[var(--color-border)] space-y-0.5">
                    {item.durationDays && <p>Duration: {item.durationDays[0]}–{item.durationDays[1]} days</p>}
                    {item.waterNeed && <p>Water need: {item.waterNeed}</p>}
                    <p>Estimated cost: {item.estimatedCost ?? item.costNote}</p>
                    {item.note && <p>Knowledge-base note: {item.note}</p>}
                  </div>
                  {result.selectedCrop === item.crop ? (
                    <button onClick={openCalendar} className="btn-secondary text-xs mt-3 flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> Selected — open calendar</button>
                  ) : (
                    <button onClick={() => choose(item)} disabled={!!selecting} className="btn-primary text-xs mt-3 flex items-center justify-center gap-1.5" data-testid="select-crop">
                      {selecting === item.crop ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Select &amp; plan calendar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {result.excluded?.length > 0 && (
            <details className="text-xs text-[var(--color-text)]">
              <summary className="cursor-pointer font-semibold text-[var(--color-text-muted)]">Ranked but not shown ({result.excluded.length})</summary>
              <ul className="mt-1.5 space-y-0.5 pl-4 list-disc">
                {result.excluded.map((e) => <li key={e.crop}>{e.displayName} ({e.score.label}) — {e.reason}</li>)}
              </ul>
            </details>
          )}

          <InputsUsed result={result} />

          {result.limitations?.length > 0 && (
            <div data-testid="rec-limitations">
              <p className="text-xs font-bold text-[var(--color-text)] mb-1">Limitations</p>
              <ul className="list-disc pl-4 text-[0.7rem] text-[var(--color-text-muted)] space-y-0.5">
                {result.limitations.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
