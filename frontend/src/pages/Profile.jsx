// src/pages/Profile.jsx
// User profile with edit form and farm summary

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { Loader2, User, Phone, MapPin, Mail, Edit2, Warehouse, Sprout, TrendingUp } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: user?.name, phone: user?.phone, location: user?.location }
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 700));
    updateProfile(data);
    toast.success('Profile updated!');
    setEditing(false);
    setSubmitting(false);
  };

  const stats = [
    { label: 'Total Farms', value: '3', icon: Warehouse, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    { label: 'Active Crops', value: '5', icon: Sprout, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'Total Revenue', value: '₹12.1L', icon: TrendingUp, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  ];

  return (
    <div className="page-content max-w-3xl mx-auto">
      <PageHeader title="My Profile" subtitle="Manage your account and farm information" />

      {/* Profile card */}
      <div className="card p-6 mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-200 dark:shadow-green-900 text-white text-3xl font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[var(--color-text)]">{user?.name}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-green">
                🌾 Farmer
              </span>
              <span className="badge badge-blue">Member since 2026</span>
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2 shrink-0">
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map(s => (
            <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl ${s.color.split(' ').map(c => c.startsWith('bg-') || c.startsWith('dark:bg-') ? c : '').join(' ')} bg-opacity-30`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                <p className="font-bold text-sm text-[var(--color-text)]">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Info / Edit form */}
        {editing
          ? <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Full Name</label>
              <input className="input" {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Phone Number</label>
              <input className="input" placeholder="+91 98765 43210" {...register('phone')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Location</label>
              <input className="input" placeholder="Village, District, State" {...register('location')} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
          : <div className="space-y-3">
            {[
              { icon: User, label: 'Full Name', val: user?.name },
              { icon: Mail, label: 'Email', val: user?.email },
              { icon: Phone, label: 'Phone', val: user?.phone || 'Not set' },
              { icon: MapPin, label: 'Location', val: user?.location || 'Not set' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-700/30">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <row.icon className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)]">{row.label}</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">{row.val}</p>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      {/* Account settings */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Account Settings</h3>
        <div className="space-y-3">
          {[
            { label: 'SMS Alerts for Weather', active: true },
            { label: 'Email Notifications', active: true },
            { label: 'Disease Detection Alerts', active: true },
            { label: 'Market Price Updates (Daily)', active: false },
          ].map(setting => (
            <div key={setting.label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-text)]">{setting.label}</span>
              <div className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative ${setting.active ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-600'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-all ${setting.active ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
