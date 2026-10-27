import { Router } from 'express';
import { getCachedWeather } from '../services/weatherCache.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(createRateLimiter({ name: 'weather', windowMs: 15 * 60 * 1000, limit: 60 }));

// Mapping WMO weather codes to UI icons/conditions
const mapCodeToCondition = (code) => {
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

router.get('/', async (req, res, next) => {
  try {
    const hasCoordinates = req.query.lat !== undefined && req.query.lon !== undefined;
    let lat = hasCoordinates ? Number(req.query.lat) : 20.00; // default Nashik for the general weather page
    let lon = hasCoordinates ? Number(req.query.lon) : 73.78;
    const requestedLocation = typeof req.query.location === 'string' ? req.query.location.trim() : '';

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers.' });
    }
    if (req.query.location !== undefined && !requestedLocation) {
      return res.status(400).json({ error: 'Location must be a non-empty string.' });
    }

    const cacheKey = hasCoordinates
      ? `coordinates:${lat.toFixed(3)},${lon.toFixed(3)}:${requestedLocation.toLocaleLowerCase()}`
      : requestedLocation ? `location:${requestedLocation.toLocaleLowerCase()}` : 'default';
    const weather = await getCachedWeather(cacheKey, async () => {
      let locationName = requestedLocation || 'Nashik, Maharashtra';

      // Farm-specific weather must use the saved farm location instead of silently
      // showing the general Nashik default.
      if (!hasCoordinates && requestedLocation) {
        const geocodeUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
        geocodeUrl.searchParams.set('name', requestedLocation);
        geocodeUrl.searchParams.set('count', '1');
        geocodeUrl.searchParams.set('language', 'en');
        geocodeUrl.searchParams.set('format', 'json');
        geocodeUrl.searchParams.set('countryCode', 'IN');
        const geocodeResponse = await fetch(geocodeUrl, { signal: AbortSignal.timeout(8000) });
        if (!geocodeResponse.ok) throw new Error('Failed to look up the farm location');
        const geocodeData = await geocodeResponse.json();
        const place = geocodeData.results?.[0];
        if (!place) {
          const error = new Error(`Could not find weather for ${requestedLocation}. Check the farm's village, district, and state.`);
          error.status = 422;
          throw error;
        }
        lat = place.latitude;
        lon = place.longitude;
        locationName = [place.name, place.admin2, place.admin1].filter(Boolean).join(', ');
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto`;
    
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Failed to fetch from Open-Meteo');
      const data = await response.json();

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
      };

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const forecast = data.daily.time.map((dateStr, i) => {
        const d = new Date(dateStr);
        const mapped = mapCodeToCondition(data.daily.weather_code[i]);
        return {
          dateISO: dateStr,
          day: days[d.getDay()],
          date: `${months[d.getMonth()]} ${d.getDate()}`,
          icon: mapped.icon,
          condition: mapped.condition,
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          rain: Math.round(data.daily.precipitation_probability_max[i]),
          precipitationMm: Math.round(Number(data.daily.precipitation_sum?.[i] || 0) * 10) / 10,
        };
      });

      const hourly = [];
      const currentTime = Date.now();
      for (let i = 0; i < data.hourly.time.length; i++) {
        const time = new Date(data.hourly.time[i]);
        // Include current hour and future hours
        if (time.getTime() >= currentTime - 3600000) {
          const mapped = mapCodeToCondition(data.hourly.weather_code[i]);
          hourly.push({
            time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
            temp: Math.round(data.hourly.temperature_2m[i]),
            icon: mapped.icon,
            rain: Math.round(data.hourly.precipitation_probability[i] || 0),
          });
          if (hourly.length >= 24) break;
        }
      }

      return { current, forecast, hourly };
    });
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json(weather);
  } catch (e) {
    next(e);
  }
});

export default router;
