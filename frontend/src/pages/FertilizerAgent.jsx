// src/pages/FertilizerAgent.jsx — AI agent: crop + soil + area → NPK schedule
import { useEffect, useState } from 'react';
import { api, isOfflineError, apiErrorMessage } from '../api/client';
import { FALLBACK_META } from '../api/fallback';
import OfflineCard from '../components/ui/OfflineCard';
import {
  FlaskConical, Loader2, Sparkles, AlertTriangle, Leaf, PackageOpen
} from 'lucide-react';
import toast from 'react-hot-toast';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const short = (name) => name.split(' ')[0];

export default function FertilizerAgent() {
  const [meta, setMeta] = useState(FALLBACK_META);
  const [form, setForm] = useState({ crop: 'Cotton', areaAcres: 2, soilType: 'black' });
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.get('/agents/meta').then(r => setMeta(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setOffline(false);
    try {
      const { data } = await api.post('/agents/fertilizer', { ...form, areaAcres: Number(form.areaAcres) });
      setPlan(data);
    } catch (err) {
      if (isOfflineError(err)) { setOffline(true); setPlan(null); }
      else toast.error(apiErrorMessage(err));
    } finally { setBusy(false); }
  };

  const productColors = {
    'Urea (46% N)': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    'DAP (18-46-0)': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    'MOP (60% K2O)': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  };

  return (
    <div className="page-content" style={{ maxWidth: '1100px' }}>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold text-[var(--color-text)] flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center"><FlaskConical className="w-5 h-5 text-amber-600" /></span>
          Fertilizer Agent
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Works out the exact N-P-K dose and stage-wise schedule for your crop and acreage.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5 items-start">
        <form onSubmit={submit} className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Crop</label>
            <select value={form.crop} onChange={e => setForm(f => ({ ...f, crop: e.target.value }))} className="input text-sm">
              {meta.crops.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Area (acres)</label>
            <input type="number" min="0.25" max="100" step="0.25" value={form.areaAcres}
              onChange={e => setForm(f => ({ ...f, areaAcres: e.target.value }))} className="input text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--color-text)] block mb-1.5">Soil Type</label>
            <select value={form.soilType} onChange={e => setForm(f => ({ ...f, soilType: e.target.value }))} className="input text-sm">
              {meta.soilTypes.map(s => <option key={s} value={s}>{cap(s)} soil</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#166534] disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl transition-colors">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Computing plan…' : 'Generate Fertilizer Plan'}
          </button>
        </form>

        <div className="space-y-4">
          {offline && <OfflineCard onRetry={submit} />}
          {!offline && !plan && (
            <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 text-amber-300" />
              Select your crop and area — the agent returns per-acre products, totals and a stage-wise schedule.
            </div>
          )}
          {plan && (
            <>
              <div className="rounded-2xl border border-green-200/70 bg-[#e9f7ee] dark:bg-green-950/15 dark:border-green-900/30 p-4 flex gap-3">
                <span className="w-8 h-8 rounded-full bg-[#15803d] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white" /></span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-[var(--color-text)]">Agent's Plan</h4>
                    <span className={`badge ${plan.explanationSource === 'gemini' ? 'badge-purple' : 'badge-blue'}`}>
                      {plan.explanationSource === 'gemini' ? '✨ Gemini AI' : 'Rule Engine'}
                    </span>
                  </div>
                  <p className="text-[0.82rem] text-[var(--color-text)] leading-relaxed mt-1.5">{plan.explanation}</p>
                </div>
              </div>

              {/* Totals */}
              <div className="card p-5">
                <h4 className="font-bold text-sm text-[var(--color-text)] mb-3 flex items-center gap-2"><PackageOpen className="w-4 h-4 text-green-600" /> Total for {plan.areaAcres} acre{plan.areaAcres > 1 ? 's' : ''}</h4>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(plan.totals).map(([name, kg]) => (
                    <div key={name} className={`rounded-2xl p-3 text-center ${productColors[name] || 'bg-gray-100'}`}>
                      <p className="text-xl font-extrabold">{kg}<span className="text-xs font-semibold"> kg</span></p>
                      <p className="text-[0.68rem] font-semibold mt-0.5">{short(name)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-3">
                  Per-acre nutrients: N {plan.perAcre.nutrients.N} kg · P₂O₅ {plan.perAcre.nutrients.P2O5} kg · K₂O {plan.perAcre.nutrients.K2O} kg
                </p>
              </div>

              {/* Schedule */}
              <div className="card p-5">
                <h4 className="font-bold text-sm text-[var(--color-text)] mb-3">Stage-wise Schedule</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                        <th className="py-2 pr-3 font-semibold">Stage</th>
                        <th className="py-2 pr-3 font-semibold">Day</th>
                        <th className="py-2 font-semibold">Products (per acre · total)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.schedule.map((s, i) => (
                        <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="py-2.5 pr-3 font-semibold text-[var(--color-text)]">{s.stage}</td>
                          <td className="py-2.5 pr-3 text-[var(--color-text-muted)]">Day {s.dayOffset}</td>
                          <td className="py-2.5 text-[var(--color-text)]">
                            {Object.entries(s.productsPerAcre).map(([p, per]) => (
                              <div key={p}>{p}: <b>{per}</b> <span className="text-[var(--color-text-muted)]">· {s.productsTotal[p]} total</span></div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Organic + cautions */}
              <div className="card p-4 flex gap-3">
                <Leaf className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-[0.78rem] text-[var(--color-text)] leading-relaxed">{plan.organic}</p>
              </div>
              <div className="card p-4">
                <h4 className="font-bold text-xs text-[var(--color-text)] mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Cautions</h4>
                <ul className="space-y-1.5">
                  {plan.cautions.map((c, i) => (
                    <li key={i} className="text-[0.76rem] text-[var(--color-text-muted)] flex gap-2"><span className="text-amber-500 font-bold">•</span>{c}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
