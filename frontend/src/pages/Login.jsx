// src/pages/Login.jsx
// Beautiful login page with green theme

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    const result = await login(data.email, data.password);
    setSubmitting(false);
    if (result.success) {
      toast.success('Welcome back! 🌾');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
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
            AI-powered crop recommendations, disease detection, weather insights, and market intelligence — all in one platform.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['🌱 Crop AI', '🌦️ Weather', '🔬 Disease Detection', '📈 Market Prices', '💧 Irrigation', '🏛️ Gov. Schemes'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/15 text-white text-sm font-medium backdrop-blur-sm">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-4">
          {[{ v: '10K+', l: 'Farmers' }, { v: '95%', l: 'Accuracy' }, { v: '24/7', l: 'AI Support' }].map(s => (
            <div key={s.l} className="text-center p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">{s.v}</p>
              <p className="text-green-200 text-xs">{s.l}</p>
            </div>
          ))}
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

          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">Welcome back!</h1>
          <p className="text-[var(--color-text-muted)] text-sm mb-8">Sign in to your Kisan account</p>

          {/* Demo credentials hint */}
          <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">🌾 Demo Credentials</p>
            <p className="text-xs text-green-600 dark:text-green-500">Farmer demo: ramesh@kisan.com / password123</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="ramesh@kisan.com"
                className="input"
                {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--color-text)]">Password</label>
                <Link to="/forgot-password" className="text-xs text-green-600 hover:underline">Forgot password?</Link>
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
          </form>

          <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-green-600 font-semibold hover:underline">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
