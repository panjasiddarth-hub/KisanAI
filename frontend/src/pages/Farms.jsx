// src/pages/Farms.jsx
// Farm management — list, add, edit, delete

import { useState } from 'react';
import { useFarms, isConfirmedLocation } from '../hooks/useFarms';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import FarmLocationField from '../components/farms/FarmLocationField';
import FarmRecommendations from '../components/farms/FarmRecommendations';
import FarmPlots from '../components/farms/FarmPlots';
import toast from 'react-hot-toast';
import { Warehouse, Plus, Edit2, Trash2, MapPin, Ruler, Droplets, Loader2, Sparkles, FlaskConical, Sprout, Store, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';

const SOIL_TYPES = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Rain-fed', 'Drip Irrigation', 'Pond'];

const hasSoilTest = (st) => !!st && ['N', 'P', 'K', 'ph'].some(k => Number.isFinite(st[k]));
// The rest of the 12 Soil Health Card parameters (optional; the soil-rating model needs all 12)
const MORE_SOIL = [['ec', 'EC (dS/m)'], ['oc', 'Organic carbon (%)'], ['s', 'S (ppm)'], ['zn', 'Zn (ppm)'], ['b', 'B (ppm)'], ['fe', 'Fe (ppm)'], ['cu', 'Cu (ppm)'], ['mn', 'Mn (ppm)']];
const SOIL_KEYS = ['N', 'P', 'K', 'ph', ...MORE_SOIL.map(([k]) => k)];
const soilCount = (st) => (st ? SOIL_KEYS.filter(k => Number.isFinite(st[k])).length : 0);

function FarmCard({ farm, onEdit, onDelete, onRecommend, onPlots }) {
  const plotSum = farm.plotSummary || { count: 0, allocatedAcres: 0, unconvertible: 0 };
  const located = isConfirmedLocation(farm.coordinates);
  const tested = hasSoilTest(farm.soilTest);
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
          <span className="text-xs text-[var(--color-text-muted)]">No crops added yet</span>
        )}
      </div>

      {/* Location, soil test and planned crop */}
      <div className="space-y-1.5 mb-3 text-[0.7rem]">
        <div className={`flex items-center gap-1.5 ${located ? 'text-green-700 dark:text-green-400' : 'text-amber-600'}`}>
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {located ? `Location confirmed · ${farm.coordinates.lat.toFixed(3)}, ${farm.coordinates.lon.toFixed(3)}` : 'Location not confirmed — needed for farm weather and recommendations'}
        </div>
        <div className={`flex items-center gap-1.5 ${tested ? 'text-green-700 dark:text-green-400' : 'text-amber-600'}`}>
          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
          {tested
            ? `Soil test${farm.soilTest.testedOn ? ` (${farm.soilTest.testedOn})` : ''}: N ${farm.soilTest.N ?? '–'} · P ${farm.soilTest.P ?? '–'} · K ${farm.soilTest.K ?? '–'} · pH ${farm.soilTest.ph ?? '–'} · ${soilCount(farm.soilTest)}/12 card values`
            : 'No soil test saved'}
        </div>
        {farm.selectedCrop?.crop && (
          <div className="flex items-center gap-1.5 text-[var(--color-text)]">
            <Sprout className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span>Planned: <b>{farm.selectedCrop.displayName || farm.selectedCrop.crop}</b>{farm.selectedCrop.sowingDate ? ` · sowing ${farm.selectedCrop.sowingDate}` : ''}</span>
          </div>
        )}
      </div>
      <button onClick={() => onPlots(farm)} data-testid="farm-plots-button" className="w-full mb-3 flex items-center justify-between gap-2 text-xs px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/60 text-[var(--color-text)]">
        <span className="flex items-center gap-2 font-semibold"><LayoutGrid className="w-4 h-4 text-green-600" /> Plots</span>
        <span className="text-[var(--color-text-muted)]" data-testid="farm-plot-summary">
          {plotSum.count === 0 ? 'Whole farm · add plots' : `${plotSum.count} plot${plotSum.count === 1 ? '' : 's'} · ${Math.round(plotSum.allocatedAcres * 100) / 100} ac${plotSum.unconvertible ? ` + ${plotSum.unconvertible} unconverted` : ''}${plotSum.openCycles ? ` · ${plotSum.openCycles} crop${plotSum.openCycles === 1 ? '' : 's'} on` : ''}`}
        </span>
      </button>
      <button onClick={() => onRecommend(farm)} className="w-full mb-4 flex items-center justify-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
        <Sparkles className="w-4 h-4" /> Get AI Crop Recommendations
      </button>
      <div className="grid grid-cols-3 gap-1.5 mb-4 text-[0.68rem] font-semibold" data-testid="farm-agent-links">
        <Link to={`/agents/fertilizer?farm=${farm.id}`} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"><FlaskConical className="w-3.5 h-3.5" /> Fertilizer</Link>
        <Link to={`/irrigation?farm=${farm.id}`} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"><Droplets className="w-3.5 h-3.5" /> Irrigation</Link>
        <Link to={`/market?farm=${farm.id}`} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300"><Store className="w-3.5 h-3.5" /> Prices</Link>
      </div>

      {/* Health */}
      <ProgressBar value={farm.healthScore || 75} label="Health score (sample value — not calculated by KisanAI)" color={farm.healthScore >= 80 ? 'green' : farm.healthScore >= 60 ? 'yellow' : 'red'} />

      <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-3">
        Last updated: {farm.lastUpdated}
      </p>
    </div>
  );
}

function FarmForm({ defaultValues, onSubmit, submitting }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      ...defaultValues,
      areaUnit: defaultValues?.areaUnit || 'acres',
      soilType: defaultValues?.soilType || '',
      waterSource: defaultValues?.waterSource || '',
    },
  });
  const [coords, setCoords] = useState(defaultValues?.coordinates || null);
  const [coordsChanged, setCoordsChanged] = useState(false);
  const [locationError, setLocationError] = useState('');

  const submit = (v) => {
    if (!isConfirmedLocation(coords)) {
      setLocationError('Please tap your farm on the map before saving.');
      return;
    }
    setLocationError('');
    const st = v.soilTest || {};
    const soilTest = Object.fromEntries(
      SOIL_KEYS
        .filter((key) => st[key] !== '' && st[key] != null && Number.isFinite(Number(st[key])))
        .map((key) => [key, Number(st[key])])
    );
    if (st.testedOn) soilTest.testedOn = st.testedOn;
    onSubmit({
      name: v.name,
      location: coords.label || `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`,
      area: Number(v.area),
      areaUnit: v.areaUnit,
      soilType: v.soilType, waterSource: v.waterSource,
      soilTest: Object.keys(soilTest).length ? soilTest : null,
      ...(coordsChanged && { coordinates: { ...coords, confirmed: true } }),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">What do you call your farm? *</label>
        <input className="input" placeholder="e.g., Our farm" {...register('name', { required: 'Please enter a name for your farm' })} />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">About how much land? *</label>
          <input type="number" step="0.1" className="input" placeholder="e.g., 2" {...register('area', { required: 'Please enter the approximate size', min: { value: 0.1, message: 'Enter an area greater than 0' } })} />
          {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Unit</label>
          <select className="input" {...register('areaUnit')}>
            <option value="acres">Acres</option>
            <option value="hectares">Hectares</option>
            <option value="bigha">Bigha</option>
          </select>
        </div>
      </div>
      <FarmLocationField value={coords} onChange={(c) => {
        setCoords(c);
        setCoordsChanged(true);
        setLocationError('');
      }} />
      {locationError && <p className="text-red-500 text-xs" role="alert">{locationError}</p>}
      <details className="rounded-xl border border-[var(--color-border)] p-3"
        open={Boolean(defaultValues?.soilType || defaultValues?.waterSource || hasSoilTest(defaultValues?.soilTest))}>
        <summary className="text-sm font-semibold text-[var(--color-text)] cursor-pointer">Add details if you know them (optional)</summary>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">It’s okay to leave these blank. You can add them later.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text)] mb-1">Soil type</label>
            <select className="input" {...register('soilType')}>
              <option value="">I don’t know</option>
              {SOIL_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text)] mb-1">Water for the farm</label>
            <select className="input" {...register('waterSource')}>
              <option value="">I don’t know</option>
              {WATER_SOURCES.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3 mt-3 space-y-2">
          <p className="text-xs font-medium text-[var(--color-text)]">Soil Health Card numbers (only if you have the card)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[['N', 'N'], ['P', 'P'], ['K', 'K'], ['ph', 'pH']].map(([key, label]) => (
              <div key={key}>
                <label className="block text-[0.68rem] text-[var(--color-text-muted)] mb-1">{label}</label>
                <input type="number" step="any" className="input !py-2 text-sm" aria-label={`Soil ${label}`}
                  {...register(`soilTest.${key}`, {
                    min: { value: 0, message: `${label} can't be negative` },
                    ...(key === 'ph' && { max: { value: 14, message: 'pH must be between 0 and 14' } }),
                  })} />
              </div>
            ))}
          </div>
          <details className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5"
            open={MORE_SOIL.some(([key]) => defaultValues?.soilTest?.[key] != null)}>
            <summary className="text-[0.72rem] font-semibold text-[var(--color-text)] cursor-pointer">Other numbers on the card</summary>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {MORE_SOIL.map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[0.68rem] text-[var(--color-text-muted)] mb-1">{label}</label>
                  <input type="number" step="any" className="input !py-2 text-sm" aria-label={`Soil ${label}`}
                    {...register(`soilTest.${key}`, { min: { value: 0, message: `${label} can't be negative` } })} />
                </div>
              ))}
            </div>
          </details>
          <label className="block text-[0.68rem] text-[var(--color-text-muted)]">Test date
            <input type="date" className="input !py-2 text-sm mt-1 block" {...register('soilTest.testedOn')} />
          </label>
          {errors.soilTest && <p className="text-red-500 text-xs">{Object.values(errors.soilTest).map(e => e?.message).filter(Boolean).join(' · ')}</p>}
        </div>
      </details>
      <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {defaultValues ? 'Save Farm' : 'Add My Farm'}
      </button>
    </form>
  );
}

export default function Farms() {
  const { farms, loading, addFarm, updateFarm, deleteFarm, selectRecommendedCrop, refreshFarms } = useFarms();
  const [plotsFarm, setPlotsFarm] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [recommendFarm, setRecommendFarm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (data) => {
    setSubmitting(true);
    try {
      await addFarm(data);
      toast.success('Farm added successfully! 🏡');
      setShowAdd(false);
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
              <FarmCard key={f.id} farm={f} onEdit={f => setEditFarm(f)} onDelete={handleDelete} onRecommend={setRecommendFarm} onPlots={setPlotsFarm} />
            ))}
          </div>
      }

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Farm">
        <FarmForm onSubmit={handleAdd} submitting={submitting} />
      </Modal>

      {/* Farm-specific AI crop recommendations */}
      <Modal open={!!recommendFarm} onClose={() => setRecommendFarm(null)} title={`AI crop recommendations — ${recommendFarm?.name || ''}`} size="xl">
        {recommendFarm && (
          <FarmRecommendations
            farm={recommendFarm}
            onSelect={selectRecommendedCrop}
            onEditFarm={(f) => { setRecommendFarm(null); setEditFarm(f); }}
          />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!plotsFarm} onClose={() => { setPlotsFarm(null); refreshFarms(); }} title={`Plots — ${plotsFarm?.name || ''}`} size="xl">
        {plotsFarm && <FarmPlots farm={plotsFarm} onChanged={refreshFarms} />}
      </Modal>

      <Modal open={!!editFarm} onClose={() => setEditFarm(null)} title="Edit Farm">
        {editFarm && <FarmForm defaultValues={editFarm} onSubmit={handleEdit} submitting={submitting} />}
      </Modal>
    </div>
  );
}
