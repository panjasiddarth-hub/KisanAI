// src/services/openMeteo.js — Open-Meteo client (no API key needed).
// Used by /api/weather, farm weather and farm crop recommendations.
// Every value returned is labelled with its kind so the UI never mixes up
// model estimates, forecasts and historical (observation-based) data.

const TIMEOUT_MS = 10000;
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const DAY_MS = 86400000;

export class WeatherUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeatherUnavailableError';
    this.status = 502;
  }
}

export const isValidCoord = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new WeatherUnavailableError(`Weather service unreachable (${e.name === 'TimeoutError' ? 'timed out' : e.message})`);
  }
  if (!res.ok) throw new WeatherUnavailableError(`Weather service returned HTTP ${res.status}`);
  return res.json();
}

// Daily water-balance inputs for irrigation advice: FAO-56 Penman-Monteith reference
// evapotranspiration (ET0), rain and rain probability. The past days come from the weather
// model's own estimate for those days — they are not rain-gauge readings.
export async function fetchWaterBalance(lat, lon, { pastDays = 2, forecastDays = 7 } = {}) {
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration&past_days=${pastDays}&forecast_days=${forecastDays}&timezone=auto`;
  const data = await getJson(url);
  const d = data.daily;
  if (!d?.time?.length) throw new WeatherUnavailableError('Weather service returned no daily data');
  const val = (arr, i) => (arr && Number.isFinite(arr[i]) ? arr[i] : null);
  return {
    today: d.time[pastDays],
    timezone: data.timezone,
    days: d.time.map((date, i) => ({
      date,
      kind: i < pastDays ? 'recent-model-estimate' : 'forecast',
      rainMm: val(d.precipitation_sum, i),
      rainProbability: val(d.precipitation_probability_max, i),
      et0Mm: val(d.et0_fao_evapotranspiration, i),
    })),
    source: 'Open-Meteo forecast API (ET0 = FAO-56 Penman-Monteith reference evapotranspiration)',
    fetchedAt: new Date().toISOString(),
  };
}

// Mapping WMO weather codes to UI icons/conditions
export const mapCodeToCondition = (code) => {
  if (code === 0) return { icon: 'Sun', condition: 'Clear Sky' };
  if (code === 1 || code === 2) return { icon: 'Sun', condition: 'Partly Cloudy' };
  if (code === 3) return { icon: 'Cloud', condition: 'Overcast' };
  if (code >= 45 && code <= 48) return { icon: 'Cloud', condition: 'Fog' };
  if (code >= 51 && code <= 55) return { icon: 'CloudRain', condition: 'Drizzle' };
  if (code >= 61 && code <= 65) return { icon: 'CloudRain', condition: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: 'CloudRain', condition: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: 'CloudRain', condition: 'Showers' };
  if (code >= 95 && code <= 99) return { icon: 'CloudLightning', condition: 'Thunderstorm' };
  return { icon: 'Cloud', condition: 'Unknown' };
};

// Current conditions + hourly/daily forecast (same response shape the Weather page already uses,
// plus explicit `kind` labels and source metadata).
export async function fetchForecast(lat, lon, locationName) {
  if (!isValidCoord(lat, lon)) throw new WeatherUnavailableError('Invalid coordinates');
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
  const data = await getJson(url);

  const currentCode = mapCodeToCondition(data.current.weather_code);
  const current = {
    location: locationName,
    temperature: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    humidity: Math.round(data.current.relative_humidity_2m),
    wind: Math.round(data.current.wind_speed_10m),
    pressure: Math.round(data.current.surface_pressure),
    rainChance: Math.round(data.current.precipitation_probability || 0),
    condition: currentCode.condition,
    icon: currentCode.icon,
    kind: 'model-estimate',
    validAt: data.current.time,
  };

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const forecast = data.daily.time.map((dateStr, i) => {
    const d = new Date(dateStr);
    const mapped = mapCodeToCondition(data.daily.weather_code[i]);
    return {
      day: days[d.getDay()],
      date: `${months[d.getMonth()]} ${d.getDate()}`,
      icon: mapped.icon,
      condition: mapped.condition,
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      rain: Math.round(data.daily.precipitation_probability_max[i]),
      kind: 'forecast',
    };
  });

  const hourly = [];
  const now = Date.now();
  for (let i = 0; i < data.hourly.time.length; i++) {
    const time = new Date(data.hourly.time[i]);
    if (time.getTime() >= now - 3600000) {
      const mapped = mapCodeToCondition(data.hourly.weather_code[i]);
      hourly.push({
        time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        temp: Math.round(data.hourly.temperature_2m[i]),
        icon: mapped.icon,
        rain: Math.round(data.hourly.precipitation_probability[i] || 0),
        kind: 'forecast',
      });
      if (hourly.length >= 24) break;
    }
  }

  return {
    current,
    forecast,
    hourly,
    meta: {
      provider: 'Open-Meteo',
      coordinates: { lat, lon },
      currentIs: 'Weather-model estimate for the current 15-minute interval — not a ground-station observation',
      forecastIs: 'Forecast (model prediction) — not observed weather',
    },
  };
}

const fmtDate = (d) => d.toISOString().slice(0, 10);
const round1 = (n) => Math.round(n * 10) / 10;

// Historical season climate at a location: averages over the same `days`-long window that starts on
// the planned sowing date, in each of the last `years` years (ERA5 reanalysis, ~5-day publication lag).
// Rainfall is also expressed per 30 days, which is the scale the crop model's rainfall feature uses.
export async function fetchSeasonClimate(lat, lon, startDateStr, { days = 120, years = 5 } = {}) {
  if (!isValidCoord(lat, lon)) throw new WeatherUnavailableError('Invalid coordinates');
  const start = new Date(`${startDateStr}T00:00:00Z`);
  const latestAvailable = new Date(Date.now() - 6 * DAY_MS);

  const windows = [];
  for (let k = 1; windows.length < years && k <= years + 2; k++) {
    const ws = new Date(start);
    ws.setUTCFullYear(start.getUTCFullYear() - k);
    const we = new Date(ws.getTime() + (days - 1) * DAY_MS);
    if (we <= latestAvailable) windows.push([ws, we]);
  }
  if (!windows.length) throw new WeatherUnavailableError('No complete historical seasons available for this date');

  const from = fmtDate(windows[windows.length - 1][0]);
  const to = fmtDate(windows[0][1]);
  const url = `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}&start_date=${from}&end_date=${to}&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum&timezone=auto`;
  const data = await getJson(url);
  const d = data.daily;
  if (!d?.time?.length) throw new WeatherUnavailableError('Historical weather returned no data for this location');

  let tSum = 0, tN = 0, hSum = 0, hN = 0;
  const seasonRain = [];
  const usedYears = [];
  for (const [ws, we] of windows) {
    let rain = 0, rainDays = 0;
    for (let i = 0; i < d.time.length; i++) {
      const t = new Date(`${d.time[i]}T00:00:00Z`);
      if (t < ws || t > we) continue;
      if (d.temperature_2m_mean[i] != null) { tSum += d.temperature_2m_mean[i]; tN++; }
      if (d.relative_humidity_2m_mean[i] != null) { hSum += d.relative_humidity_2m_mean[i]; hN++; }
      if (d.precipitation_sum[i] != null) { rain += d.precipitation_sum[i]; rainDays++; }
    }
    if (rainDays >= days * 0.9) { seasonRain.push(rain); usedYears.push(ws.getUTCFullYear()); }
  }
  if (!tN || !hN || !seasonRain.length) throw new WeatherUnavailableError('Historical weather is incomplete for this location');

  const avgSeasonRain = seasonRain.reduce((a, b) => a + b, 0) / seasonRain.length;
  return {
    kind: 'historical-reanalysis',
    source: 'Open-Meteo Historical Weather API (ERA5 reanalysis — observation-based, not a forecast)',
    temperature: round1(tSum / tN),
    humidity: round1(hSum / hN),
    rainfall: round1(avgSeasonRain / (days / 30)),
    seasonRainfallTotal: round1(avgSeasonRain),
    window: { days, startsOn: startDateStr.slice(5), years: usedYears.sort() },
    gridCoordinates: { lat: data.latitude, lon: data.longitude },
  };
}

// Place-name search for manual farm location entry.
export async function geocode(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const data = await getJson(url);
  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}
