// src/pages/Profile.jsx
// User profile with edit form and farm summary

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useFarms } from '../hooks/useFarms';
import { useForm } from 'react-hook-form';
import PageHeader from '../components/ui/PageHeader';
import toast from 'react-hot-toast';
import { Loader2, User, Phone, MapPin, Mail, Edit2, Warehouse, Sprout } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile, changePassword, deleteAccount } = useAuth();
  const { farms, loading: farmsLoading } = useFarms();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmEmail: '' });

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

  const onChangePassword = async (event) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    setPasswordSubmitting(true);
    const result = await changePassword(passwords.current, passwords.next);
    setPasswordSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setPasswords({ current: '', next: '', confirm: '' });
    toast.success('Password changed. Other sessions were signed out.');
  };

  const onExportData = async () => {
    try {
      const { data } = await api.get('/auth/export');
      const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'kisanai-account-export.json';
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('Your account export has been downloaded.');
    } catch {
      toast.error('Could not export your account data. Please try again.');
    }
  };

  const onDeleteAccount = async (event) => {
    event.preventDefault();
    setDeleteSubmitting(true);
    const result = await deleteAccount(deleteForm.password, deleteForm.confirmEmail);
    setDeleteSubmitting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Your account and its farm records were deleted.');
    navigate('/');
  };

  const cropCount = useMemo(() => new Set(farms.flatMap(farm => farm.crops || []).filter(Boolean)).size, [farms]);
  const stats = [
    { label: 'Farm profiles', value: farmsLoading ? '…' : farms.length, icon: Warehouse, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
    { label: 'Recorded crop types', value: farmsLoading ? '…' : cropCount, icon: Sprout, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
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
        <div className="grid grid-cols-2 gap-3 mb-6">
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

      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-2">Notifications</h3>
        <p className="text-sm text-[var(--color-text-muted)]">SMS, email, disease, and market notifications are not connected yet. This page will show notification controls when delivery is implemented.</p>
      </div>

      <div className="card p-5 mt-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">Change password</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">Use at least 12 characters. Changing it signs out other sessions.</p>
        <form onSubmit={onChangePassword} className="space-y-3 max-w-lg">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            required
            value={passwords.current}
            onChange={(event) => setPasswords((value) => ({ ...value, current: event.target.value }))}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="New passphrase (12+ characters)"
            required
            minLength={12}
            value={passwords.next}
            onChange={(event) => setPasswords((value) => ({ ...value, next: event.target.value }))}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new passphrase"
            required
            value={passwords.confirm}
            onChange={(event) => setPasswords((value) => ({ ...value, confirm: event.target.value }))}
          />
          <button type="submit" disabled={passwordSubmitting} className="btn-primary flex items-center gap-2">
            {passwordSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
      </div>

      <div className="card p-5 mt-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">Your data</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">Download a copy of your account, farms, crops, and crop calendars.</p>
        <button type="button" onClick={onExportData} className="btn-secondary">Download my data</button>
      </div>

      <div className="card p-5 mt-5 border border-red-300 dark:border-red-900">
        <h3 className="font-bold text-sm text-red-700 dark:text-red-400 mb-1">Delete account</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          This permanently deletes your account, farms, crops, and crop calendars. Download your data first if you need a copy.
        </p>
        <form onSubmit={onDeleteAccount} className="space-y-3 max-w-lg">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            value={deleteForm.password}
            onChange={(event) => setDeleteForm((value) => ({ ...value, password: event.target.value }))}
          />
          <label className="block text-xs text-[var(--color-text-muted)]">
            Type <strong className="text-[var(--color-text)]">{user?.email}</strong> to confirm.
            <input
              className="input mt-2"
              type="email"
              autoComplete="email"
              required
              value={deleteForm.confirmEmail}
              onChange={(event) => setDeleteForm((value) => ({ ...value, confirmEmail: event.target.value }))}
            />
          </label>
          <button type="submit" disabled={deleteSubmitting} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-60">
            {deleteSubmitting ? 'Deleting account…' : 'Permanently delete my account'}
          </button>
        </form>
      </div>
    </div>
  );
}
