// src/components/farms/PlotForm.jsx — add / edit one plot: area, soil profile, water access, crop history
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { AREA_UNITS, friendlyMessage } from '../../hooks/usePlots';

const SOIL_TYPES = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Pond', 'Drip Irrigation', 'Rain-fed'];
const METHODS = ['Flood', 'Furrow', 'Drip', 'Sprinkler'];
const SEASONS = ['kharif', 'rabi', 'zaid', 'perennial'];
const MAIN_SOIL = [['N', 'N (kg/ha)'], ['P', 'P (kg/ha)'], ['K', 'K (kg/ha)'], ['ph', 'pH']];
const MORE_SOIL = [['ec', 'EC (dS/m)'], ['oc', 'OC (%)'], ['s', 'S (ppm)'], ['zn', 'Zn (ppm)'], ['b', 'B (ppm)'], ['fe', 'Fe (ppm)'], ['cu', 'Cu (ppm)'], ['mn', 'Mn (ppm)']];
const SOIL_KEYS = [...MAIN_SOIL, ...MORE_SOIL].map(([k]) => k);
const MAX_PREVIOUS = 20;
const LABEL = 'block text-sm font-medium text-[var(--color-text)] mb-1.5';

function toForm(plot) {
  const st = plot?.soilTest || {};
  return {
    name: plot?.name || '',
    area: plot?.area ?? '',
    areaUnit: plot?.areaUnit || 'acres',
    soilType: plot?.soilType || '',
    soil: Object.fromEntries(SOIL_KEYS.map((k) => [k, st[k] ?? ''])),
    testedOn: st.testedOn || '',
    waterSource: plot?.waterAccess?.source || '',
    waterMethod: plot?.waterAccess?.method || '',
    previousCrops: (plot?.previousCrops || []).map((p) => ({ id: p.id, crop: p.crop, season: p.season || '', year: p.year ?? '', notes: p.notes || '' })),
    copyFromFarm: false,
  };
}

// Form → API body. A new plot omits empty sections so "copy from the farm" can fill them;
// an edit sends every section so clearing a value really clears it.
function toBody(v, creating) {
  const soilTest = Object.fromEntries(SOIL_KEYS.filter((k) => v.soil[k] !== '' && v.soil[k] != null).map((k) => [k, Number(v.soil[k])]));
  if (v.testedOn) soilTest.testedOn = v.testedOn;
  const hasSoil = Object.keys(soilTest).length > 0;
  const prev = v.previousCrops
    .filter((p) => p.crop.trim())
    .map((p) => ({ ...(p.id && { id: p.id }), crop: p.crop.trim(), season: p.season, ...(p.year !== '' && { year: Number(p.year) }), notes: p.notes }));
  const body = { name: v.name.trim(), area: v.area === '' ? '' : Number(v.area), areaUnit: v.areaUnit };
  if (!creating || v.soilType) body.soilType = v.soilType;
  if (!creating || hasSoil) body.soilTest = hasSoil ? soilTest : null;
  if (!creating || v.waterSource || v.waterMethod) body.waterAccess = { source: v.waterSource, method: v.waterSource === 'Rain-fed' ? '' : v.waterMethod };
  if (!creating || prev.length) body.previousCrops = prev;
  if (creating && v.copyFromFarm) body.copyFromFarm = true;
  return body;
}

export default function PlotForm({ plot, cropNames = [], wholeFarm, onSubmit, onCancel }) {
  const creating = !plot;
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({ defaultValues: toForm(plot) });
  const { fields, append, remove } = useFieldArray({ control, name: 'previousCrops' });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const waterSource = watch('waterSource');
  const copy = watch('copyFromFarm');
  const thisYear = new Date().getFullYear();

  const submit = async (values) => {
    setSaving(true);
    setServerError(null);
    try {
      await onSubmit(toBody(values, creating));
    } catch (e) {
      setServerError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" data-testid="plot-form" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className={LABEL} htmlFor="plot-name">Plot name</label>
          <input id="plot-name" className="input" placeholder="e.g., North field" {...register('name', { required: 'Name is required', maxLength: { value: 60, message: 'At most 60 characters' } })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className={LABEL} htmlFor="plot-area">Area</label>
          <input id="plot-area" type="number" step="any" min="0" className="input" placeholder="e.g., 1"
            {...register('area', { required: 'Area is required', validate: (x) => Number(x) > 0 || 'Must be greater than 0' })} />
          {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
        </div>
        <div>
          <label className={LABEL} htmlFor="plot-unit">Unit</label>
          <select id="plot-unit" className="input" {...register('areaUnit')}>
            {AREA_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>

      {creating && wholeFarm?.hasFarmLevelData && (
        <label className="flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/20 text-xs text-[var(--color-text)] cursor-pointer">
          <input type="checkbox" className="mt-0.5" data-testid="copy-from-farm" {...register('copyFromFarm')} />
          <span>
            <b>Copy the farm’s whole-farm details into this plot</b> — {[
              wholeFarm.soilType && `soil type ${wholeFarm.soilType}`,
              wholeFarm.soilCardValues > 0 && `${wholeFarm.soilCardValues}/12 soil card values`,
              wholeFarm.waterSource && `water: ${wholeFarm.waterSource}`,
              wholeFarm.crops?.length > 0 && `crops: ${wholeFarm.crops.join(', ')}`,
            ].filter(Boolean).join(' · ') || 'none recorded'}. Anything you fill in below takes precedence. The farm record itself is not changed.
          </span>
        </label>
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--color-text)] mb-1">Soil {copy && <span className="font-normal text-xs text-[var(--color-text-muted)]">(empty fields will be copied from the farm)</span>}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className={LABEL} htmlFor="plot-soil-type">Soil type</label>
            <select id="plot-soil-type" className="input" {...register('soilType')}>
              <option value="">Not recorded</option>
              {SOIL_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {MAIN_SOIL.map(([k, label]) => (
            <div key={k}>
              <label className={LABEL} htmlFor={`plot-soil-${k}`}>{label}</label>
              <input id={`plot-soil-${k}`} type="number" step="any" min="0" className="input" {...register(`soil.${k}`)} />
            </div>
          ))}
        </div>
        <details className="rounded-xl border border-[var(--color-border)] p-3">
          <summary className="text-xs font-semibold cursor-pointer text-[var(--color-text)]">More Soil Health Card values (EC, OC, S, Zn, B, Fe, Cu, Mn) and test date</summary>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
            {MORE_SOIL.map(([k, label]) => (
              <div key={k}>
                <label className={LABEL} htmlFor={`plot-soil-${k}`}>{label}</label>
                <input id={`plot-soil-${k}`} type="number" step="any" min="0" className="input" {...register(`soil.${k}`)} />
              </div>
            ))}
            <div className="col-span-2">
              <label className={LABEL} htmlFor="plot-tested-on">Tested on</label>
              <input id="plot-tested-on" type="date" className="input" max={new Date().toISOString().slice(0, 10)} {...register('testedOn')} />
            </div>
          </div>
        </details>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="text-sm font-semibold text-[var(--color-text)] mb-1 col-span-2">Water access</legend>
        <div>
          <label className={LABEL} htmlFor="plot-water-source">Water source</label>
          <select id="plot-water-source" className="input" {...register('waterSource')}>
            <option value="">Not recorded</option>
            {WATER_SOURCES.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="plot-water-method">Irrigation method</label>
          <select id="plot-water-method" className="input" disabled={waterSource === 'Rain-fed'} {...register('waterMethod')}>
            <option value="">{waterSource === 'Rain-fed' ? 'None (rain-fed)' : 'Not recorded'}</option>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-[var(--color-text)] mb-2">Previous crops on this plot</legend>
        <datalist id="kb-crops">{cropNames.map((c) => <option key={c} value={c} />)}</datalist>
        <div className="space-y-2">
          {fields.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">None recorded.</p>}
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 items-center" data-testid="previous-crop-row">
              <input className="input col-span-5" list="kb-crops" placeholder="Crop" aria-label={`Previous crop ${i + 1}`} {...register(`previousCrops.${i}.crop`)} />
              <select className="input col-span-3" aria-label={`Season ${i + 1}`} {...register(`previousCrops.${i}.season`)}>
                <option value="">Season?</option>
                {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="input col-span-3" type="number" min="1990" max={thisYear} placeholder="Year" aria-label={`Year ${i + 1}`} {...register(`previousCrops.${i}.year`)} />
              <button type="button" onClick={() => remove(i)} className="col-span-1 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-[var(--color-text-muted)] hover:text-red-600" aria-label={`Remove previous crop ${i + 1}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {fields.length < MAX_PREVIOUS && (
          <button type="button" onClick={() => append({ crop: '', season: '', year: '', notes: '' })} className="mt-2 text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add previous crop
          </button>
        )}
      </fieldset>

      {serverError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs" role="alert" data-testid="plot-error">
          <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {serverError.details?.length ? 'Please correct the following:' : serverError.message}</p>
          {serverError.details?.length > 0 && <ul className="list-disc ml-5 mt-1">{serverError.details.map((d) => <li key={d}>{friendlyMessage(d)}</li>)}</ul>}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2" data-testid="plot-save">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {creating ? 'Add plot' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
