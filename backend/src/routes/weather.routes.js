import { Router } from 'express';

const router = Router();

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
    const lat = req.query.lat || 20.00; // default Nashik
    const lon = req.query.lon || 73.78;
    const locationName = req.query.location || 'Nashik, Maharashtra';

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    
    const response = await fetch(url);
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
      icon: currentCode.icon
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
        rain: Math.round(data.daily.precipitation_probability_max[i])
      };
    });

    const hourly = [];
    const currentTime = new Date().getTime();
    for (let i = 0; i < data.hourly.time.length; i++) {
      const time = new Date(data.hourly.time[i]);
      // Include current hour and future hours
      if (time.getTime() >= currentTime - 3600000) {
        const mapped = mapCodeToCondition(data.hourly.weather_code[i]);
        hourly.push({
          time: time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          temp: Math.round(data.hourly.temperature_2m[i]),
          icon: mapped.icon,
          rain: Math.round(data.hourly.precipitation_probability[i] || 0)
        });
        if (hourly.length >= 24) break;
      }
    }

    res.json({ current, forecast, hourly });
  } catch (e) {
    next(e);
  }
});

export default router;
