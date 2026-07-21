// src/api/client.js — axios instance for the KisanAI backend
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 25000,
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('kisan_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch { /* sandboxed preview — no localStorage */ }
  return config;
});

// network-level failure (backend not running / CORS) vs. an actual API error response
export const isOfflineError = (err) => !err?.response;
export const apiErrorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error || fallback;
