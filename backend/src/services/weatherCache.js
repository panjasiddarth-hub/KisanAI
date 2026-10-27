const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 100;
const cache = new Map();
const pending = new Map();

// Reuse recent forecast responses and coalesce simultaneous requests for the
// same location so page changes and React dev reloads do not hit Open-Meteo again.
export function getCachedWeather(key, load, now = Date.now()) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached.value);
  }
  if (cached) cache.delete(key);
  if (pending.has(key)) return pending.get(key);

  const request = Promise.resolve()
    .then(load)
    .then(value => {
      cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function clearWeatherCache() {
  cache.clear();
  pending.clear();
}
