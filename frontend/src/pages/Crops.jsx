// src/pages/Crops.jsx
// Crop management with growth monitoring and recommendations

import { useState } from 'react';
import { useCrops } from '../hooks/useCrops';
import { useFarms } from '../hooks/useFarms';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import toast from 'react-hot-toast';
import { Sprout, Plus, Edit2, Trash2, Loader2, Leaf, ChevronDown } from 'lucide-react';

const STAGE_COLORS = {
  'Sowing': 'badge-blue',
  'Germination': 'badge-green',
  'Vegetative': 'badge-green',
  'Tillering': 'badge-yellow',
  'Flowering': 'badge-purple',
  'Bulbing': 'badge-yellow',
  'Fruiting': 'badge-yellow',
  'Grand Growth': 'badge-green',
  'Pod Fill': 'badge-blue',
  'Maturity': 'badge-yellow',
  'Harvest': 'badge-red',
};

const RECOMMENDATIONS = [
  { crop: 'Wheat', rec: '🌾 Apply second dose of nitrogen fertilizer (Urea 50 kg/acre) during tillering stage for better yield.' },
  { crop: 'Onion', rec: '🧅 Monitor for thrips and apply neem oil spray. Ensure adequate spacing for bulb development.' },
  { crop: 'Tomato', rec: '🍅 Stake plants properly. Watch for early blight — apply Mancozeb 75 WP @ 2g/L weekly.' },
  { crop: 'Sugarcane', rec: '🎋 Maintain furrow irrigation at 7-day intervals. Apply potash to improve sugar content.' },
  { crop: 'Soybean', rec: '🫘 Ready for harvest when 85% pods turn yellow-brown. Avoid delays to prevent shattering.' },
];

function CropCard({ crop, farmName, onEdit, onDelete }) {
  const [showRec, setShowRec] = useState(false);
  const rec = RECOMMENDATIONS.find(r => r.crop === crop.name);

  return (
    <div className="card p-5 fade-in group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text)]">{crop.name}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{crop.variety} · {farmName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(crop)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-[var(--color-text-muted)] hover:text-blue-600">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(crop.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-[var(--color-text-muted)] hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`badge ${STAGE_COLORS[crop.stage] || 'badge-blue'}`}>{crop.stage}</span>
        <span className="badge badge-green">{crop.area} acres</span>
      </div>

      <ProgressBar value={crop.progress} label="Growth Progress" color={crop.progress >= 80 ? 'green' : crop.progress >= 50 ? 'yellow' : 'blue'} />

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/30">
          <p className="text-[0.6rem] text-[var(--color-text-muted)]">Sown</p>
          <p className="text-xs font-semibold text-[var(--color-text)]">{crop.sowingDate}</p>
        </div>
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700/30">
          <p className="text-[0.6rem] text-[var(--color-text-muted)]">Harvest</p>
          <p className="text-xs font-semibold text-[var(--color-text)]">{crop.expectedHarvest}</p>
        </div>
      </div>

      {rec && (
        <div className="mt-3">
          <button
            onClick={() => setShowRec(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700"
          >
            <Leaf className="w-3.5 h-3.5" />
            AI Recommendation
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRec ? 'rotate-180' : ''}`} />
          </button>
          {showRec && (
            <div className="mt-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/30">
              <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">{rec.rec}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CropForm({ defaultValues, farms, onSubmit, submitting }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Crop Name *</label>
          <input className="input" placeholder="e.g., Wheat" {...register('name', { required: 'Required' })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Variety</label>
          <input className="input" placeholder="e.g., HD-2967" {...register('variety')} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Farm *</label>
        <select className="input" {...register('farmId', { required: 'Select a farm' })}>
          <option value="">-- Select Farm --</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {errors.farmId && <p className="text-red-500 text-xs mt-1">{errors.farmId.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Sowing Date</label>
          <input type="date" className="input" {...register('sowingDate')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Expected Harvest</label>
          <input type="date" className="input" {...register('expectedHarvest')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Area (acres)</label>
          <input type="number" step="0.1" className="input" placeholder="2.5" {...register('area')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Growth Stage</label>
          <select className="input" {...register('stage')}>
            {Object.keys(STAGE_COLORS).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Notes</label>
        <textarea rows={3} className="input resize-none" placeholder="Observations, issues..." {...register('notes')} />
      </div>
      <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {defaultValues?.id ? 'Update Crop' : 'Add Crop'}
      </button>
    </form>
  );
}

export default function Crops() {
  const { crops, loading, addCrop, updateCrop, deleteCrop } = useCrops();
  const { farms } = useFarms();
  const [showAdd, setShowAdd] = useState(false);
  const [editCrop, setEditCrop] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const getFarmName = (farmId) => farms.find(f => f.id === farmId)?.name || 'Unknown Farm';

  const handleAdd = async (data) => {
    setSubmitting(true);
    try {
      await addCrop(data);
      toast.success('Crop added! 🌱');
      setShowAdd(false);
    } catch {}
    setSubmitting(false);
  };

  const handleEdit = async (data) => {
    setSubmitting(true);
    try {
      await updateCrop(editCrop.id, data);
      toast.success('Crop updated!');
      setEditCrop(null);
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Remove this crop?')) {
      try {
        await deleteCrop(id);
        toast.success('Crop removed.');
      } catch {}
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="Crop Management" subtitle={`${crops.length} active crop${crops.length !== 1 ? 's' : ''} across your farms`}>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Crop
        </button>
      </PageHeader>

      {loading
        ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-5 space-y-3"><div className="skeleton h-10 w-10 rounded-xl" /><div className="skeleton h-4 w-2/3 rounded" /><div className="skeleton h-3 w-1/2 rounded" /><div className="skeleton h-6 rounded-xl" /><div className="skeleton h-10 rounded-xl" /></div>)}
        </div>
        : crops.length === 0
          ? <EmptyState icon={Sprout} title="No Crops Added" description="Start by adding your first crop to track growth and get AI recommendations." action={<button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 mx-auto"><Plus className="w-4 h-4" /> Add First Crop</button>} />
          : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {crops.map(c => (
              <CropCard key={c.id} crop={c} farmName={getFarmName(c.farmId)} onEdit={setEditCrop} onDelete={handleDelete} />
            ))}
          </div>
      }

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Crop">
        <CropForm farms={farms} onSubmit={handleAdd} submitting={submitting} />
      </Modal>
      <Modal open={!!editCrop} onClose={() => setEditCrop(null)} title="Edit Crop">
        {editCrop && <CropForm defaultValues={editCrop} farms={farms} onSubmit={handleEdit} submitting={submitting} />}
      </Modal>
    </div>
  );
}
