// src/components/farms/FarmFertilizerPlan.jsx — fertilizer plan for one saved farm, shown exactly
// as the backend computed it: Soil Health Card ratings (official ICAR-IISS limits) with the ML
// rating model alongside, the crop dose adjusted by the N/P/K ratings, products, totals for the
// farm, and split dates that match the farm's calendar.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, CalendarDays, FlaskConical, PackageOpen, Leaf, Bot } from 'lucide-react';
import { farmApi } from '../../hooks/useFarms';
import { apiErrorMessage } from '../../api/client';
import { MissingInfo, Limitations } from './FarmNotes';

const STATUS = {
  ok: { label: 'Soil-test adjusted plan', icon: CheckCircle2, cls: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-300' },
  partial: { label: 'Plan with gaps — see the notes below', icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300' },
  insufficient_data: { label: 'Not enough information for a plan', icon: XCircle, cls: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300' },
};
const RATING_CLS = {
  Low: 'badge-red', Deficient: 'badge-red', Medium: 'badge-yellow', High: 'badge-green', Sufficient: 'badge-green',
};

function RatingsTable({ ratings, model }) {
  return (
    <div className="overflow-x-auto" data-testid="fert-ratings">
      <table className="w-full text-[0.72rem]">
        <thead>
          <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <th className="py-1.5 font-semibold">Soil Health Card value</th>
            <th className="py-1.5 font-semibold">Yours</th>
            <th className="py-1.5 font-semibold">Rating (ICAR-IISS limits)</th>
            <th className="py-1.5 font-semibold">ML model {model.used ? '' : '(not used)'}</th>
            <th className="py-1.5 font-semibold hidden md:table-cell">Limits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {ratings.nutrients.map((n) => (
            <tr key={n.key} className={n.agrees === false ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}>
              <td className="py-1.5 text-[var(--color-text)]">{n.label}</td>
              <td className="py-1.5 font-semibold text-[var(--color-text)]">{n.value === null ? <span className="text-[var(--color-text-muted)] font-normal">not entered</span> : `${n.value} ${n.unit}`}</td>
              <td className="py-1.5">{n.rating ? <span className={`badge ${RATING_CLS[n.rating]}`}>{n.rating}</span> : '–'}</td>
              <td className="py-1.5 text-[var(--color-text)]">
                {!n.model ? <span className="text-[var(--color-text-muted)]">–</span>
                  : n.model.rating ? <>{n.model.rating} <span className="text-[var(--color-text-muted)]">({Math.round(n.model.confidence * 100)}%)</span>{n.agrees === false && <span className="ml-1 text-amber-600 font-semibold">≠ disagrees</span>}</>
                    : <span className="text-amber-600">depends on soil class: {Object.entries(n.model.dependsOnSoilClass || {}).map(([k, v]) => `${k} ${v}`).join(', ')}</span>}
              </td>
              <td className="py-1.5 text-[var(--color-text-muted)] hidden md:table-cell">{n.limits}</td>
            </tr>
          ))}
          {ratings.soilReaction.ph && (
            <tr><td className="py-1.5 text-[var(--color-text)]">Soil pH</td><td className="py-1.5 font-semibold">{ratings.soilReaction.ph.value}</td><td className="py-1.5"><span className="badge badge-blue">{ratings.soilReaction.ph.class}</span></td><td className="py-1.5 text-[var(--color-text-muted)]">–</td><td className="py-1.5 text-[var(--color-text-muted)] hidden md:table-cell">{ratings.soilReaction.ph.limits}</td></tr>
          )}
          {ratings.soilReaction.ec && (
            <tr><td className="py-1.5 text-[var(--color-text)]">Electrical conductivity (EC)</td><td className="py-1.5 font-semibold">{ratings.soilReaction.ec.value} dS/m</td><td className="py-1.5"><span className={`badge ${ratings.soilReaction.ec.class === 'Saline' ? 'badge-red' : 'badge-green'}`}>{ratings.soilReaction.ec.class}</span></td><td className="py-1.5 text-[var(--color-text-muted)]">–</td><td className="py-1.5 text-[var(--color-text-muted)] hidden md:table-cell">{ratings.soilReaction.ec.limits}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function FarmFertilizerPlan({ farm, crops, onEditFarm }) {
  const [crop, setCrop] = useState(''); // '' → the crop selected on the Farms page
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    farmApi.fertilizer(farm.id, crop || undefined)
      .then((d) => { if (alive) setResult(d); })
      .catch((e) => { if (alive) { setResult(null); setError(apiErrorMessage(e)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [farm.id, crop]);

  const selectedName = farm.selectedCrop ? (farm.selectedCrop.calendarCrop || farm.selectedCrop.displayName || farm.selectedCrop.crop) : null;
  const st = result && STATUS[result.status];
  const plan = result?.plan;

  return (
    <div className="space-y-4" data-testid="farm-fertilizer">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[0.68rem] text-[var(--color-text-muted)] mb-1">Crop</label>
          <select className="input text-sm !py-2 w-64" value={crop} onChange={(e) => setCrop(e.target.value)} data-testid="fert-crop-select">
            <option value="">{selectedName ? `Selected crop — ${selectedName}` : 'No crop selected yet'}</option>
            {crops.filter((c) => c !== selectedName).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {result && (
          <p className="text-[0.72rem] text-[var(--color-text-muted)] pb-2" data-testid="fert-context">
            {result.area.acres !== null ? `${result.area.acres} acres (${result.area.entered})` : `Area: ${result.area.entered}`}
            {' · '}{result.season.name} season, from {result.season.basis}
            {result.soilTest?.testedOn ? ` · soil tested ${result.soilTest.testedOn}` : ''}
          </p>
        )}
        <button type="button" onClick={() => onEditFarm(farm)} className="ml-auto text-xs font-semibold text-green-700 dark:text-green-400 hover:underline pb-2">Edit soil test / farm</button>
      </div>

      {loading && <div className="card p-8 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Working out the plan…</div>}
      {!loading && error && <div className="card p-4 text-sm text-red-600" data-testid="fert-error">{error}</div>}

      {!loading && result && (
        <>
          <div className={`rounded-xl border px-4 py-3 flex items-start gap-2 text-sm ${st.cls}`} data-testid="fert-status" data-status={result.status}>
            <st.icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">{st.label}{result.crop ? ` — ${result.crop.name}` : ''}</p>
              {result.doseBasis === 'generic' && <p className="text-xs mt-0.5">Generic dose: KisanAI has no crop-specific dose for this crop.</p>}
              {result.calendar && <p className="text-xs mt-0.5 flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Dates match your calendar (sown {result.calendar.sowingDate}). <Link to={`/calendar?farmId=${encodeURIComponent(farm.id)}`} className="underline">Open calendar</Link></p>}
            </div>
          </div>

          <MissingInfo missing={result.missing} testid="fert-missing" />

          <div className="card p-4 space-y-3">
            <h4 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><FlaskConical className="w-4 h-4 text-amber-600" /> Soil ratings</h4>
            <RatingsTable ratings={result.ratings} model={result.model} />
            <p className="text-[0.7rem] text-[var(--color-text-muted)] flex items-start gap-1.5" data-testid="fert-model-note">
              <Bot className="w-3.5 h-3.5 shrink-0 mt-px" />
              {result.model.used
                ? `ML soil-rating model (${result.model.name}) ran on all 12 values${result.model.soilClasses ? ` with soil class ${result.model.soilClasses.join(' and ')}` : ''}, ${result.model.season} season. ${result.model.soilNote || ''} The dose uses the ICAR-IISS rating; the model is a second opinion.`
                : `ML soil-rating model not used: ${result.model.reason}.`}
            </p>
          </div>

          {plan && (
            <>
              <div className="card p-4 space-y-3" data-testid="fert-dose">
                <h4 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><PackageOpen className="w-4 h-4 text-green-600" /> Dose per acre and for your {plan.areaAcres} acres</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {plan.adjustments.map((a) => {
                    const base = a.nutrient === 'N' ? plan.baseDosePerAcre.N : a.nutrient === 'P2O5' ? plan.baseDosePerAcre.P2O5 : plan.baseDosePerAcre.K2O;
                    return (
                      <div key={a.nutrient} className="rounded-xl border border-[var(--color-border)] p-3">
                        <p className="text-[0.68rem] text-[var(--color-text-muted)]">{a.nutrient} (kg/acre)</p>
                        <p className="text-lg font-extrabold text-[var(--color-text)]">{plan.perAcre.nutrients[a.nutrient]}</p>
                        <p className="text-[0.68rem] text-[var(--color-text-muted)]">crop dose {base} × {a.factor}</p>
                        <p className="text-[0.68rem] text-[var(--color-text)] mt-0.5">{a.reason}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[0.72rem]">
                    <thead><tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]"><th className="py-1.5">Product</th><th className="py-1.5">Per acre</th><th className="py-1.5">Total for {plan.areaAcres} acres</th></tr></thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {Object.entries(plan.perAcre.products).map(([name, kg]) => (
                        <tr key={name}><td className="py-1.5 font-semibold text-[var(--color-text)]">{name}</td><td className="py-1.5">{kg} kg</td><td className="py-1.5 font-bold text-green-700 dark:text-green-400">{plan.totals[name]} kg</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card p-4 space-y-2" data-testid="fert-schedule">
                <h4 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-600" /> When to apply</h4>
                {plan.schedule.map((s) => (
                  <div key={s.stage} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-[0.72rem]">
                    <span className="font-bold text-[var(--color-text)] w-52">{s.stage}</span>
                    <span className="text-[var(--color-text)]">{s.date || `day ${s.dayOffset}`}</span>
                    <span className="text-[var(--color-text-muted)]">For your {plan.areaAcres} acres: {Object.entries(s.productsTotal).map(([k, v]) => `${k} ${v}`).join(' · ')}</span>
                    {s.calendarEvent && <span className={`badge ${s.calendarEvent.done ? 'badge-green' : 'badge-blue'} ml-auto`}>{s.calendarEvent.done ? 'Done in calendar' : 'In your calendar'}</span>}
                  </div>
                ))}
                {!plan.schedule.some((s) => s.date) && <p className="text-[0.7rem] text-[var(--color-text-muted)]">No sowing date saved for this crop, so the splits are shown as days after sowing.</p>}
              </div>
            </>
          )}

          {(result.advisories.length > 0 || plan) && (
            <div className="card p-4 space-y-2" data-testid="fert-advisories">
              <h4 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><Leaf className="w-4 h-4 text-green-600" /> Advice for this field</h4>
              <ul className="list-disc pl-5 space-y-1 text-[0.72rem] text-[var(--color-text)]">
                {result.advisories.map((a) => <li key={a}>{a}</li>)}
                {plan && <li>{plan.organic}</li>}
                {plan?.cautions.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}

          <Limitations limitations={result.limitations} sources={result.sources} testid="fert-limitations" />
        </>
      )}
    </div>
  );
}
