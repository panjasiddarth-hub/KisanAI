// src/pages/Login.jsx
// Beautiful login page with green theme

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetStep, setResetStep] = useState('login');
  const [resetContact, setResetContact] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { register, handleSubmit, setValue, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    const result = await login(data.identifier, data.password);
    setSubmitting(false);
    if (result.success) {
      toast.success('Welcome back! 🌾');
      navigate('/farms');
    } else {
      toast.error(result.error);
    }
  };

  const onRequestReset = async (event) => {
    event.preventDefault();
    const contact = resetContact.trim();
    const contactType = contact.includes('@') ? 'email' : 'phone';
    setSubmitting(true);
    const result = await requestPasswordReset(contactType, contactType === 'email' ? contact.toLowerCase() : contact);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    setResetStep('verify');
    toast.success(result.message);
  };

  const onResetPassword = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(resetCode)) return toast.error('Enter the 6-digit reset code.');
    if (newPassword !== confirmPassword) return toast.error('The passwords do not match.');
    setSubmitting(true);
    const contactType = resetContact.includes('@') ? 'email' : 'phone';
    const result = await resetPassword(contactType, resetContact, resetCode, newPassword);
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    setValue('identifier', resetContact);
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetStep('login');
    toast.success(result.message);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — illustration */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-green-700 via-emerald-600 to-teal-700 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Sampoorn Kisan</p>
            <p className="text-green-200 text-sm">AI Sahayak</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Smart Farming<br />Starts Here 🌾
          </h2>
          <p className="text-green-100 text-lg leading-relaxed mb-8">
            Farm profiles, experimental crop and soil models, forecast context, draft planning tools, and links to official references. This project is still under development.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['🌱 Crop model · experimental', '🌦️ Forecast context', '🔬 Disease photo screening · preliminary', '📈 Market · demo estimates', '🧪 Soil nutrient ratings', '🏛️ Official scheme links'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/15 text-white text-sm font-medium backdrop-blur-sm">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="relative rounded-xl bg-white/10 p-4 text-sm leading-relaxed text-green-100 backdrop-blur-sm">
          KisanAI is a development project. Model outputs are experimental; verify important farm decisions with local agricultural experts.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--color-bg)]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-[var(--color-text)]">Sampoorn Kisan AI Sahayak</p>
          </div>

          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
            {resetStep === 'login' ? 'Welcome back!' : resetStep === 'request' ? 'Reset your password' : 'Choose a new password'}
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mb-8">
            {resetStep === 'login' ? 'Sign in to your Kisan account' : resetStep === 'request' ? 'We’ll send a one-time code if an account matches.' : `Enter the code sent to ${resetContact}.`}
          </p>

          {resetStep === 'login' ? <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email or phone */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email or phone number</label>
              <input
                type="text"
                autoComplete="username"
                placeholder="farmer@example.com or +919876543210"
                className="input"
                {...register('identifier', { required: 'Email or phone number is required', validate: value => (value.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : /^\+[1-9]\d{7,14}$/.test(value)) || 'Enter a valid email or phone with country code' })}
              />
              {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--color-text)]">Password</label>
                <button type="button" onClick={() => setResetStep('request')} className="text-xs font-semibold text-green-700 hover:underline dark:text-green-400">Forgot password?</button>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pr-10"
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form> : resetStep === 'request' ? (
            <form onSubmit={onRequestReset} className="space-y-4">
              <label className="block text-sm font-medium text-[var(--color-text)]" htmlFor="reset-contact">Email or phone number</label>
              <input id="reset-contact" className="input" autoComplete="username" placeholder="farmer@example.com or +919876543210" value={resetContact} onChange={event => setResetContact(event.target.value)} required />
              <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Sending code…' : 'Send reset code'}</button>
              <button type="button" onClick={() => setResetStep('login')} className="w-full text-sm font-semibold text-green-700 hover:underline dark:text-green-400">Back to sign in</button>
            </form>
          ) : (
            <form onSubmit={onResetPassword} className="space-y-4">
              <label className="block text-sm font-medium text-[var(--color-text)]" htmlFor="reset-code">6-digit reset code</label>
              <input id="reset-code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={resetCode} onChange={event => setResetCode(event.target.value.replace(/\D/g, ''))} required />
              <label className="block text-sm font-medium text-[var(--color-text)]" htmlFor="new-password">New passphrase</label>
              <input id="new-password" className="input" type="password" autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
              <label className="block text-sm font-medium text-[var(--color-text)]" htmlFor="confirm-new-password">Confirm new passphrase</label>
              <input id="confirm-new-password" className="input" type="password" autoComplete="new-password" minLength={12} maxLength={72} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
              <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Resetting password…' : 'Reset password'}</button>
              <button type="button" disabled={submitting} onClick={onRequestReset} className="w-full text-sm font-semibold text-green-700 hover:underline disabled:opacity-60 dark:text-green-400">Send a new code</button>
              <button type="button" onClick={() => setResetStep('login')} className="w-full text-sm text-[var(--color-text-muted)] hover:underline">Back to sign in</button>
            </form>
          )}

          {resetStep === 'login' && <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-600 font-semibold hover:underline">Create one free</Link>
          </p>}
        </div>
      </div>
    </div>
  );
}
