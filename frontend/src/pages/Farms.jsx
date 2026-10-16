// src/pages/Farms.jsx
// Farm management — list, add, edit, delete

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarms } from '../hooks/useFarms';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Warehouse, Plus, Edit2, Trash2, MapPin, Ruler, Droplets, Loader2, ArrowLeft, ArrowRight, Check, Sprout } from 'lucide-react';

const SOIL_TYPES = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Rain-fed', 'Drip Irrigation', 'Pond'];
const STEPS = [
  { title: 'Farmer', fields: ['farmerName', 'name', 'village', 'state'] },
  { title: 'Land', fields: ['area', 'areaUnit', 'landOwnership', 'soilType', 'soilPH'] },
  { title: 'Water', fields: ['waterSource', 'waterAvailability'] },
  { title: 'Plan', fields: ['season'] },
];
const IRRIGATION_METHODS = ['Flood / furrow', 'Drip', 'Sprinkler', 'Rainfed'];

function FormField({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
    </div>
  );
}

function FarmCard({ farm, onEdit, onDelete, onRecommend }) {
  return (
    <div className="card p-5 fade-in group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">{farm.name}</h3>
            <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
              <MapPin className="w-3 h-3" />
              <span className="text-xs">{farm.location}</span>
            </div>
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
      </div>

      <div className="flex gap-1 flex-wrap mb-4">
        {(farm.crops || []).map(c => (
          <span key={c} className="badge badge-green">{c}</span>
        ))}
        {(!farm.crops || farm.crops.length === 0) && (
          <span className="text-xs text-[var(--color-text-muted)]">No crops selected yet</span>
        )}
      </div>

      <button type="button" onClick={() => onRecommend(farm)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800">
        <Sprout className="h-4 w-4" />
        {farm.crops?.length ? 'Find another crop' : 'Get crop recommendations'}
      </button>

      {/* Health */}
      <ProgressBar value={farm.healthScore || 75} label="Farm Health" color={farm.healthScore >= 80 ? 'green' : farm.healthScore >= 60 ? 'yellow' : 'red'} />

      <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-3">
        Last updated: {farm.lastUpdated}
      </p>
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
      waterSource: WATER_SOURCES[0],
      waterAvailability: 'Seasonal',
      irrigationMethods: [],
      waterQuality: 'Unknown',
      season: 'Kharif',
      previousCrop: '',
      cultivationMethod: 'Conventional',
      crops: [],
    };
  const { register, handleSubmit, trigger, formState: { errors } } = useForm({ defaultValues: initialValues });
  const [step, setStep] = useState(0);
  const isEditing = Boolean(defaultValues);

  const nextStep = async () => {
    if (await trigger(STEPS[step].fields)) setStep(current => Math.min(current + 1, STEPS.length - 1));
  };

  const submitFarm = handleSubmit(async data => {
    const payload = {
      ...data,
      area: Number(data.area),
      soilPH: data.soilPH === '' ? undefined : Number(data.soilPH),
      crops: defaultValues?.crops || [],
      location: [data.village, data.district, data.state].filter(Boolean).join(', '),
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
      </section>}

      {step === 1 && <section className="space-y-4">
        <div>
          <h4 className="font-semibold text-[var(--color-text)]">Land and soil</h4>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Soil and plot size inform crop and input recommendations.</p>
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
            <input type="number" step="0.1" min="0" max="14" className="input" placeholder="0-14" {...register('soilPH', { min: { value: 0, message: 'pH must be 0-14' }, max: { value: 14, message: 'pH must be 0-14' } })} />
          </FormField>
          <FormField label="Last soil test date" error={errors.soilTestDate}>
            <input type="date" className="input" {...register('soilTestDate')} />
          </FormField>
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
  const { user } = useAuth();
  const { farms, loading, addFarm, updateFarm, deleteFarm } = useFarms();
  const [showAdd, setShowAdd] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
