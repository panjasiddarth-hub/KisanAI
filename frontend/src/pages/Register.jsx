// src/pages/Register.jsx
// Registration page with role selection

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Leaf, Eye, EyeOff, Loader2, Tractor } from 'lucide-react';

export default function Register() {
  const { register: registerUser } = useAuth();
  const { verifySignupOtp } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingSignup, setPendingSignup] = useState(null);
  const [otp, setOtp] = useState('');
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: { contactType: 'email' } });
  const password = watch('password');
  const contactType = watch('contactType');

  const onSubmit = async (data) => {
    setSubmitting(true);
    const rawContact = data.contactType === 'email' ? data.email : data.phone;
    const contact = data.contactType === 'email' ? rawContact.trim().toLowerCase() : rawContact.trim();
    const result = await registerUser(data.name, data.contactType, contact, data.password);
    setSubmitting(false);
    if (result.success) {
      setPendingSignup({ contactType: data.contactType, contact });
      toast.success(result.message || 'Verification code sent');
    } else {
      toast.error(result.error);
    }
  };

  const onVerify = async (event) => {
    event.preventDefault();
    if (!pendingSignup || !/^\d{6}$/.test(otp)) return toast.error('Enter the 6-digit code');
    setSubmitting(true);
    const result = await verifySignupOtp(pendingSignup.contactType, pendingSignup.contact, otp);
    setSubmitting(false);
    if (result.success) { toast.success('Contact verified. Welcome to KisanAI!'); navigate('/farms'); }
    else toast.error(result.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-green-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md card p-8 fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-200 dark:shadow-green-900">
            <Leaf className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-[var(--color-text)] mb-1">Create Your Account</h1>
        <p className="text-sm text-center text-[var(--color-text-muted)] mb-6">Create your farm workspace and start planning.</p>

        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
          <div className="flex items-center justify-center gap-2">
            <Tractor className="w-4 h-4" />
            Farmer account only
          </div>
        </div>

        {pendingSignup ? (
          <form onSubmit={onVerify} className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Enter the 6-digit code sent to <strong>{pendingSignup.contact}</strong>. The code expires in 10 minutes.</p>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Verification code</label>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} className="input" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" />
            </div>
            <button type="submit" disabled={submitting || otp.length !== 6} className="btn-primary w-full flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}{submitting ? 'Verifying...' : 'Verify and create account'}
            </button>
            <button type="button" className="w-full text-sm text-green-600 font-semibold" onClick={() => setPendingSignup(null)}>Change details / request a new code</button>
          </form>
        ) : <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="Ramesh Kumar"
              className="input"
              {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {/* Contact method */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Sign up with</label>
            <select className="input mb-3" {...register('contactType')}>
              <option value="email">Email</option><option value="phone">Phone number</option>
            </select>
            {contactType === 'email' ? <>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="input"
              autoComplete="email"
              {...register('email', { required: contactType === 'email' ? 'Email is required' : false, maxLength: { value: 254, message: 'Email is too long' }, pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </> : <>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Phone number</label>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+919876543210" className="input" {...register('phone', { required: contactType === 'phone' ? 'Phone number is required' : false, pattern: { value: /^\+[1-9]\d{7,14}$/, message: 'Include country code, e.g. +919876543210' } })} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="At least 12 characters"
                className="input pr-10"
                {...register('password', {
                  required: 'Password is required',
                  validate: {
                    minCharacters: value => [...value].length >= 12 || 'Use at least 12 characters',
                    bcryptLimit: value => new TextEncoder().encode(value).length <= 72 || 'Use no more than 72 UTF-8 bytes',
                  },
                })}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Use a memorable passphrase with 12 or more characters.</p>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Confirm Password</label>
            <input
              type="password"
              placeholder="Repeat password"
              className="input"
              {...register('confirmPassword', {
                required: 'Please confirm password',
                validate: val => val === password || 'Passwords do not match'
              })}
            />
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Sending code...' : 'Send verification code'}
          </button>
        </form>}

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
