// src/components/farms/FarmPlots.jsx — the plots of one farm: area allocation, list, add / edit / archive / delete
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Archive, ArchiveRestore, Trash2, Droplets, FlaskConical, Sprout, Loader2, AlertTriangle, Info, ClipboardList } from 'lucide-react';
import { api } from '../../api/client';
import { usePlots, plotApi, plotError, formatArea, COPIED_LABELS } from '../../hooks/usePlots';
import PlotForm from './PlotForm';

const r2 = (v) => Math.round(v * 100) / 100;

function AllocationBar({ allocation }) {
  if (!allocation) return null;
  const { farmAcres, allocatedAcres, unallocatedAcres, checkable, warnings } = allocation;
  const pct = checkable && farmAcres ? Math.min(100, (allocatedAcres / farmAcres) * 100) : 0;
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-700/30" data-testid="plots-allocation">
      {checkable ? (
        <>
          <div className="flex justify-between text-xs mb-1.5 text-[var(--color-text)]">
            <span><b>{r2(allocatedAcres)}</b> of {r2(farmAcres)} acres in plots</span>
            <span className="text-[var(--color-text-muted)]">{r2(unallocatedAcres)} acres not in any plot</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
            <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {warnings.join(' ')}
        </p>
      )}
    </div>
  );
}

function IconButton({ label, icon: Icon, onClick, danger, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`p-1.5 rounded-lg text-[var(--color-text-muted)] disabled:opacity-40 ${danger ? 'hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600' : 'hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-blue-600'}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

function PlotCard({ plot, busy, onEdit, onArchive, onRestore, onDelete }) {
  const archived = plot.status === 'archived';
  const prev = plot.previousCrops.map((p) => [p.crop, p.season, p.year].filter(Boolean).join(' '));
  return (
    <div className={`p-4 rounded-xl border border-[var(--color-border)] ${archived ? 'opacity-70' : ''}`} data-testid="plot-card" data-plot-name={plot.name}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-sm text-[var(--color-text)] flex flex-wrap items-center gap-2">
            {plot.name}
            {archived && <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-600">Archived</span>}
            {plot.openCycle && <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300">{plot.openCycle.crop} · {plot.openCycle.status}</span>}
          </h4>
          <p className="text-xs text-[var(--color-text-muted)]" data-testid="plot-area">{formatArea(plot)}</p>
        </div>
        <div className="flex items-center gap-1">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />}
          {!archived && <IconButton label={`Edit ${plot.name}`} icon={Edit2} onClick={onEdit} disabled={busy} />}
          {archived
            ? <IconButton label={`Restore ${plot.name}`} icon={ArchiveRestore} onClick={onRestore} disabled={busy} />
            : <IconButton label={`Archive ${plot.name}`} icon={Archive} onClick={onArchive} disabled={busy} />}
          <IconButton label={`Delete ${plot.name}`} icon={Trash2} onClick={onDelete} danger disabled={busy} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-[var(--color-text)]">
        <div className="flex gap-1.5" data-testid="plot-soil">
          <FlaskConical className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {plot.soilType || 'Soil type not recorded'}
            {plot.soilCardValues ? ` · ${plot.soilCardValues}/12 card values` : ' · no soil test'}
            {plot.soilTest?.ph != null ? ` · pH ${plot.soilTest.ph}` : ''}
            {plot.soilTest?.testedOn ? ` (tested ${plot.soilTest.testedOn})` : ''}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Droplets className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
          <span>{plot.waterAccess.source ? `${plot.waterAccess.source}${plot.waterAccess.method ? ` · ${plot.waterAccess.method}` : ''}` : 'Water access not recorded'}</span>
        </div>
        <div className="flex gap-1.5">
          <Sprout className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
          <span>{prev.length ? `Previously: ${prev.join(', ')}` : 'No previous crops recorded'}</span>
        </div>
      </div>
      {!archived && (
        <Link to={`/farms/${plot.farmId}/plots/${plot.id}`} data-testid="open-plan" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:underline">
          <ClipboardList className="w-3.5 h-3.5" /> Cultivation plan — crop, calendar, fertilizer, irrigation, market
        </Link>
      )}
      {plot.copiedFromFarm && (
        <p className="text-[0.65rem] mt-2 text-[var(--color-text-muted)]">Copied from the farm’s details: {plot.copiedFromFarm.fields.map((x) => COPIED_LABELS[x] || x).join(', ') || 'nothing'}</p>
      )}
    </div>
  );
}

export default function FarmPlots({ farm, onChanged }) {
  const { data, loading, error, reload } = usePlots(farm?.id);
  const [mode, setMode] = useState({ kind: 'list' });
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [cropNames, setCropNames] = useState([]);

  useEffect(() => {
    api.get('/agents/meta').then((r) => setCropNames(r.data?.crops || [])).catch(() => { /* suggestions are optional */ });
  }, []);

  const refreshAll = async (message) => {
    toast.success(message);
    await reload();
    onChanged?.();
  };

  // Thrown errors are shown inside the form (field list for 400s, explanation for 409s).
  const save = async (body) => {
    try {
      if (mode.kind === 'add') {
        const p = await plotApi.create(farm.id, body);
        setMode({ kind: 'list' });
        await refreshAll(`“${p.name}” added`);
        (p.warnings || []).forEach((w) => toast(w, { duration: 7000 }));
      } else {
        const p = await plotApi.update(farm.id, mode.plot.id, body);
        setMode({ kind: 'list' });
        await refreshAll(p.changedInputs?.length ? `Saved — changed: ${p.changedInputs.join(', ')}` : 'Saved — no agronomic inputs changed');
      }
    } catch (e) {
      throw plotError(e, 'Could not save the plot');
    }
  };

  const act = async (plot, fn, message) => {
    setBusyId(plot.id);
    try {
      await fn();
      await refreshAll(message);
    } catch (e) {
      toast.error(plotError(e, 'That did not work').message, { duration: 7000 });
    } finally {
      setBusyId(null);
    }
  };
  const archive = (p) => act(p, () => plotApi.update(farm.id, p.id, { status: 'archived' }), `“${p.name}” archived`);
  const restore = (p) => act(p, () => plotApi.update(farm.id, p.id, { status: 'active' }), `“${p.name}” restored`);
  const remove = (p) => {
    if (!window.confirm(`Delete plot “${p.name}”? This cannot be undone.`)) return;
    act(p, () => plotApi.remove(farm.id, p.id), `“${p.name}” deleted`);
  };

  if (loading && !data) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>;
  if (error && !data) return <p className="text-sm text-red-600" role="alert">{error.message}</p>;

  if (mode.kind !== 'list') {
    return (
      <PlotForm key={mode.plot?.id || 'new'} plot={mode.plot} cropNames={cropNames} wholeFarm={data.wholeFarm}
        onSubmit={save} onCancel={() => setMode({ kind: 'list' })} />
    );
  }

  const active = data.plots.filter((p) => p.status === 'active');
  const archived = data.plots.filter((p) => p.status === 'archived');
  const card = (p) => (
    <PlotCard key={p.id} plot={p} busy={busyId === p.id} onEdit={() => setMode({ kind: 'edit', plot: p })}
      onArchive={() => archive(p)} onRestore={() => restore(p)} onDelete={() => remove(p)} />
  );

  return (
    <div className="space-y-4" data-testid="farm-plots">
      <AllocationBar allocation={data.allocation} />
      {active.length === 0 && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-xs text-[var(--color-text)] flex gap-2" data-testid="whole-farm-note">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <p>This farm is managed as <b>one field (the whole farm)</b>. Add plots to record a separate area, soil, water access and crop history for each field.</p>
        </div>
      )}
      <div className="space-y-3">{active.map(card)}</div>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <button type="button" className="btn-primary flex items-center gap-2" data-testid="add-plot" onClick={() => setMode({ kind: 'add' })}>
          <Plus className="w-4 h-4" /> Add plot
        </button>
        {archived.length > 0 && (
          <button type="button" className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]" data-testid="show-archived" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Hide' : 'Show'} archived plots ({archived.length})
          </button>
        )}
      </div>
      {showArchived && <div className="space-y-3">{archived.map(card)}</div>}
      <p className="text-[0.68rem] text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">
        Each plot has its own cultivation plan (open it from the plot). The farm card’s recommendation, fertilizer, irrigation and market links still use the whole-farm details.
      </p>
    </div>
  );
}
