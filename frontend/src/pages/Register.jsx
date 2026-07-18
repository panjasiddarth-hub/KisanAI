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
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    setSubmitting(true);
    const result = await registerUser(data.name, data.email, data.password);
    setSubmitting(false);
    if (result.success) {
      toast.success('Account created! Welcome to Kisan AI 🌾');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
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
        <p className="text-sm text-center text-[var(--color-text-muted)] mb-6">Join 10,000+ farmers using Kisan AI</p>

        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
          <div className="flex items-center justify-center gap-2">
            <Tractor className="w-4 h-4" />
            Farmer account only
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="input"
              {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                className="input pr-10"
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'At least 6 characters' } })}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
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
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
