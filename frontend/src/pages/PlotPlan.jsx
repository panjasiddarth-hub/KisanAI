// src/pages/PlotPlan.jsx — Cultivation Plan for one plot: crop recommendation → confirmed crop cycle →
// calendar → fertilizer / irrigation / market advice. Everything here is computed from the plot's own
// details and crop cycle; stale results are flagged and only recomputed when the farmer asks.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Sparkles, AlertTriangle, CalendarDays, RefreshCw, FlaskConical, Droplets, Store, CheckCircle2 } from 'lucide-react';
import { usePlotPlan, planApi } from '../hooks/usePlotPlan';
import { plotError, formatArea } from '../hooks/usePlots';
import SourceBadge from '../components/ui/SourceBadge';

const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const when = (t) => (t ? new Date(t).toLocaleString() : '');

function Stale({ reasons, testId, action, onAction, busy }) {
  return (
    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex flex-wrap items-center gap-2" data-testid={testId}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">Out of date — {reasons.join('; ')}.</span>
      {onAction && <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={onAction} disabled={busy}>{busy ? 'Working…' : action}</button>}
    </div>
  );
}

function Missing({ items = [] }) {
  if (!items.length) return null;
  return (
    <ul className="text-xs text-red-700 dark:text-red-300 list-disc ml-5 space-y-0.5">
      {items.map((m) => <li key={m.field + m.label}>{m.label}{m.fix ? ` — ${m.fix}` : ''}</li>)}
    </ul>
  );
}

function Limitations({ items = [] }) {
  if (!items.length) return null;
  return <ul className="text-[0.68rem] text-[var(--color-text-muted)] list-disc ml-5 space-y-0.5">{items.map((l) => <li key={l}>{l}</li>)}</ul>;
}

// ---- Crop: recommendation → confirmation → crop cycle ---------------------------------------------
function CropSection({ farmId, plotId, plan, reload }) {
  const [date, setDate] = useState(addDays(14));
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(null);
  const rec = plan.recommendation;
  const cycle = plan.cycle;
  const [newDate, setNewDate] = useState('');

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error(plotError(e).message, { duration: 7000 }); } finally { setBusy(false); }
  };

  if (cycle) {
    return (
      <div className="card p-5" data-testid="cycle-card">
        <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Crop cycle: {cycle.crop}</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Status <b data-testid="cycle-status">{cycle.status}</b> · {cycle.season} ·{' '}
          {cycle.sowingDate ? `sown ${cycle.sowingDate}` : `planned sowing ${cycle.plannedSowingDate}`} · {cycle.source === 'recommendation' ? 'from a recommendation' : 'entered manually'}
        </p>
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          {cycle.status === 'planned' && (
            <>
              <button type="button" className="btn-primary text-xs py-1.5" data-testid="mark-sown" disabled={busy}
                onClick={() => run(() => planApi.updateCycle(farmId, plotId, cycle.id, { status: 'active', sowingDate: addDays(0) }), 'Marked as sown today')}>Mark as sown today</button>
              <input type="date" className="input text-xs py-1 w-40" value={newDate} onChange={(e) => setNewDate(e.target.value)} data-testid="planned-date-input" aria-label="New planned sowing date" />
              <button type="button" className="btn-secondary text-xs py-1.5" data-testid="save-planned-date" disabled={busy || !newDate}
                onClick={() => run(() => planApi.updateCycle(farmId, plotId, cycle.id, { plannedSowingDate: newDate }), 'Planned sowing date changed')}>Change planned date</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-3" data-testid="recommend-section">
      <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><Sparkles className="w-4 h-4 text-green-600" /> Choose a crop for this plot</h3>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-[var(--color-text)]">Planned sowing date
          <input type="date" className="input text-xs py-1.5 mt-1" value={date} onChange={(e) => setDate(e.target.value)} data-testid="rec-date" />
        </label>
        <button type="button" className="btn-primary text-xs py-2 flex items-center gap-1.5" data-testid="get-recommendations" disabled={busy}
          onClick={() => run(() => planApi.recommend(farmId, plotId, date), 'Recommendation ready')}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {rec ? 'Get a new recommendation' : 'Get recommendations'}
        </button>
      </div>
      {rec?.stale && <Stale reasons={rec.reasons} testId="rec-stale" />}
      {rec && (
        <div className="space-y-2" data-testid="rec-result">
          <p className="text-[0.68rem] text-[var(--color-text-muted)]">
            {rec.status === 'insufficient_data' ? 'Not enough information for a recommendation:' : `Made ${when(rec.createdAt)} for sowing on ${rec.plannedSowingDate} (${rec.season}).`}{' '}
            <SourceBadge kind={rec.engine === 'ml' ? 'trained_model' : 'rule_engine'} name={rec.engine === 'ml' ? 'crop model + soil rules' : 'soil & season rules'} />
          </p>
          <Missing items={rec.missing} />
          {(rec.shortlist || []).map((s) => (
            <div key={s.crop} className="p-3 rounded-xl border border-[var(--color-border)] flex flex-wrap items-center gap-2" data-testid="rec-item" data-crop={s.crop}>
              <span className="font-semibold text-sm text-[var(--color-text)] flex-1">{s.displayName || s.crop}{' '}
                <span className="text-xs text-[var(--color-text-muted)] font-normal" data-testid="rec-score">· {s.score?.label} ({s.score?.kind === 'ml-probability' ? 'crop-model class probability' : 'rule-engine knowledge-base match'})</span>
              </span>
              <button type="button" className="btn-secondary text-xs py-1 px-2" data-testid="select-crop" disabled={busy || rec.stale} onClick={() => setPick(s)}>Select</button>
              {s.reasons?.length > 0 && <p className="basis-full text-[0.68rem] text-[var(--color-text-muted)]">{s.reasons.slice(0, 2).join(' · ')}</p>}
            </div>
          ))}
          <Limitations items={rec.limitations} />
        </div>
      )}
      {pick && (
        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 text-xs space-y-2" data-testid="confirm-panel">
          <p className="text-[var(--color-text)]">Create a crop cycle for <b>{plan.plot.name}</b>: <b>{pick.displayName || pick.crop}</b>, planned sowing <b>{rec.plannedSowingDate}</b>? The plot can have only one open crop cycle.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-xs py-1.5" data-testid="confirm-select" disabled={busy}
              onClick={() => run(async () => { await planApi.select(farmId, plotId, rec.id, { crop: pick.crop, confirm: true }); setPick(null); }, 'Crop cycle created')}>Confirm</button>
            <button type="button" className="btn-secondary text-xs py-1.5" onClick={() => setPick(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Calendar (one per crop cycle; events ticked by stable id) ----------------------------------
function CalendarSection({ farmId, plotId, plan, reload }) {
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const cal = plan.calendar;
  const cycle = plan.cycle;
  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await reload(); } catch (e) { toast.error(plotError(e).message); } finally { setBusy(false); }
  };
  return (
    <div className="card p-5 space-y-3" data-testid="calendar-section">
      <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><CalendarDays className="w-4 h-4 text-green-600" /> Season calendar <SourceBadge kind="calculation" name="crop timeline rules" /></h3>
      {!cal && (
        <button type="button" className="btn-primary text-xs py-2" data-testid="create-calendar" disabled={busy}
          onClick={() => act(() => planApi.createCalendar(farmId, plotId, cycle.id), 'Calendar created')}>Create the calendar for {cycle.crop}</button>
      )}
      {cal?.stale && <Stale reasons={cal.reasons} testId="calendar-stale" action="Regenerate calendar" busy={busy}
        onAction={() => act(() => planApi.regenerateCalendar(farmId, plotId, cycle.id), 'Calendar regenerated — completed tasks kept')} />}
      {cal && (
        <>
          <p className="text-[0.68rem] text-[var(--color-text-muted)]">{cal.events.length} tasks from {cal.sowingDate} · harvest {cal.harvestWindow}</p>
          <ul className="divide-y divide-[var(--color-border)]" data-testid="calendar-events">
            {(all ? cal.events : cal.events.slice(0, 8)).map((e) => (
              <li key={e.id} className="py-1.5 flex items-center gap-2 text-xs" data-testid="event-row" data-event-id={e.id}>
                <input type="checkbox" checked={!!e.done} disabled={busy} aria-label={`Done: ${e.title}`} data-testid="event-done"
                  onChange={(ev) => act(() => planApi.tick(farmId, plotId, cycle.id, e.id, ev.target.checked))} />
                <span className="w-20 shrink-0 text-[var(--color-text-muted)]">{e.date}</span>
                <span className={`flex-1 ${e.done ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>{e.title}</span>
              </li>
            ))}
          </ul>
          {cal.events.length > 8 && <button type="button" className="text-xs font-semibold text-green-700" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${cal.events.length}`}</button>}
        </>
      )}
    </div>
  );
}

// ---- Advice: fertilizer / irrigation / market (irrigation lives here, not in the main menu) ----
const TABS = [
  { key: 'fertilizer', label: 'Fertilizer', icon: FlaskConical },
  { key: 'irrigation', label: 'Irrigation', icon: Droplets },
  { key: 'market', label: 'Market', icon: Store },
];

function FertilizerBody({ r }) {
  const p = r?.plan;
  if (!p) return null;
  return (
    <div className="space-y-2 text-xs text-[var(--color-text)]">
      <p>Per acre: N <b>{p.perAcre.nutrients.N}</b> · P₂O₅ <b>{p.perAcre.nutrients.P2O5}</b> · K₂O <b>{p.perAcre.nutrients.K2O}</b> kg — for {p.areaAcres} acres: {Object.entries(p.totals).map(([k, v]) => `${k} ${v} kg`).join(' · ')}</p>
      <table className="w-full text-[0.7rem]" data-testid="fert-schedule"><tbody>
        {p.schedule.map((s) => (
          <tr key={s.stage} className="border-t border-[var(--color-border)]"><td className="py-1">{s.date || `day ${s.dayOffset}`}</td><td>{s.stage}</td><td>{s.share}</td><td>{Object.entries(s.productsTotal).map(([k, v]) => `${k} ${v}`).join(', ')}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
function IrrigationBody({ r }) {
  const o = r?.outlook;
  if (!o) return null;
  return (
    <div className="text-xs text-[var(--color-text)] space-y-1">
      <p>Next {o.cropDays} days: crop water use <b>{o.etcMm ?? '—'} mm</b>, rain <b>{o.rainOnCropDaysMm ?? '—'} mm</b>, net need <b>{o.netMm ?? '—'} mm</b>{o.netLitres != null ? <> ≈ <b>{o.netLitres.toLocaleString()} litres</b> for this plot</> : null}.</p>
      {r.rule && <p className="text-[0.68rem] text-[var(--color-text-muted)]">{r.rule.text}</p>}
    </div>
  );
}
function MarketBody({ r }) {
  if (!r?.crops) return null;
  return (
    <ul className="text-xs text-[var(--color-text)] space-y-1">
      {r.crops.map((c) => <li key={c.crop}><b>{c.crop}</b> — price model: {c.model?.supported ? `covers it as ${c.model.commodity}` : 'does not cover this crop'}{c.model?.forecast == null ? ' (no forecast)' : ''}. Live mandi prices: {r.live?.status || c.live?.status || 'not configured'}.{c.model?.note ? <span className="block text-[0.68rem] text-[var(--color-text-muted)]">{c.model.note}</span> : null}</li>)}
    </ul>
  );
}

function AdviceSection({ farmId, plotId, plan, reload }) {
  const [tab, setTab] = useState('fertilizer');
  const [busy, setBusy] = useState(null);
  const assess = async (agents) => {
    setBusy(agents ? agents[0] : 'all');
    try { await planApi.assess(farmId, plotId, agents); toast.success('Advice updated'); await reload(); } catch (e) { toast.error(plotError(e).message); } finally { setBusy(null); }
  };
  const a = plan.advice[tab];
  const Body = { fertilizer: FertilizerBody, irrigation: IrrigationBody, market: MarketBody }[tab];
  return (
    <div className="card p-5 space-y-3" data-testid="advice-section">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-sm text-[var(--color-text)] flex-1">Advice for this plot</h3>
        <button type="button" className="btn-primary text-xs py-1.5 flex items-center gap-1.5" data-testid="assess-all" disabled={!!busy} onClick={() => assess()}>
          {busy === 'all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Assess all
        </button>
      </div>
      <div className="flex gap-1.5" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} data-testid={`tab-${key}`} onClick={() => setTab(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${tab === key ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-[var(--color-text)]'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}{plan.advice[key].stale ? ' •' : ''}
          </button>
        ))}
      </div>
      <div data-testid={`advice-${tab}`} className="space-y-2">
        {!a.assessed && <p className="text-xs text-[var(--color-text-muted)]">Not assessed yet for this crop cycle.</p>}
        {a.assessed && (
          <>
            <p className="text-[0.68rem] text-[var(--color-text-muted)] flex flex-wrap gap-1.5 items-center">
              <span data-testid="advice-status">{a.status}</span> · assessed {when(a.createdAt)} · {a.sources.map((s) => <SourceBadge key={s.name} kind={s.kind} name={s.name} detail={s.detail} />)}
            </p>
            {a.stale && <Stale reasons={a.reasons} testId={`advice-stale-${tab}`} action="Reassess" busy={busy === tab} onAction={() => assess([tab])} />}
            {a.error && <p className="text-xs text-red-700 dark:text-red-300">{a.error}</p>}
            <Missing items={a.result?.missing} />
            <Body r={a.result} />
            <Limitations items={a.result?.limitations} />
          </>
        )}
        {!a.assessed && (
          <button type="button" className="btn-secondary text-xs py-1.5" data-testid={`reassess-${tab}`} disabled={!!busy} onClick={() => assess([tab])}>Assess {tab}</button>
        )}
      </div>
    </div>
  );
}

export default function PlotPlan() {
  const { farmId, plotId } = useParams();
  const { data, loading, error, reload } = usePlotPlan(farmId, plotId);
  if (loading && !data) return <div className="page-content flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>;
  if (error && !data) return <div className="page-content"><p className="text-sm text-red-600" role="alert">{error.message}</p></div>;
  const { plot, farm } = data;
  return (
    <div className="page-content space-y-4" style={{ maxWidth: '980px' }} data-testid="plot-plan">
      <div>
        <Link to="/farms" className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> My Farm</Link>
        <h2 className="text-xl font-extrabold text-[var(--color-text)] mt-1">Cultivation plan — {plot.name}</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          {farm.name} · {formatArea(plot)} · {plot.soilType || 'soil type not recorded'} · {plot.soilCardValues}/12 soil card values{plot.soilTest?.ph != null ? ` (pH ${plot.soilTest.ph})` : ''} · water: {plot.waterAccess.source || 'not recorded'}
        </p>
        <p className="text-[0.68rem] text-[var(--color-text-muted)] mt-1">Everything on this page uses this plot’s own details and crop cycle. The farm supplies only its location{farm.locationConfirmed ? '' : ' (not confirmed yet — irrigation advice needs it)'}.</p>
      </div>
      <CropSection farmId={farmId} plotId={plotId} plan={data} reload={reload} />
      {data.cycle && <CalendarSection farmId={farmId} plotId={plotId} plan={data} reload={reload} />}
      {data.cycle && <AdviceSection farmId={farmId} plotId={plotId} plan={data} reload={reload} />}
    </div>
  );
}
