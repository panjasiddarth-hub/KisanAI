// src/pages/Farms.jsx
// Farm management — list, add, edit, delete

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFarms } from '../hooks/useFarms';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { api } from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import GovernmentAdvisoryLink from '../components/farm/GovernmentAdvisoryLink';
import FarmLocationPicker from '../components/farm/FarmLocationPicker';
import toast from 'react-hot-toast';
import { Warehouse, Plus, Edit2, Trash2, MapPin, Ruler, Droplets, Loader2, ArrowLeft, ArrowRight, Check, Sprout, Camera, X, FlaskConical, Leaf, FileText, ScanSearch } from 'lucide-react';

const SOIL_TYPES = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Rain-fed', 'Drip Irrigation', 'Pond'];
const SOIL_REPORT_FIELDS = [
  { key: 'soilPH', label: 'pH', unit: '' },
  { key: 'soilEC', label: 'EC', unit: 'dS/m' },
  { key: 'soilOC', label: 'Organic carbon', unit: '%' },
  { key: 'soilN', label: 'Nitrogen (N)', unit: 'kg/ha' },
  { key: 'soilP', label: 'Phosphorus (P)', unit: 'kg/ha' },
  { key: 'soilK', label: 'Potassium (K)', unit: 'kg/ha' },
  { key: 'soilS', label: 'Sulphur (S)', unit: 'ppm' },
  { key: 'soilZn', label: 'Zinc (Zn)', unit: 'ppm' },
  { key: 'soilB', label: 'Boron (B)', unit: 'ppm' },
  { key: 'soilFe', label: 'Iron (Fe)', unit: 'ppm' },
  { key: 'soilCu', label: 'Copper (Cu)', unit: 'ppm' },
  { key: 'soilMn', label: 'Manganese (Mn)', unit: 'ppm' },
];
const EXTRA_SOIL_FIELDS = SOIL_REPORT_FIELDS.filter(({ key }) => !['soilPH', 'soilN', 'soilP', 'soilK'].includes(key));
const STEPS = [
  { title: 'Farmer', fields: ['farmerName', 'name', 'village', 'state'] },
  { title: 'Land', fields: ['area', 'areaUnit', 'landOwnership', 'soilType', 'soilPH'] },
  { title: 'Water', fields: ['waterSource', 'waterAvailability'] },
  { title: 'Plan', fields: ['season'] },
];
const IRRIGATION_METHODS = ['Flood / furrow', 'Drip', 'Sprinkler', 'Rainfed'];

function soilReportUnitMatches(field, unit) {
  const value = String(unit || '').trim().toLowerCase().replace(/\s+/g, '');
  if (field === 'soilPH') return !value || value === 'ph';
  if (field === 'soilEC') return value === 'ds/m' || value === 'dsm-1';
  if (field === 'soilOC') return value === '%' || value === 'percent';
  if (['soilN', 'soilP', 'soilK'].includes(field)) return /^kg\/ha$/i.test(value);
  return value === 'ppm' || value === 'mg/kg';
}

function compressFarmPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      if (dataUrl.length > 1_400_000) reject(new Error('This photo is still too large. Please choose a smaller image.'));
      else resolve(dataUrl);
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This photo could not be opened. Try another image.')); };
    image.src = objectUrl;
  });
}

function FormField({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

function FarmCard({ farm, onEdit, onDelete, onRecommend, onAssess }) {
  return (
    <div className="card p-5 fade-in group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {farm.images?.[0]
            ? <img src={farm.images[0]} alt={`${farm.name} farm`} className="w-11 h-11 rounded-xl object-cover shadow" />
            : <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow"><Warehouse className="w-5 h-5 text-white" /></div>}
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">{farm.name}</h3>
            <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
              <MapPin className="w-3 h-3" />
              <span className="text-xs">{farm.location}</span>
            </div>
            {Number.isFinite(farm.latitude) && Number.isFinite(farm.longitude) && <a
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${farm.latitude},${farm.longitude}`}
              target="_blank" rel="noreferrer"
            ><MapPin className="h-3 w-3" />Open farm pin in Maps</a>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(farm)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-[var(--color-text-muted)] hover:text-blue-600">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(farm.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-[var(--color-text-muted)] hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Ruler className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">Area</p>
            <p className="text-xs font-bold text-[var(--color-text)]">{farm.area} {farm.areaUnit}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Droplets className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">Water</p>
            <p className="text-xs font-bold text-[var(--color-text)]">{farm.waterSource}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Sprout className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">Soil</p>
            <p className="text-xs font-bold text-[var(--color-text)]">{farm.soilType || 'Not recorded'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
          <Leaf className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-[0.65rem] text-[var(--color-text-muted)]">Season</p>
            <p className="text-xs font-bold text-[var(--color-text)]">{farm.season || 'Not recorded'}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[var(--color-border)] px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><FlaskConical className="h-3.5 w-3.5" /> Soil test</span>
        <span className="text-xs font-semibold text-[var(--color-text)]">{farm.soilN != null && farm.soilP != null && farm.soilK != null ? `N ${farm.soilN} · P ${farm.soilP} · K ${farm.soilK}` : 'Readings not added'}</span>
      </div>
      {(farm.soilPH != null || farm.soilN != null || farm.soilP != null || farm.soilK != null) && <p className="-mt-3 mb-4 text-[0.65rem] text-[var(--color-text-muted)]">
        Source: {[...new Set(Object.values(farm.soilSources || {}))].map(source => source === 'soil_report_reviewed' ? 'farmer-reviewed soil report' : 'entered by farmer').join(' · ') || 'not recorded'}
        {farm.soilTestDate ? ` · tested ${farm.soilTestDate}` : ''}
      </p>}

      <div className="flex gap-1 flex-wrap mb-4">
        {(farm.crops || []).map(c => (
          <span key={c} className="badge badge-green">{c}</span>
        ))}
        {(!farm.crops || farm.crops.length === 0) && (
          <span className="text-xs text-[var(--color-text-muted)]">No crops selected yet</span>
        )}
      </div>

      <button type="button" onClick={() => onAssess(farm)} className="mb-2 block text-sm font-bold text-emerald-700 hover:text-emerald-800">
        Run farm assessment
      </button>
      <button type="button" onClick={() => onRecommend(farm)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800">
        <Sprout className="h-4 w-4" />
        {farm.crops?.length ? 'Find another crop' : 'Get crop recommendations'}
      </button>

      <GovernmentAdvisoryLink farm={farm} compact />

      <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-3">Previous crop: {farm.previousCrop || 'Not recorded'}</p>
    </div>
  );
}

function FarmForm({ defaultValues, farmer, onSubmit, submitting }) {
  const locationParts = String(defaultValues?.location || farmer?.location || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  const initialValues = defaultValues
    ? {
      ...defaultValues,
      farmerName: defaultValues.farmerName || farmer?.name || '',
      farmerPhone: defaultValues.farmerPhone || farmer?.phone || '',
      village: defaultValues.village || locationParts[0] || '',
      district: defaultValues.district || (locationParts.length > 2 ? locationParts[1] : ''),
      state: defaultValues.state || (locationParts.length > 1 ? locationParts.at(-1) : ''),
      soilPH: defaultValues.soilPH ?? '',
      soilEC: defaultValues.soilEC ?? '',
      soilOC: defaultValues.soilOC ?? '',
      soilN: defaultValues.soilN ?? '',
      soilP: defaultValues.soilP ?? '',
      soilK: defaultValues.soilK ?? '',
      soilS: defaultValues.soilS ?? '',
      soilZn: defaultValues.soilZn ?? '',
      soilB: defaultValues.soilB ?? '',
      soilFe: defaultValues.soilFe ?? '',
      soilCu: defaultValues.soilCu ?? '',
      soilMn: defaultValues.soilMn ?? '',
      cropsText: (defaultValues.crops || []).join(', '),
    }
    : {
      farmerName: farmer?.name || '',
      farmerPhone: farmer?.phone || '',
      village: locationParts[0] || '',
      district: '',
      state: locationParts.length > 1 ? locationParts.at(-1) : '',
      areaUnit: 'acres',
      landOwnership: 'Owned',
      soilType: SOIL_TYPES[0],
      soilPH: '',
      soilEC: '',
      soilOC: '',
      soilN: '',
      soilP: '',
      soilK: '',
      soilS: '',
      soilZn: '',
      soilB: '',
      soilFe: '',
      soilCu: '',
      soilMn: '',
      waterSource: WATER_SOURCES[0],
      waterAvailability: 'Seasonal',
      irrigationMethods: [],
      waterQuality: 'Unknown',
      season: 'Kharif',
      previousCrop: '',
      cultivationMethod: 'Conventional',
      crops: [],
    };
  const { register, handleSubmit, trigger, setValue, watch, formState: { errors } } = useForm({ defaultValues: initialValues });
  const farmSearchText = [watch('village'), watch('district'), watch('state')].filter(Boolean).join(', ');
  const [step, setStep] = useState(0);
  const [farmPhoto, setFarmPhoto] = useState(defaultValues?.images?.[0] || '');
  const [soilReport, setSoilReport] = useState(null);
  const [soilReportBusy, setSoilReportBusy] = useState(false);
  const [soilReportConsent, setSoilReportConsent] = useState(false);
  const [soilSources, setSoilSources] = useState(() => ({ ...(defaultValues?.soilSources || {}) }));
  const [farmCoordinates, setFarmCoordinates] = useState(() => (
    Number.isFinite(defaultValues?.latitude) && Number.isFinite(defaultValues?.longitude)
      ? { latitude: defaultValues.latitude, longitude: defaultValues.longitude }
      : null
  ));
  const soilReportInput = useRef(null);
  const photoInput = useRef(null);
  const isEditing = Boolean(defaultValues);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file for the farm photo.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Choose a photo smaller than 10 MB.'); return; }
    try { setFarmPhoto(await compressFarmPhoto(file)); }
    catch (error) { toast.error(error.message || 'Could not read this photo.'); }
  };

  const scanSoilReport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a PDF, JPG, PNG, or WebP soil report.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Choose a soil report file smaller than 5 MB.');
      return;
    }
    if (!isPdf && !soilReportConsent) {
      toast.error('Please allow the report file to be processed by the configured AI service first.');
      return;
    }
    setSoilReportBusy(true);
    try {
      const body = new FormData();
      body.append('report', file);
      body.append('consentToAIProcessing', String(soilReportConsent));
      const { data } = await api.post('/farms/soil-report/extract', body);
      setSoilReport(data.extraction);
      toast.success(data.extractionMethod === 'local_pdf_text' ? 'PDF text read locally. Review each value before applying it.' : 'Report scanned with Gemini. Review each value before applying it.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not scan this report. Enter the values manually.');
    } finally {
      setSoilReportBusy(false);
    }
  };

  const applySoilExtraction = () => {
    if (!soilReport) return;
    const fields = SOIL_REPORT_FIELDS.map(({ key }) => key);
    const copiedFields = [];
    for (const field of fields) {
      const item = soilReport[field];
      if (item?.value == null) continue;
      if (!soilReportUnitMatches(field, item.unit)) continue;
      setValue(field, String(item.value), { shouldDirty: true, shouldValidate: true });
      copiedFields.push(field);
    }
    if (soilReport.soilTestDate) setValue('soilTestDate', soilReport.soilTestDate, { shouldDirty: true });
    setSoilSources(current => ({ ...current, ...Object.fromEntries(copiedFields.map(field => [field, 'soil_report_reviewed'])) }));
    toast.success('Clear readings were copied. Check the values and units before saving.');
  };

  const markSoilFieldSource = (field, value) => {
    setSoilSources(current => {
      const next = { ...current };
      if (value === '') delete next[field];
      else next[field] = 'farmer_entered';
      return next;
    });
  };

  const nextStep = async () => {
    if (await trigger(STEPS[step].fields)) setStep(current => Math.min(current + 1, STEPS.length - 1));
  };

  const submitFarm = handleSubmit(async data => {
    const payload = {
      ...data,
      area: Number(data.area),
      soilPH: data.soilPH === '' ? undefined : Number(data.soilPH),
      soilEC: data.soilEC === '' ? undefined : Number(data.soilEC),
      soilOC: data.soilOC === '' ? undefined : Number(data.soilOC),
      soilN: data.soilN === '' ? undefined : Number(data.soilN),
      soilP: data.soilP === '' ? undefined : Number(data.soilP),
      soilK: data.soilK === '' ? undefined : Number(data.soilK),
      soilS: data.soilS === '' ? undefined : Number(data.soilS),
      soilZn: data.soilZn === '' ? undefined : Number(data.soilZn),
      soilB: data.soilB === '' ? undefined : Number(data.soilB),
      soilFe: data.soilFe === '' ? undefined : Number(data.soilFe),
      soilCu: data.soilCu === '' ? undefined : Number(data.soilCu),
      soilMn: data.soilMn === '' ? undefined : Number(data.soilMn),
      soilSources,
      crops: defaultValues?.crops || [],
      images: farmPhoto ? [farmPhoto] : [],
      location: [data.village, data.district, data.state].filter(Boolean).join(', '),
      latitude: farmCoordinates?.latitude,
      longitude: farmCoordinates?.longitude,
    };
    await onSubmit(payload);
  });

  return (
    <form onSubmit={submitFarm} className="space-y-5">
      <div className="grid grid-cols-4 gap-2" aria-label="Farm setup steps">
        {STEPS.map((item, index) => (
          <div key={item.title} aria-current={step === index ? 'step' : undefined}>
            <p className={`mb-2 text-xs font-semibold ${step === index ? 'text-green-700' : 'text-[var(--color-text-muted)]'}`}>{item.title}</p>
            <div className={`h-1 rounded-full ${step >= index ? 'bg-green-600' : 'bg-[var(--color-border)]'}`} />
          </div>
        ))}
      </div>

      {step === 0 && <section className="space-y-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text)]">Farmer and farm basics</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Contact and location help tailor local crop guidance.</p>
        </div>
        <FormField label="Farmer name *" error={errors.farmerName}>
          <input className="input" {...register('farmerName', { required: 'Farmer name is required' })} />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Phone number" error={errors.farmerPhone}>
            <input type="tel" className="input" {...register('farmerPhone')} />
          </FormField>
          <FormField label="Farm name *" error={errors.name}>
            <input className="input" placeholder="e.g., Shri Ram Farm" {...register('name', { required: 'Farm name is required' })} />
          </FormField>
        </div>
        <FormField label="Farm photo (optional)">
          <input ref={photoInput} type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" aria-label="Choose a farm photo" />
          {farmPhoto ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-2.5">
              <img src={farmPhoto} alt="Farm photo preview" className="h-16 w-24 rounded-lg object-cover" />
              <span className="flex-1 text-xs text-[var(--color-text-muted)]">Photo ready to save with this farm</span>
              <button type="button" onClick={() => setFarmPhoto('')} aria-label="Remove farm photo" className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
              <button type="button" onClick={() => photoInput.current?.click()} className="text-xs font-semibold text-green-700">Change</button>
            </div>
          ) : (
            <button type="button" onClick={() => photoInput.current?.click()} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-left hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-950/20">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700"><Camera className="h-5 w-5" /></span>
              <span><span className="block text-sm font-semibold text-[var(--color-text)]">Add a farm photo</span><span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">Optional · JPG, PNG, or another image · up to 10 MB</span></span>
            </button>
          )}
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Village / town *" error={errors.village}>
            <input className="input" {...register('village', { required: 'Village or town is required' })} />
          </FormField>
          <FormField label="District" error={errors.district}>
            <input className="input" {...register('district')} />
          </FormField>
          <FormField label="State / UT *" error={errors.state}>
            <input className="input" {...register('state', { required: 'State is required' })} />
          </FormField>
        </div>
        <FarmLocationPicker coordinates={farmCoordinates} onChange={setFarmCoordinates} searchText={farmSearchText} />
      </section>}

      {step === 1 && <section className="space-y-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text)]">Land and soil</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Soil and plot size inform crop and input recommendations.</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/70 p-3 dark:border-green-900/50 dark:bg-green-950/20">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text)]">Have a soil test report?</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">Selectable text in a PDF is read by your local ML service first. Scanned PDFs and photos use Gemini only if you consent. You review readings before saving; unclear values stay blank.</p>
              <label className="mt-2 flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                <input type="checkbox" checked={soilReportConsent} onChange={event => setSoilReportConsent(event.target.checked)} className="mt-0.5 accent-green-700" />
                <span>I agree to send scanned PDFs or report photos to Gemini for extraction. Selectable PDF text is processed locally first. The file is not saved; extracted values are shown for my review.</span>
              </label>
              <input ref={soilReportInput} type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" onChange={scanSoilReport} className="sr-only" aria-label="Choose a soil test report PDF or image" />
              <button type="button" onClick={() => soilReportInput.current?.click()} disabled={soilReportBusy} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-700 px-3 py-2 text-xs font-semibold text-green-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-green-300">
                {soilReportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {soilReportBusy ? 'Reading report…' : 'Scan soil report PDF or image'}
              </button>
              {!soilReportConsent && <p className="mt-1 text-[0.68rem]">Selectable PDFs can be read locally. Scanned PDFs and photos need consent before Gemini processing. Manual entry is always available.</p>}
            </div>
          </div>
          {soilReport && <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <p className="text-xs font-bold text-[var(--color-text)]">Check extracted readings</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
              {SOIL_REPORT_FIELDS.map(({ key, label }) => {
                const item = soilReport[key];
                const compatibleUnit = soilReportUnitMatches(key, item?.unit);
                return <p key={key}><b>{label}:</b> {item?.value ?? 'Not read'}{item?.unit ? ` ${item.unit}` : ''}{item?.value != null && !compatibleUnit ? ' · unit needs review' : ''}{item?.value != null ? ` · ${item.confidence} read` : ''}</p>;
              })}
              <p className="col-span-2"><b>Test date:</b> {soilReport.soilTestDate || 'Not read'}</p>
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-amber-800 dark:text-amber-300">Values are copied only when the printed unit matches the model input unit. mg/kg and ppm are treated as equivalent by mass. P₂O₅ and K₂O readings are not copied into elemental P/K fields. Compare every value with the report.</p>
            <button type="button" onClick={applySoilExtraction} className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white">Copy clear values to form</button>
          </div>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Cultivated area *" error={errors.area}>
            <input type="number" step="0.1" min="0.1" className="input" placeholder="e.g., 5.2" {...register('area', { required: 'Area is required', min: { value: 0.1, message: 'Area must be at least 0.1' } })} />
          </FormField>
          <FormField label="Area unit" error={errors.areaUnit}>
            <select className="input" {...register('areaUnit')}>
              <option value="acres">Acres</option>
              <option value="hectares">Hectares</option>
              <option value="bigha">Bigha</option>
            </select>
          </FormField>
          <FormField label="Land tenure" error={errors.landOwnership}>
            <select className="input" {...register('landOwnership')}>
              {['Owned', 'Leased', 'Shared / tenant', 'Other'].map(value => <option key={value}>{value}</option>)}
            </select>
          </FormField>
          <FormField label="Soil type *" error={errors.soilType}>
            <select className="input" {...register('soilType', { required: 'Soil type is required' })}>
              {SOIL_TYPES.map(soil => <option key={soil}>{soil}</option>)}
              <option>Other / unknown</option>
            </select>
          </FormField>
          <FormField label="Soil pH (if known)" error={errors.soilPH}>
            <input type="number" step="0.1" min="0" max="14" className="input" placeholder="0-14" {...register('soilPH', { min: { value: 0, message: 'pH must be 0-14' }, max: { value: 14, message: 'pH must be 0-14' }, onChange: event => markSoilFieldSource('soilPH', event.target.value) })} />
          </FormField>
          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--color-text-muted)] mb-2">Optional soil-test values (kg/ha). Enter these once from your lab report; crop recommendations can reuse them.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                ['soilN', 'Nitrogen (N)'],
                ['soilP', 'Phosphorus (P)'],
                ['soilK', 'Potassium (K)'],
              ].map(([key, label]) => (
                <FormField key={key} label={label} error={errors[key]}>
                  <input type="number" min="0" step="any" className="input" placeholder="From soil report" {...register(key, { min: { value: 0, message: 'Value must be zero or greater' }, onChange: event => markSoilFieldSource(key, event.target.value) })} />
                </FormField>
              ))}
            </div>
          </div>
          <FormField label="Last soil test date" error={errors.soilTestDate}>
            <input type="date" className="input" {...register('soilTestDate')} />
          </FormField>
          <details className="sm:col-span-2 rounded-xl border border-[var(--color-border)] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--color-text)]">Other soil lab measurements (optional)</summary>
            <p className="mt-2 text-[0.68rem] text-[var(--color-text-muted)]">Use the exact units printed on your report. These readings help prefill the soil nutrient model.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXTRA_SOIL_FIELDS.map(({ key, label, unit }) => (
                <FormField key={key} label={`${label}${unit ? ` (${unit})` : ''}`} error={errors[key]}>
                  <input type="number" min="0" max={['soilEC', 'soilOC'].includes(key) ? 100 : undefined} step="any" className="input" placeholder="From soil report" {...register(key, { min: { value: 0, message: 'Value must be zero or greater' }, max: ['soilEC', 'soilOC'].includes(key) ? { value: 100, message: 'Value must be 100 or less' } : undefined, onChange: event => markSoilFieldSource(key, event.target.value) })} />
                </FormField>
              ))}
            </div>
          </details>
        </div>
      </section>}

      {step === 2 && <section className="space-y-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text)]">Water and irrigation</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Availability and delivery method help estimate crop water needs.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Main water source *" error={errors.waterSource}>
            <select className="input" {...register('waterSource', { required: 'Choose a water source' })}>
              {WATER_SOURCES.map(source => <option key={source}>{source}</option>)}
              <option>Community well</option>
              <option>Other</option>
            </select>
          </FormField>
          <FormField label="Water availability *" error={errors.waterAvailability}>
            <select className="input" {...register('waterAvailability', { required: 'Choose water availability' })}>
              <option>Year-round</option>
              <option>Seasonal</option>
              <option>Limited / unreliable</option>
            </select>
          </FormField>
          <FormField label="Water quality" error={errors.waterQuality}>
            <select className="input" {...register('waterQuality')}>
              <option>Unknown</option>
              <option>Fresh</option>
              <option>Slightly saline</option>
              <option>Saline</option>
            </select>
          </FormField>
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-[var(--color-text)] mb-2">Irrigation methods</legend>
          <div className="grid grid-cols-2 gap-2">
            {IRRIGATION_METHODS.map(method => (
              <label key={method} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]">
                <input type="checkbox" value={method} className="accent-green-700" {...register('irrigationMethods')} />
                {method}
              </label>
            ))}
          </div>
        </fieldset>
      </section>}

      {step === 3 && <section className="space-y-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text)]">Season and crop planning</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Recommendations will use this season, your soil, and water details.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Main growing season *" error={errors.season}>
            <select className="input" {...register('season', { required: 'Choose a growing season' })}>
              <option>Kharif</option>
              <option>Rabi</option>
              <option>Zaid</option>
            </select>
          </FormField>
          <FormField label="Previous crop" error={errors.previousCrop}>
            <input className="input" placeholder="e.g., chickpea" {...register('previousCrop')} />
          </FormField>
          <FormField label="Cultivation practice" error={errors.cultivationMethod}>
            <select className="input" {...register('cultivationMethod')}>
              <option>Conventional</option>
              <option>Organic</option>
              <option>Integrated / mixed</option>
            </select>
          </FormField>
        </div>
      </section>}

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <button type="button" disabled={step === 0 || submitting} onClick={() => setStep(current => Math.max(current - 1, 0))} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1
          ? <button type="button" onClick={nextStep} className="btn-primary flex items-center gap-2">Next <ArrowRight className="h-4 w-4" /></button>
          : <button type="submit" disabled={submitting} className="btn-primary flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isEditing ? 'Save changes' : 'Save & get recommendations'}
          </button>}
      </div>
    </form>
  );
}

export default function Farms() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { farms, loading, addFarm, updateFarm, deleteFarm } = useFarms();
  const [showAdd, setShowAdd] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const requestedEditFarmId = location.state?.editFarmId;

  useEffect(() => {
    if (loading || !requestedEditFarmId) return;
    const requestedFarm = farms.find((farm) => farm.id === requestedEditFarmId);
    if (requestedFarm) {
      setEditFarm(requestedFarm);
      navigate('/farms', { replace: true, state: null });
    }
  }, [farms, loading, navigate, requestedEditFarmId]);

  const handleAdd = async (data) => {
    setSubmitting(true);
    try {
      const farm = await addFarm(data);
      toast.success('Farm added successfully! 🏡');
      setShowAdd(false);
      navigate('/agents/crop', { state: { farm } });
    } catch {
      // toast already shown in hook
    }
    setSubmitting(false);
  };

  const handleEdit = async (data) => {
    setSubmitting(true);
    try {
      await updateFarm(editFarm.id, data);
      toast.success('Farm updated!');
      setEditFarm(null);
    } catch {
      // error handled in hook
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this farm? This cannot be undone.')) {
      try {
        await deleteFarm(id);
        toast.success('Farm deleted.');
      } catch {}
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="My Farms" subtitle={`${farms.length} farm${farms.length !== 1 ? 's' : ''} registered`}>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Farm
        </button>
      </PageHeader>

      {loading
        ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card p-5 space-y-3"><div className="skeleton h-11 w-11 rounded-xl" /><div className="skeleton h-5 w-3/4 rounded" /><div className="skeleton h-4 w-1/2 rounded" /><div className="skeleton h-8 rounded-xl" /></div>)}
        </div>
        : farms.length === 0
          ? <EmptyState icon={Warehouse} title="No Farms Yet" description="Add your first farm to start tracking crops, health, and irrigation." action={<button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 mx-auto"><Plus className="w-4 h-4" /> Add First Farm</button>} />
          : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farms.map(f => (
              <FarmCard
                key={f.id}
                farm={f}
                onEdit={f => setEditFarm(f)}
                onDelete={handleDelete}
                onRecommend={farm => navigate('/agents/crop', { state: { farm } })}
                onAssess={farm => navigate('/agents/farm-assessment', { state: { farm } })}
              />
            ))}
          </div>
      }

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Farm" size="lg">
        <FarmForm farmer={user} onSubmit={handleAdd} submitting={submitting} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editFarm} onClose={() => setEditFarm(null)} title="Edit Farm" size="lg">
        {editFarm && <FarmForm defaultValues={editFarm} farmer={user} onSubmit={handleEdit} submitting={submitting} />}
      </Modal>
    </div>
  );
}
