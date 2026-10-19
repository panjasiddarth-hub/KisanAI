import { useState } from 'react';
import { api } from '../../api/client';
import { isConfirmedLocation, useFarms } from '../../hooks/useFarms';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ProgressBar from '../../components/ui/ProgressBar';
import FarmLocationField from '../../components/farms/FarmLocationField';
import toast from 'react-hot-toast';
import {
  Warehouse, Plus, Edit2, Trash2, MapPin, Ruler, Droplets, Loader2,
  ChevronLeft, ChevronRight, Save, Sprout, ClipboardList, CircleCheck, FileText, Upload, ExternalLink,
} from 'lucide-react';

const STEPS = [
  { key: 'basic', title: 'Add your farm', hint: 'Just add a name, approximate land size, and mark your farm on the map.' },
  { key: 'review', title: 'Review and save', hint: 'Check your farm profile before saving.' },
];

const FIELD_GROUPS = {
  basic: [
    { path: 'basic.name', label: 'What do you call your farm?', placeholder: 'e.g., Our farm', required: true },
    { path: 'basic.area', label: 'About how much land?', placeholder: 'e.g., 2', type: 'number', min: '0.01', step: 'any', required: true },
    { path: 'basic.areaUnit', label: 'Area unit', options: ['acres', 'hectares', 'bigha', 'other'] },
  ],
  soil: [
    { path: 'soil.soilType', label: 'Soil type', options: ['unknown', 'red', 'black', 'alluvial', 'sandy', 'loamy', 'clayey', 'other'] },
    { path: 'soil.phKnown', label: 'Do you know your soil pH?', options: ['unknown', 'yes'] },
    { path: 'soil.ph', label: 'Soil pH (if known)', type: 'number', min: '0', max: '14', step: '0.1' },
    { path: 'soil.nitrogen', label: 'Nitrogen (N), kg/ha if tested', type: 'number', min: '0', step: 'any' },
    { path: 'soil.phosphorus', label: 'Phosphorus (P), kg/ha if tested', type: 'number', min: '0', step: 'any' },
    { path: 'soil.potassium', label: 'Potassium (K), kg/ha if tested', type: 'number', min: '0', step: 'any' },
    { path: 'soil.soilTestStatus', label: 'Soil test status', options: ['not_tested', 'tested', 'want_test'] },
    { path: 'soil.soilTestDate', label: 'Soil test date (optional)', type: 'date' },
    { path: 'soil.organicCarbon', label: 'Organic carbon / fertility notes (optional)' },
    { path: 'soil.drainage', label: 'Drainage / waterlogging', options: ['unknown', 'well_drained', 'occasional_waterlogging', 'frequent_waterlogging'] },
    { path: 'soil.slope', label: 'Slope', options: ['unknown', 'flat', 'gentle', 'steep'] },
    { path: 'soil.erosion', label: 'Erosion concerns (optional)' },
  ],
  water: [
    { path: 'water.mainSource', label: 'Main water source', options: ['unknown', 'borewell', 'open_well', 'canal', 'river', 'farm_pond', 'rainwater', 'other'] },
    { path: 'water.secondarySources', label: 'Other water sources (optional)' },
    { path: 'water.availability', label: 'Water availability', options: ['unknown', 'reliable', 'seasonal', 'limited', 'uncertain', 'rainfed'] },
    { path: 'water.summerAvailability', label: 'Water in summer / dry periods', options: ['unknown', 'available', 'limited', 'not_available'] },
    { path: 'water.method', label: 'Irrigation method', options: ['unknown', 'drip', 'sprinkler', 'flood', 'furrow', 'other'] },
    { path: 'water.frequency', label: 'Typical irrigation frequency (optional)' },
    { path: 'water.quality', label: 'Water quality / salinity (optional)' },
    { path: 'water.storage', label: 'Water storage facilities (optional)' },
    { path: 'water.equipmentAvailable', label: 'Irrigation equipment available?', options: ['unknown', 'yes', 'no'] },
  ],
  activities: [
    { path: 'activities.residue', label: 'Crop residue management', options: ['unknown', 'incorporated', 'composted', 'mulched', 'animal_feed', 'removed', 'burned', 'other'] },
    { path: 'activities.burningFrequency', label: 'Residue burning frequency (optional)' },
    { path: 'activities.tillage', label: 'Tillage', options: ['unknown', 'conventional', 'reduced', 'minimum', 'zero_tillage'] },
    { path: 'activities.preparation', label: 'Field preparation methods (optional)' },
    { path: 'activities.coverCrop', label: 'Green manure / cover crop (optional)' },
    { path: 'activities.organicAmendment', label: 'Manure / compost used (optional)' },
    { path: 'activities.previousFertilizer', label: 'Previous fertilizer applications (optional)' },
    { path: 'activities.conservation', label: 'Soil conservation methods (optional)' },
    { path: 'activities.fallowPeriod', label: 'Fallow period / previous waterlogging (optional)' },
    { path: 'activities.notes', label: 'Other field notes (optional)', multiline: true },
  ],
  preferences: [
    { path: 'preferences.season', label: 'Season to plan for', options: ['kharif', 'rabi', 'zaid'] },
    { path: 'preferences.budget', label: 'Season cultivation budget (optional)', type: 'number', min: '0', step: 'any' },
    { path: 'preferences.perAcreBudget', label: 'Budget per acre (optional)', type: 'number', min: '0', step: 'any' },
    { path: 'preferences.workingCapital', label: 'Working capital (optional)', type: 'number', min: '0', step: 'any' },
    { path: 'preferences.creditAccess', label: 'Loan / credit access (optional)', options: ['Prefer not to say', 'No', 'Yes'] },
    { path: 'preferences.equipment', label: 'Machinery and equipment (optional)' },
    { path: 'preferences.labor', label: 'Family / hired labor availability (optional)' },
    { path: 'preferences.inputsPurchased', label: 'Seeds or fertilizers already purchased (optional)' },
    { path: 'preferences.preferredCropsText', label: 'Preferred crops (comma separated)' },
    { path: 'preferences.avoidedCropsText', label: 'Crops to avoid (comma separated)' },
    { path: 'preferences.risk', label: 'Risk preference', options: ['unknown', 'low', 'medium', 'high'] },
    { path: 'preferences.goal', label: 'Main goal', options: ['unknown', 'maximum_profit', 'stable_income', 'lower_water', 'household_food', 'soil_improvement', 'balanced'] },
    { path: 'preferences.preferredHarvest', label: 'Preferred harvest period (optional)' },
    { path: 'preferences.sustainablePractices', label: 'Open to sustainable practices?', options: ['unknown', 'yes', 'no'] },
  ],
  market: [
    { path: 'market.nearestMandi', label: 'Nearest mandi / market (optional)' },
    { path: 'market.travel', label: 'Distance or travel time (optional)' },
    { path: 'market.buyerAccess', label: 'FPO, cooperative, trader, processor, or direct buyer (optional)' },
    { path: 'market.transport', label: 'Transport access (optional)' },
    { path: 'market.storage', label: 'Storage / cold storage (optional)' },
    { path: 'market.contractFarming', label: 'Contract farming availability (optional)' },
    { path: 'market.cropsSold', label: 'Crops commonly sold (optional)' },
    { path: 'market.minimumPrice', label: 'Minimum acceptable selling price (optional)', type: 'number', min: '0', step: 'any' },
  ],
};

const emptyProfile = () => ({
  basic: { areaUnit: 'acres', coordinates: null, locationLabel: '', locationSource: '' },
  soil: { soilType: 'unknown', phKnown: 'unknown', soilTestStatus: 'not_tested', drainage: 'unknown', slope: 'unknown' },
  water: { mainSource: 'unknown', availability: 'unknown', summerAvailability: 'unknown', method: 'unknown', equipmentAvailable: 'unknown' },
  cropHistory: [],
  activities: { residue: 'unknown', tillage: 'unknown' },
  preferences: { risk: 'unknown', goal: 'unknown', sustainablePractices: 'unknown' },
  market: {},
});

function hydrateProfile(profile = {}) {
  const defaults = emptyProfile();
  return {
    ...defaults,
    ...profile,
    basic: { ...defaults.basic, ...(profile.basic || {}) },
    soil: { ...defaults.soil, ...(profile.soil || {}) },
    water: { ...defaults.water, ...(profile.water || {}) },
    cropHistory: profile.cropHistory || [],
    activities: { ...defaults.activities, ...(profile.activities || {}) },
    preferences: { ...defaults.preferences, ...(profile.preferences || {}) },
    market: { ...defaults.market, ...(profile.market || {}) },
  };
}

const getAt = (object, path) => path.split('.').reduce((value, key) => value?.[key], object) ?? '';
const setAt = (object, path, value) => {
  const keys = path.split('.');
  const result = structuredClone(object);
  let target = result;
  for (const key of keys.slice(0, -1)) target = target[key] ||= {};
  target[keys.at(-1)] = value;
  return result;
};

function normalizeProfile(profile) {
  const result = structuredClone(profile);
  result.basic ||= {};
  result.soil ||= {};
  result.water ||= {};
  result.cropHistory ||= [];
  result.activities ||= {};
  result.preferences ||= {};
  result.market ||= {};
  const parseList = (value) => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  result.preferences.preferredCrops = parseList(result.preferences.preferredCropsText);
  result.preferences.avoidedCrops = parseList(result.preferences.avoidedCropsText);
  const basic = result.basic;
  result.name = basic.name?.trim();
  result.location = basic.locationLabel || [basic.village, basic.mandal, basic.district, basic.state, basic.pinCode]
    .filter(Boolean).join(', ');
  result.coordinates = basic.coordinates || undefined;
  result.area = Number(basic.area);
  result.areaUnit = basic.areaUnit || 'acres';
  result.soilType = result.soil.soilType === 'unknown' ? '' : result.soil.soilType;
  result.waterSource = result.water.mainSource === 'unknown' ? '' : result.water.mainSource;
  result.soilTest = Object.fromEntries(
    ['N', 'P', 'K', 'ph', 'ec', 'oc', 's', 'zn', 'b', 'fe', 'cu', 'mn', 'testedOn']
      .filter(key => result.soilTest?.[key] !== '' && result.soilTest?.[key] != null
        && (key === 'testedOn' || Number.isFinite(Number(result.soilTest[key]))))
      .map(key => [key, key === 'testedOn' ? result.soilTest[key] : Number(result.soilTest[key])])
  );
  result.soilReport ||= null;
  if (result.soilReport) {
    result.soilReport = {
      ...result.soilReport,
      ...(result.reportSummary !== undefined && { summary: result.reportSummary }),
      ...(result.printedAdvice !== undefined && { printedAdvice: result.printedAdvice }),
    };
  }
  return result;
}

function farmWritePayload(profile) {
  const normalized = normalizeProfile(profile);
  return {
    name: normalized.name,
    location: normalized.location,
    area: normalized.area,
    areaUnit: normalized.areaUnit,
    soilType: normalized.soilType,
    waterSource: normalized.waterSource,
    coordinates: normalized.coordinates,
    soilTest: Object.keys(normalized.soilTest).length ? normalized.soilTest : null,
    soilReport: normalized.soilReport,
    cropHistory: normalized.cropHistory,
    profile: normalized,
  };
}

function FarmCard({ farm, onEdit, onDelete, onPlan, onDetails }) {
  const profile = farm.profile || {};
  const basic = profile.basic || {};
  const water = profile.water || {};
  const history = farm.cropHistory || profile.cropHistory || [];
  const filled = [
    farm.name,
    Number(farm.area) > 0,
    isConfirmedLocation(farm.coordinates),
  ].filter(Boolean).length;
  const completion = Math.round((filled / 3) * 100);
  const soilType = profile.soil?.soilType || farm.soilType;
  const waterSource = water.availability && water.availability !== 'unknown'
    ? water.availability
    : farm.waterSource;
  return (
    <article className="card p-5 fade-in">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow shrink-0">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-[var(--color-text)] truncate">{farm.name}</h3>
            <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <MapPin className="w-3 h-3 shrink-0" /> {farm.location || 'Location not added'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button aria-label={`Edit ${farm.name}`} onClick={() => onEdit(farm)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-[var(--color-text-muted)]"><Edit2 className="w-4 h-4" /></button>
          <button aria-label={`Delete ${farm.name}`} onClick={() => onDelete(farm.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-[var(--color-text-muted)]"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Ruler className="w-4 h-4 text-green-600 shrink-0" />
          <div><p className="text-[0.65rem] text-[var(--color-text-muted)]">Cultivable area</p><p className="text-xs font-bold text-[var(--color-text)]">{farm.area || '—'} {farm.areaUnit}</p></div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Droplets className="w-4 h-4 text-blue-600 shrink-0" />
        <div><p className="text-[0.65rem] text-[var(--color-text-muted)]">Water / irrigation</p><p className="text-xs font-bold text-[var(--color-text)]">{waterSource && waterSource !== 'unknown' ? waterSource : 'Not added'}</p></div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mb-3 text-xs">
      <span className="text-[var(--color-text-muted)]">Soil: <b className="text-[var(--color-text)]">{soilType && soilType !== 'unknown' ? soilType : 'Not added'}</b></span>
        <span className="badge badge-green">{history.length} prior crop record{history.length === 1 ? '' : 's'}</span>
      </div>
      <div className="flex gap-1 flex-wrap mb-4">
        {(farm.crops || []).map(crop => <span key={crop} className="badge badge-green">{crop}</span>)}
        {history.slice(-2).map((entry, index) => <span key={`${entry.crop}-${index}`} className="badge badge-blue">Previous: {entry.crop}</span>)}
        {!(farm.crops || []).length && !history.length && <span className="text-xs text-[var(--color-text-muted)]">No crops recorded yet</span>}
      </div>
      <ProgressBar value={completion} label={`Farm profile ${completion}% complete`} color={completion >= 80 ? 'green' : 'yellow'} />
      {basic.ownership && <p className="text-xs text-[var(--color-text-muted)] mt-2">Land: {basic.ownership}{basic.plotCount ? ` · ${basic.plotCount} plot(s)` : ''}</p>}
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => onPlan(farm)} className="btn-primary flex items-center gap-2 text-xs"><Sprout className="w-4 h-4" /> Plan crops</button>
        <button onClick={() => onDetails(farm)} className="btn-secondary flex items-center gap-2 text-xs"><ClipboardList className="w-4 h-4" /> Details & history</button>
      </div>
    </article>
  );
}

function ProfileField({ field, profile, setProfile }) {
  const value = getAt(profile, field.path);
  const update = (event) => setProfile(current => setAt(current, field.path, event.target.value));
  const inputProps = {
    id: field.path,
    name: field.path,
    className: 'input text-sm',
    value,
    onChange: update,
    placeholder: field.placeholder,
    required: Boolean(field.required),
    'aria-required': field.required ? 'true' : undefined,
    min: field.min,
    max: field.max,
    step: field.step,
    inputMode: field.inputMode,
  };
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor={field.path}>
        {field.label}{field.required && ' *'}
      </label>
      {field.options
        ? <select {...inputProps}><option value="">Choose / not sure</option>{field.options.map(option => <option key={option} value={option}>{option === 'unknown' ? 'I don’t know' : option.replaceAll('_', ' ')}</option>)}</select>
        : field.multiline
          ? <textarea {...inputProps} rows="3" />
          : <input {...inputProps} type={field.type || 'text'} />}
    </div>
  );
}

function CropHistoryFields({ profile, setProfile }) {
  const rows = profile.cropHistory || [];
  const updateRow = (index, key, value) => {
    const cropHistory = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
    setProfile(current => ({ ...current, cropHistory }));
  };
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div className="rounded-xl border border-[var(--color-border)] p-3" key={row.id || index}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Crop<input className="input mt-1" value={row.crop || ''} onChange={e => updateRow(index, 'crop', e.target.value)} /></label>
            <label className="text-sm">Season<input className="input mt-1" placeholder="e.g. kharif" value={row.season || ''} onChange={e => updateRow(index, 'season', e.target.value)} /></label>
            <label className="text-sm">Year<input className="input mt-1" type="number" min="1900" max="2100" value={row.year || ''} onChange={e => updateRow(index, 'year', e.target.value)} /></label>
            <label className="text-sm">Outcome<select className="input mt-1" value={row.outcome || 'unknown'} onChange={e => updateRow(index, 'outcome', e.target.value)}><option value="unknown">Not sure</option><option value="successful">Successful</option><option value="partial">Partially successful</option><option value="failed">Failed</option></select></label>
            <label className="text-sm">Sowing date<input className="input mt-1" type="date" value={row.sowingDate || ''} onChange={e => updateRow(index, 'sowingDate', e.target.value)} /></label>
            <label className="text-sm">Harvest date<input className="input mt-1" type="date" value={row.harvestDate || ''} onChange={e => updateRow(index, 'harvestDate', e.target.value)} /></label>
            <label className="text-sm">Yield and unit (optional)<input className="input mt-1" placeholder="e.g. 8 quintals/acre" value={row.yield || ''} onChange={e => updateRow(index, 'yield', e.target.value)} /></label>
            <label className="text-sm">Revenue / cultivation cost (optional)<input className="input mt-1" placeholder="Amounts if known" value={row.finances || ''} onChange={e => updateRow(index, 'finances', e.target.value)} /></label>
            <label className="text-sm sm:col-span-2">Inputs, pests, or disease issues (optional)<textarea className="input mt-1" rows="2" value={row.issues || ''} onChange={e => updateRow(index, 'issues', e.target.value)} /></label>
            {row.outcome === 'failed' && <label className="text-sm sm:col-span-2">Reason for failure (optional)<input className="input mt-1" value={row.failureReason || ''} onChange={e => updateRow(index, 'failureReason', e.target.value)} /></label>}
          </div>
          <button className="text-xs text-red-600 mt-2" type="button" onClick={() => setProfile(current => ({ ...current, cropHistory: rows.filter((_, rowIndex) => rowIndex !== index) }))}>Remove record</button>
        </div>
      ))}
      {rows.length < 5 && <button type="button" className="btn-secondary text-sm" onClick={() => setProfile(current => ({ ...current, cropHistory: [...(current.cropHistory || []), { crop: '', season: '', year: '', outcome: 'unknown' }] }))}><Plus className="inline w-4 h-4 mr-1" /> Add previous crop</button>}
    </div>
  );
}

const SOIL_REPORT_FIELDS = [
  ['N', 'Nitrogen (N)'], ['P', 'Phosphorus (P)'], ['K', 'Potassium (K)'], ['ph', 'pH'],
  ['ec', 'EC'], ['oc', 'Organic carbon'], ['s', 'Sulphur'], ['zn', 'Zinc'],
  ['b', 'Boron'], ['fe', 'Iron'], ['cu', 'Copper'], ['mn', 'Manganese'],
];

function SoilReportUpload({ profile, setProfile, reading, onReadFile, onViewReport, farmId, onRemoveReport }) {
  const soilTest = profile.soilTest || {};
  const changeSoilValue = (key, value) => setProfile(current => ({
    ...current,
    soilTest: { ...(current.soilTest || {}), [key]: value },
  }));

  return (
    <section className="rounded-xl border border-[var(--color-border)] p-3 space-y-3" data-testid="soil-report-upload">
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-green-600" /> Have a soil test report?</h4>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Upload a photo or PDF. Gemini will read the report and explain it simply. Your report is sent to Google for reading; check the extracted numbers against your original.
        </p>
      </div>
      <label className="flex flex-wrap items-center gap-2">
        <span className="sr-only">Upload soil test report</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={reading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onReadFile(file);
            event.target.value = '';
          }}
          className="block w-full text-xs text-[var(--color-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-green-700 hover:file:bg-green-100" />
        {reading && <span className="inline-flex items-center gap-1.5 text-xs text-green-700"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your report…</span>}
        <span className="inline-flex items-center gap-1 text-[0.68rem] text-[var(--color-text-muted)]"><Upload className="w-3.5 h-3.5" /> PDF, JPG, PNG or WebP · max 8 MB</span>
      </label>
      {profile.soilReport && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5"><FileText className="w-4 h-4 shrink-0" /> {profile.soilReport.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              {farmId && <button type="button" onClick={onViewReport} className="text-xs font-semibold text-green-700 underline inline-flex items-center gap-1">View <ExternalLink className="w-3 h-3" /></button>}
              <button type="button" onClick={onRemoveReport} className="text-xs text-red-600 underline">Remove</button>
            </div>
          </div>
          {profile.reportSummary && <p className="text-xs text-[var(--color-text)]">{profile.reportSummary}</p>}
          {profile.printedAdvice?.length > 0 && (
            <div className="text-xs text-[var(--color-text)]">
              <p className="font-semibold">Advice printed on your report</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">{profile.printedAdvice.map((advice, index) => <li key={`${index}-${advice}`}>{advice}</li>)}</ul>
            </div>
          )}
          <p className="text-[0.68rem] text-amber-700 dark:text-amber-400">Please compare these readings with your report. You can correct any number before saving.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SOIL_REPORT_FIELDS.slice(0, 4).map(([key, label]) => (
              <label className="text-[0.68rem] text-[var(--color-text-muted)]" key={key}>
                {label}
                <input type="number" min="0" step="any" max={key === 'ph' ? 14 : undefined}
                  value={soilTest[key] ?? ''} onChange={(event) => changeSoilValue(key, event.target.value)}
                  className="input !py-2 text-sm mt-1" aria-label={label} />
              </label>
            ))}
          </div>
          <details>
            <summary className="text-xs font-semibold cursor-pointer">Other report values</summary>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {SOIL_REPORT_FIELDS.slice(4).map(([key, label]) => (
                <label className="text-[0.68rem] text-[var(--color-text-muted)]" key={key}>
                  {label}
                  <input type="number" min="0" step="any" value={soilTest[key] ?? ''}
                    onChange={(event) => changeSoilValue(key, event.target.value)}
                    className="input !py-2 text-sm mt-1" aria-label={label} />
                </label>
              ))}
              <label className="text-[0.68rem] text-[var(--color-text-muted)]">Test date
                <input type="date" value={soilTest.testedOn || ''}
                  onChange={(event) => changeSoilValue('testedOn', event.target.value)}
                  className="input !py-2 text-sm mt-1" />
              </label>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function FarmWizard({
  profile, setProfile, step, setStep, onSaveDraft, onSubmit, submitting, editing,
  readingReport, onReadReport, onViewReport, onRemoveReport, farmId,
}) {
  const current = STEPS[step];
  const setField = (field) => <ProfileField key={field.path} field={field} profile={profile} setProfile={setProfile} />;
  const details = normalizeProfile(profile);
  // Step 1 only requires the farm name and a positive area.
  // Let the user continue even if they have not confirmed the map pin yet.
  const stepValid = step !== 0 || (
    Boolean(details.name?.trim()) && Number(details.area) > 0
  );
  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-2"><span>Step {step + 1} of {STEPS.length}</span><span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span></div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <div className="hidden md:grid grid-cols-2 gap-1 mt-3" aria-label="Farm profile steps">
          {STEPS.map((item, index) => <button type="button" key={item.key} onClick={() => setStep(index)} aria-label={`Go to ${item.title}`} className={`h-1.5 rounded-full ${index <= step ? 'bg-green-600' : 'bg-gray-200 dark:bg-slate-700'}`} />)}
        </div>
      </div>
      <div><h4 className="font-bold text-lg text-[var(--color-text)]">{current.title}</h4><p className="text-sm text-[var(--color-text-muted)] mt-1">{current.hint}</p></div>
      {current.key === 'history'
        ? <CropHistoryFields profile={profile} setProfile={setProfile} />
        : current.key === 'review'
          ? <div className="space-y-3">
            {STEPS.filter(section => section.key !== 'review').map(section => (
              <section className="rounded-xl border border-[var(--color-border)] p-4" key={section.key}>
                <div className="flex justify-between items-center"><h5 className="font-semibold text-sm">{section.title}</h5><button type="button" className="text-xs text-green-700" onClick={() => setStep(STEPS.findIndex(s => s.key === section.key))}>Edit</button></div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {section.key === 'history'
                    ? `${(profile.cropHistory || []).filter(item => item.crop?.trim()).length} previous crop records`
                    : section.key === 'basic'
                      ? `${details.name} · ${details.area} ${details.areaUnit} · ${details.location || 'No location selected'}`
                      : (FIELD_GROUPS[section.key] || []).map(field => getAt(profile, field.path)).filter(Boolean).slice(0, 4).join(' · ') || 'No details provided'}
                </p>
              </section>
            ))}
            <p className="text-sm text-[var(--color-text-muted)]">Soil and water details are optional. We’ll use your selected location for nearby place and weather information; a map cannot determine soil test results.</p>
          </div>
          : <div className="grid sm:grid-cols-2 gap-4">
            {(FIELD_GROUPS[current.key] || []).map(setField)}
          </div>}
      {current.key === 'basic' && (
        <>
          <FarmLocationField
            value={profile.basic.coordinates}
            onChange={(coordinates) => setProfile(currentProfile => ({
              ...currentProfile,
              basic: {
                ...currentProfile.basic,
                coordinates,
                latitude: coordinates.lat,
                longitude: coordinates.lon,
                locationLabel: coordinates.label,
                locationSource: coordinates.source,
              },
            }))}
          />
          {!isConfirmedLocation(profile.basic.coordinates) && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Tap your farm on the map or drag the pin before continuing.</p>
          )}
          <SoilReportUpload
            profile={profile}
            setProfile={setProfile}
            reading={readingReport}
            onReadFile={onReadReport}
            onViewReport={onViewReport}
            onRemoveReport={onRemoveReport}
            farmId={farmId}
          />
          <details className="rounded-xl border border-[var(--color-border)] p-3">
            <summary className="text-sm font-semibold cursor-pointer">Add soil or water details if you know them (optional)</summary>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Not sure? Leave these blank and continue.</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              {[FIELD_GROUPS.soil[0], FIELD_GROUPS.water[0], FIELD_GROUPS.water[2]].map(setField)}
            </div>
          </details>
        </>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 border-t border-[var(--color-border)] pt-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || submitting} className="btn-secondary flex items-center gap-1 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /> Back</button>
          {!editing && <button type="button" onClick={onSaveDraft} disabled={submitting} className="btn-secondary flex items-center gap-1 disabled:opacity-50"><Save className="w-4 h-4" /> Save draft</button>}
        </div>
        {step < STEPS.length - 1
          ? <button type="button" disabled={!stepValid} onClick={() => setStep(step + 1)} className="btn-primary flex items-center justify-center gap-1 disabled:opacity-50">Continue <ChevronRight className="w-4 h-4" /></button>
          : <button type="button" disabled={submitting || !stepValid} onClick={onSubmit} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}{editing ? 'Save farm profile' : 'Save farm profile'}</button>}
      </div>
    </div>
  );
}

function RecommendationResults({ result, farm, onSelect, selecting }) {
  if (!result) return null;
  const recommendation = result.recommendation;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-4">
        <h4 className="font-bold">Crop shortlist for {farm.name}</h4>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{recommendation.source} Season: {recommendation.season}.</p>
      </div>
      {recommendation.recommendations.map(item => (
        <article className="card p-4" key={item.crop}>
          <div className="flex justify-between gap-3 items-start">
            <div><h5 className="font-bold">{item.crop}</h5><p className="text-xs text-[var(--color-text-muted)] mt-1">{item.scoreLabel}</p></div>
            <span className="badge badge-green">{item.score}/100</span>
          </div>
          <ul className="list-disc pl-5 my-3 text-sm space-y-1">{item.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
          <p className="text-xs text-[var(--color-text-muted)]">Water need: {item.waterNeed}. Estimated cost, market price, and yield: not available from a verified source.</p>
          {item.fertilizer && !item.fertilizer.error && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Fertilizer guidance: existing rule engine; verify locally before application.</p>}
          {item.fertilizer && !item.fertilizer.error && <p className="text-xs text-[var(--color-text-muted)]">Rule-based NPK per acre: N {item.fertilizer.perAcre.nutrients.N} kg, P₂O₅ {item.fertilizer.perAcre.nutrients.P2O5} kg, K₂O {item.fertilizer.perAcre.nutrients.K2O} kg. Adjust using a recent soil test and local agricultural advice.</p>}
          {item.modelPrediction != null && <p className="text-xs text-[var(--color-text-muted)]">Crop model output for this crop: {Number(item.modelPrediction).toFixed(3)} (model output, not a yield or profit estimate).</p>}
          <button disabled={selecting} onClick={() => onSelect(item.crop)} className="btn-secondary mt-3 text-sm disabled:opacity-50">{selecting ? 'Saving…' : 'Choose this crop'}</button>
        </article>
      ))}
      <section className="rounded-xl border border-[var(--color-border)] p-4">
        <h5 className="font-semibold text-sm">Information sources</h5>
        <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
          {Object.entries(recommendation.agents).map(([key, agent]) => <p key={key}><b className="capitalize">{key.replaceAll(/([A-Z])/g, ' $1')}</b>: {agent.status}{agent.reason ? ` — ${agent.reason}` : ` — ${agent.source}`}</p>)}
        </div>
        {recommendation.missingInformation.length > 0 && <p className="text-xs mt-3"><b>Could improve this shortlist:</b> {recommendation.missingInformation.join(', ')}.</p>}
      </section>
      <p className="text-xs text-[var(--color-text-muted)]">{recommendation.assumptions.join(' ')}</p>
    </div>
  );
}

export default function Farms() {
  const { farms, drafts, loading, updateFarm, deleteFarm, saveDraft, completeDraft } = useFarms();
  const navigate = useNavigate();
  const [editor, setEditor] = useState(null);
  const [profile, setProfile] = useState(emptyProfile());
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [readingReport, setReadingReport] = useState(false);
  const [detailsFarm, setDetailsFarm] = useState(null);
  const [planningFarm, setPlanningFarm] = useState(null);
  const [planResult, setPlanResult] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const openNew = () => { setProfile(emptyProfile()); setStep(0); setEditor({ draftId: null, draftReportId: null, farm: null }); };
  const openDraft = (draft) => { setProfile(hydrateProfile(draft.profile)); setStep(0); setEditor({ draftId: draft.id, draftReportId: draft.soilReport?.id || null, farm: null }); };
  const openEdit = (farm) => {
    setProfile(hydrateProfile({
      ...farm.profile,
      basic: {
        ...farm.profile?.basic,
        name: farm.name,
        area: farm.area,
        areaUnit: farm.areaUnit,
        village: farm.location,
        coordinates: farm.coordinates || farm.profile?.basic?.coordinates || null,
        locationLabel: farm.coordinates?.label || farm.profile?.basic?.locationLabel || farm.location || '',
      },
      soilTest: farm.soilTest || farm.profile?.soilTest || {},
      soilReport: farm.soilReport || farm.profile?.soilReport || null,
      reportSummary: farm.soilReport?.summary || farm.profile?.reportSummary || '',
      printedAdvice: farm.soilReport?.printedAdvice || farm.profile?.printedAdvice || [],
      soil: { ...farm.profile?.soil, soilType: farm.soilType || farm.profile?.soil?.soilType || 'unknown' },
      water: { mainSource: farm.waterSource || 'unknown', ...farm.profile?.water },
      cropHistory: farm.profile?.cropHistory || farm.cropHistory || [],
    }));
    setStep(0);
    setEditor({ draftId: null, draftReportId: null, farm });
  };

  const readReport = async (file) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Report too large. Choose a file smaller than 8 MB.');
      return;
    }
    setReadingReport(true);
    try {
      const formData = new FormData();
      formData.append('report', file);
      const { data } = await api.post('/farms/soil-reports/parse', formData);
      const soilTest = data.soilTest || {};
      const attachedReportId = editor?.farm?.soilReport?.id || editor?.draftReportId;
      const previousReport = profile.soilReport;
      setProfile(current => ({
        ...current,
        soilTest,
        soilReport: { ...data.report, summary: data.farmerSummary, printedAdvice: data.printedAdvice },
        reportSummary: data.farmerSummary,
        printedAdvice: data.printedAdvice,
        soil: {
          ...current.soil,
          ...(data.soilType && { soilType: data.soilType }),
          ...(soilTest.ph != null && { ph: String(soilTest.ph), phKnown: 'yes' }),
          ...(soilTest.N != null && { nitrogen: String(soilTest.N) }),
          ...(soilTest.P != null && { phosphorus: String(soilTest.P) }),
          ...(soilTest.K != null && { potassium: String(soilTest.K) }),
          soilTestStatus: 'tested',
          ...(soilTest.testedOn && { soilTestDate: soilTest.testedOn }),
        },
      }));
      if (previousReport?.id && previousReport.id !== attachedReportId) {
        try {
          await api.delete(`/farms/soil-reports/${previousReport.id}`);
        } catch (error) {
          toast.error(error?.response?.data?.error || 'The previous report could not be removed.');
        }
      }
      toast.success('Soil report read. Please check the extracted values against your report.');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Could not read this soil report.');
    } finally {
      setReadingReport(false);
    }
  };

  const removeReport = async () => {
    const report = profile.soilReport;
    setProfile(current => ({ ...current, soilReport: null, reportSummary: '', printedAdvice: [] }));
    if (report?.id && report.id !== (editor?.farm?.soilReport?.id || editor?.draftReportId)) {
      try {
        await api.delete(`/farms/soil-reports/${report.id}`);
      } catch (error) {
        toast.error(error?.response?.data?.error || 'The report could not be removed.');
      }
    }
  };

  const viewReport = async () => {
    if (!editor?.farm?.id) return;
    const reportWindow = window.open('about:blank', '_blank');
    if (!reportWindow) {
      toast.error('Allow pop-ups to view your saved soil report.');
      return;
    }
    reportWindow.opener = null;
    try {
      const { data } = await api.get(`/farms/${editor.farm.id}/soil-report`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      reportWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      reportWindow.close();
      toast.error(error?.response?.data?.error || 'Could not open the saved soil report.');
    }
  };

  const saveProfileDraft = async () => {
    setSubmitting(true);
    try {
      const draft = await saveDraft(normalizeProfile(profile), editor.draftId);
      setEditor(current => ({ ...current, draftId: draft.id, draftReportId: draft.soilReport?.id || null }));
      toast.success('Farm profile draft saved.');
    } catch { /* hook reports save failures */ }
    finally { setSubmitting(false); }
  };

  const submitProfile = async () => {
    const normalized = normalizeProfile(profile);

    if (!normalized.name || !Number.isFinite(normalized.area) || normalized.area <= 0) {
      toast.error('Enter a farm name and a land area greater than zero.');
      setStep(0);
      return;
    }

    // Location is not required to move to the review step, but it is required
    // before the farm profile is saved.
    if (!isConfirmedLocation(profile.basic?.coordinates)) {
      toast.error('Please confirm your farm location on the map before saving.');
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      let savedFarm;
      if (editor.farm) {
        savedFarm = await updateFarm(editor.farm.id, farmWritePayload(profile));
      } else {
        const draft = editor.draftId
          ? { id: editor.draftId }
          : await saveDraft(normalized);
        savedFarm = await completeDraft(draft.id, normalized);
      }
      toast.success('Your farm profile is ready. Generate a crop shortlist from your saved details; unavailable data will be clearly marked.');
      setEditor(null);
      if (savedFarm?.soilReport) {
        navigate(`/agents/crop?farmId=${encodeURIComponent(savedFarm.id)}&autostart=1`);
      }
    } catch { /* hook reports API errors */ }
    finally { setSubmitting(false); }
  };

  const removeFarm = async (id) => {
    if (!window.confirm('Delete this farm? This cannot be undone.')) return;
    try { await deleteFarm(id); toast.success('Farm deleted.'); }
    catch { /* hook reports API errors */ }
  };

  const closeEditor = async () => {
    if (submitting || readingReport || !editor) return;
    const report = profile.soilReport;
    setEditor(null);
    if (report?.id && report.id !== (editor.farm?.soilReport?.id || editor.draftReportId)) {
      try {
        await api.delete(`/farms/soil-reports/${report.id}`);
      } catch (error) {
        toast.error(error?.response?.data?.error || 'The uploaded report could not be removed.');
      }
    }
  };

  const generatePlan = async (farm) => {
    setPlanningFarm(farm);
    setPlanResult(null);
    setPlanBusy(true);
    try {
      const { data } = await api.post(`/farms/${farm.id}/recommendations`, {});
      setPlanResult(data);
    } catch (error) {
      const message = error?.response?.data?.error || 'Could not generate a crop shortlist.';
      const missing = error?.response?.data?.missingInformation;
      toast.error(missing?.length ? `${message} Add: ${missing.join(', ')}.` : message);
    } finally { setPlanBusy(false); }
  };

  const chooseCrop = async (crop) => {
    setSelecting(true);
    try {
      await api.post(`/farms/${planningFarm.id}/recommendations/${planResult.recommendation.id}/select`, { crop });
      toast.success(`${crop} saved to recommendation history.`);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Could not save crop selection.');
    } finally { setSelecting(false); }
  };

  return (
    <div className="page-content">
      <PageHeader title="My Farm" subtitle={`${farms.length} farm${farms.length !== 1 ? 's' : ''} registered`}>
        <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Add New Farm</button>
      </PageHeader>
      {drafts.length > 0 && <section className="card p-4 mb-4"><h3 className="font-semibold mb-2">Saved drafts</h3><div className="flex flex-wrap gap-2">{drafts.map(draft => <button className="btn-secondary text-sm" key={draft.id} onClick={() => openDraft(draft)}>{draft.name || 'Untitled farm'} · Continue</button>)}</div></section>}
      {loading
        ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading farms">{[1, 2, 3].map(item => <div key={item} className="card p-5 space-y-3"><div className="skeleton h-11 w-11 rounded-xl" /><div className="skeleton h-5 w-3/4 rounded" /><div className="skeleton h-4 w-1/2 rounded" /></div>)}</div>
        : farms.length === 0
          ? <EmptyState icon={Warehouse} title="No Farms Yet" description="Add your farm name, approximate size, and map location. You can add other details later." action={<button onClick={openNew} className="btn-primary flex items-center gap-2 mx-auto"><Plus className="w-4 h-4" /> Add First Farm</button>} />
          : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{farms.map(farm => <FarmCard key={farm.id} farm={farm} onEdit={openEdit} onDelete={removeFarm} onPlan={generatePlan} onDetails={setDetailsFarm} />)}</div>}

      <Modal open={Boolean(editor)} onClose={closeEditor} title={editor?.farm ? 'Edit Farm Profile' : 'Add New Farm'} size="xl">
        {editor && <FarmWizard
          profile={profile}
          setProfile={setProfile}
          step={step}
          setStep={setStep}
          onSaveDraft={saveProfileDraft}
          onSubmit={submitProfile}
          submitting={submitting}
          editing={Boolean(editor.farm)}
          readingReport={readingReport}
          onReadReport={readReport}
          onViewReport={viewReport}
          onRemoveReport={removeReport}
          farmId={editor.farm && profile.soilReport?.id === editor.farm.soilReport?.id ? editor.farm.id : null}
        />}
      </Modal>
      <Modal open={Boolean(detailsFarm)} onClose={() => setDetailsFarm(null)} title={detailsFarm?.name || 'Farm details'} size="lg">
        {detailsFarm && <div className="space-y-4">
          <p><b>Location:</b> {detailsFarm.location || 'Not provided'}</p>
          <p><b>Area:</b> {detailsFarm.area} {detailsFarm.areaUnit}</p>
          <p><b>Soil:</b> {detailsFarm.profile?.soil?.soilType && detailsFarm.profile.soil.soilType !== 'unknown' ? detailsFarm.profile.soil.soilType : detailsFarm.soilType || 'Not added'}</p>
          <p><b>Water:</b> {detailsFarm.profile?.water?.availability && detailsFarm.profile.water.availability !== 'unknown' ? detailsFarm.profile.water.availability : detailsFarm.waterSource || 'Not added'}</p>
          <section><h4 className="font-semibold">Crop history</h4>{(detailsFarm.cropHistory || detailsFarm.profile?.cropHistory || []).length
            ? <ul className="list-disc pl-5 mt-2">{(detailsFarm.cropHistory || detailsFarm.profile?.cropHistory || []).map((record, index) => <li key={record.id || index}>{record.crop} · {record.season || 'season unknown'} {record.year || ''} · {record.outcome || 'outcome unknown'}</li>)}</ul>
            : <p className="text-sm text-[var(--color-text-muted)] mt-1">No historical crops recorded.</p>}</section>
          <section><h4 className="font-semibold">Saved crop plans</h4>{detailsFarm.recommendationHistory?.length
            ? detailsFarm.recommendationHistory.map((item, index) => <p className="text-sm mt-1" key={item.id || index}>{item.season}: {item.selectedCrop || 'No crop selected'} · {new Date(item.createdAt).toLocaleDateString()}</p>)
            : <p className="text-sm text-[var(--color-text-muted)] mt-1">No recommendation history yet.</p>}</section>
          <button className="btn-primary" onClick={() => { setDetailsFarm(null); generatePlan(detailsFarm); }}>Start personalized crop planning</button>
        </div>}
      </Modal>
      <Modal open={Boolean(planningFarm)} onClose={() => !planBusy && setPlanningFarm(null)} title={`Crop planning${planningFarm ? ` · ${planningFarm.name}` : ''}`} size="lg">
        {planBusy && <div className="flex items-center gap-2 py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Building a shortlist from available farm information…</div>}
        {!planBusy && planResult && <RecommendationResults result={planResult} farm={planningFarm} onSelect={chooseCrop} selecting={selecting} />}
        {!planBusy && !planResult && planningFarm && <p className="text-sm text-[var(--color-text-muted)]">Add the missing farm details and try again. Recommendations will not include unsupported prices, yields, costs, or scheme claims.</p>}
      </Modal>
    </div>
  );
}
