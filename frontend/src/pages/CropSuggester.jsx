// src/pages/CropSuggester.jsx — AI agent: soil + weather → best crops
import { useEffect, useState } from 'react';
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

export default function CropSuggester() {
  const [meta, setMeta] = useState(FALLBACK_META);
  const [form, setForm] = useState({ soilType: 'black', ph: 6.8, season: 'kharif', irrigation: 'irrigated' });
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {/* offline — fallback meta already set */});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setOffline(false);
    try {
      const { data } = await api.post('/agents/crop', { ...form, ph: Number(form.ph) });
      setResult(data);
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setResult(null); }
      else toast.error(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center"><Sprout className="w-5 h-5 text-green-600" /></span>
          Crop Suggester Agent
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Recommends the best crops for your soil type, pH, season and water availability.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5 items-start">
        {/* Input form */}
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil Type</label>
            <select value={form.soilType} onChange={e => setForm(f => ({ ...f, soilType: e.target.value }))} className="input text-sm">
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
              Fill in your field details and press <b>Suggest Crops</b> — the agent will rank the 5 best crops with reasons.
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

              {result.recommendations.map((r, i) => (
                <div key={r.crop} className={`card p-4 fade-in ${i === 0 ? 'ring-2 ring-green-500/40' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {i === 0
                      ? <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center"><Trophy className="w-4.5 h-4.5 text-amber-500" style={{ width: 18, height: 18 }} /></span>
                      : <span className="w-9 h-9 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-xs font-extrabold text-[var(--color-text-muted)]">#{i + 1}</span>}
                    <div className="flex-1 min-w-[140px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--color-text)]">{r.crop}</h4>
                        <span className={`badge ${WATER_BADGE[r.waterNeed]}`}><Droplets className="w-3 h-3" /> {r.waterNeed} water</span>
                        <span className="badge badge-blue"><CalendarDays className="w-3 h-3" /> {r.durationDays[0]}–{r.durationDays[1]} days</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden max-w-xs">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600" style={{ width: `${r.score}%` }} />
                      </div>
                    </div>
                    <span className="text-2xl font-extrabold text-green-600">{r.score}<span className="text-xs text-[var(--color-text-muted)] font-semibold">%</span></span>
                  </div>
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
                  <p className="text-[0.72rem] text-[var(--color-text-muted)] italic mt-2">💡 {r.hint}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
