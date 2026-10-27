import { api } from './client';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const pending = new Map();

function weatherPath(options = {}) {
  const params = new URLSearchParams();
  if (options.lat !== undefined && options.lon !== undefined) {
    params.set('lat', options.lat);
    params.set('lon', options.lon);
  }
  if (options.location) params.set('location', options.location);
  const query = params.toString();
  return `/weather${query ? `?${query}` : ''}`;
}

export async function getWeather(options = {}) {
  const path = weatherPath(options);
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) cache.delete(path);
  if (pending.has(path)) return pending.get(path);

  const request = api.get(path)
    .then(({ data }) => {
      cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    })
    .finally(() => pending.delete(path));
  pending.set(path, request);
  return request;
}
