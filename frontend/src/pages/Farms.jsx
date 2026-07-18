// src/pages/Farms.jsx
// Farm management — list, add, edit, delete

import { useState } from 'react';
import { useFarms } from '../hooks/useFarms';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Warehouse, Plus, Edit2, Trash2, MapPin, Ruler, Droplets, Loader2 } from 'lucide-react';

const SOIL_TYPES = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Rain-fed', 'Drip Irrigation', 'Pond'];

function FarmCard({ farm, onEdit, onDelete }) {
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

      {/* Health */}
      <ProgressBar value={farm.healthScore || 75} label="Farm Health" color={farm.healthScore >= 80 ? 'green' : farm.healthScore >= 60 ? 'yellow' : 'red'} />

      <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-3">
        Last updated: {farm.lastUpdated}
      </p>
    </div>
  );
}

function FarmForm({ defaultValues, onSubmit, submitting }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Farm Name *</label>
        <input className="input" placeholder="e.g., Shri Ram Farm" {...register('name', { required: 'Farm name is required' })} />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Location *</label>
        <input className="input" placeholder="Village, District, State" {...register('location', { required: 'Location is required' })} />
        {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Area *</label>
          <input type="number" step="0.1" className="input" placeholder="e.g., 5.2" {...register('area', { required: 'Area required', min: { value: 0.1, message: 'Min 0.1' } })} />
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
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Soil Type</label>
        <select className="input" {...register('soilType')}>
          {SOIL_TYPES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Water Source</label>
        <select className="input" {...register('waterSource')}>
          {WATER_SOURCES.map(w => <option key={w}>{w}</option>)}
        </select>
      </div>
      <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {defaultValues ? 'Update Farm' : 'Add Farm'}
      </button>
    </form>
  );
}

export default function Farms() {
  const { farms, loading, addFarm, updateFarm, deleteFarm } = useFarms();
  const [showAdd, setShowAdd] = useState(false);
  const [editFarm, setEditFarm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (data) => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 600));
    addFarm(data);
    toast.success('Farm added successfully! 🏡');
    setShowAdd(false);
    setSubmitting(false);
  };

  const handleEdit = async (data) => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 500));
    updateFarm(editFarm.id, data);
    toast.success('Farm updated!');
    setEditFarm(null);
    setSubmitting(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this farm? This cannot be undone.')) {
      deleteFarm(id);
      toast.success('Farm deleted.');
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
              <FarmCard key={f.id} farm={f} onEdit={f => setEditFarm(f)} onDelete={handleDelete} />
            ))}
          </div>
      }

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Farm">
        <FarmForm onSubmit={handleAdd} submitting={submitting} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editFarm} onClose={() => setEditFarm(null)} title="Edit Farm">
        {editFarm && <FarmForm defaultValues={editFarm} onSubmit={handleEdit} submitting={submitting} />}
      </Modal>
    </div>
  );
}
