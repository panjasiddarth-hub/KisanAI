import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Cloud, CloudRain, CloudSun, Droplets, FlaskConical,
  MapPin, Plus, Sprout, Sun, Wind, MessageCircle, Leaf, Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarms } from '../hooks/useFarms';
import { getWeather } from '../api/weather';
import dashboardFarmHero from '../assets/dashboard-farm-hero.webp';

const ACTIONS = [
  { title: 'Plan a crop', detail: 'Get a model-based crop suggestion', icon: Sprout, path: '/agents/crop', tone: 'green' },
  { title: 'Check fertilizer', detail: 'Review soil nutrient ratings', icon: FlaskConical, path: '/agents/fertilizer', tone: 'amber' },
  { title: 'Disease assessment', detail: 'Preliminary 38-class leaf-photo screening', icon: Camera, path: '/disease', tone: 'rose' },
  { title: 'Ask KisanAI', detail: 'Get help across your farm tasks', icon: MessageCircle, path: '/ai-assistant', tone: 'blue' },
];

const WEATHER_ICONS = { Sun, Cloud, CloudRain, CloudSun };

function farmWeatherLocation(farm) {
  if (farm?.village && farm?.district && farm?.state) return `${farm.village}, ${farm.district}, ${farm.state}`;
  if (farm?.district && farm?.state) return `${farm.district}, ${farm.state}`;
  return farm?.location || '';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { farms, loading: farmsLoading } = useFarms();
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    if (farmsLoading) return undefined;
    let active = true;
    const location = farmWeatherLocation(farms[0]);
    setWeatherLoading(true);
    setWeatherError(false);
    getWeather(location ? { location } : {})
      .then(data => { if (active) setWeather(data); })
      .catch(() => { if (active) setWeatherError(true); })
      .finally(() => { if (active) setWeatherLoading(false); });
    return () => { active = false; };
  }, [farms, farmsLoading]);

  const firstName = (user?.name || 'Farmer').trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const totalArea = useMemo(() => farms.reduce((sum, farm) => sum + (Number(farm.area) || 0), 0), [farms]);
  const crops = useMemo(() => [...new Set(farms.flatMap(farm => farm.crops || []).filter(Boolean))], [farms]);
  const CurrentWeatherIcon = WEATHER_ICONS[weather?.current?.icon] || CloudSun;

  return (
    <div className="page-content dashboard-page">
      <section className="dashboard-welcome" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 37, 19, .88) 0%, rgba(13, 54, 27, .72) 48%, rgba(14, 47, 24, .24) 100%), url("${dashboardFarmHero}")` }}>
        <div>
          <span className="dashboard-eyebrow"><Leaf size={14} /> Your farm workspace</span>
          <h1>{greeting}, {firstName}</h1>
          <p>Your farm workspace is ready. Choose what you want help with today.</p>
        </div>
        <div className="dashboard-welcome-actions">
          <button className="dashboard-add-button" onClick={() => navigate('/farms')}>
            <Plus size={17} /> Add or manage farm
          </button>
        </div>
      </section>

      <div className="dashboard-grid">
        <main className="dashboard-main">
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div><h2>Your farms</h2><p>Information saved in your farm profiles</p></div>
              <button className="dashboard-text-link" onClick={() => navigate('/farms')}>View farms <ArrowRight size={15} /></button>
            </div>
            {farmsLoading ? (
              <div className="dashboard-farm-grid"><div className="skeleton h-36 rounded-2xl" /><div className="skeleton h-36 rounded-2xl" /></div>
            ) : farms.length ? (
              <>
                <div className="dashboard-summary-grid">
                  <div className="dashboard-summary-card"><span className="dashboard-summary-icon green"><MapPin size={18} /></span><div><strong>{farms.length}</strong><span>{farms.length === 1 ? 'Farm profile' : 'Farm profiles'}</span></div></div>
                  <div className="dashboard-summary-card"><span className="dashboard-summary-icon blue"><Sprout size={18} /></span><div><strong>{totalArea.toLocaleString(undefined, { maximumFractionDigits: 2 })} <small>{farms[0]?.areaUnit || 'acres'}</small></strong><span>Total recorded area</span></div></div>
                  <div className="dashboard-summary-card"><span className="dashboard-summary-icon amber"><Leaf size={18} /></span><div><strong>{crops.length}</strong><span>Recorded crop types</span></div></div>
                </div>
                <div className="dashboard-farm-grid">
                  {farms.slice(0, 3).map(farm => (
                    <button className="dashboard-farm-card" key={farm.id} onClick={() => navigate('/farms')}>
                      <span className="dashboard-farm-mark"><Sprout size={19} /></span>
                      <span className="dashboard-farm-info"><strong>{farm.name || 'My farm'}</strong><span><MapPin size={13} /> {farm.village || farm.location || farm.district || 'Location not added'}</span></span>
                      <span className="dashboard-farm-area">{farm.area ?? '—'} {farm.areaUnit || 'acres'}</span>
                    </button>
                  ))}
                  {farms.length > 3 && <button className="dashboard-more-farms" onClick={() => navigate('/farms')}>+{farms.length - 3} more farms</button>}
                </div>
              </>
            ) : (
              <div className="dashboard-empty-farms">
                <span className="dashboard-empty-icon"><Sprout size={22} /></span>
                <div><strong>Add your first farm profile</strong><p>Save its location, size, soil, and crops to make agent recommendations easier to personalize.</p></div>
                <button onClick={() => navigate('/farms')}>Add farm <ArrowRight size={15} /></button>
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div><h2>Farm tools</h2><p>Start with the task you want to work on</p></div>
            </div>
            <div className="dashboard-action-grid">
              {ACTIONS.map(({ title, detail, icon: Icon, path, tone }) => (
                <button key={title} className="dashboard-action-card" onClick={() => navigate(path)}>
                  <span className={`dashboard-action-icon ${tone}`}><Icon size={19} /></span>
                  <span className="dashboard-action-copy"><strong>{title}</strong><span>{detail}</span></span>
                  <ArrowRight className="dashboard-action-arrow" size={17} />
                </button>
              ))}
            </div>
          </section>

          <section className="dashboard-next-step">
            <span className="dashboard-next-icon"><BarChart3 size={19} /></span>
            <div><strong>Want to review the market?</strong><p>Open market information and available price estimates for your planning.</p></div>
            <button onClick={() => navigate('/market')}>Open market <ArrowRight size={15} /></button>
          </section>
        </main>

        <aside className="dashboard-side">
          <section className="dashboard-weather-card">
            <div className="dashboard-weather-heading"><div><span className="dashboard-eyebrow">FORECAST CONTEXT · NOT AN AGRONOMY ADVISORY</span><h2>Weather</h2></div><button onClick={() => navigate('/weather')}>Details <ArrowRight size={14} /></button></div>
            {weatherLoading ? <div className="skeleton h-40 rounded-xl mt-4" /> : weather ? (
              <>
                <div className="dashboard-current-weather"><CurrentWeatherIcon size={35} /><div><strong>{weather.current.temperature}°</strong><span>{weather.current.condition}</span></div></div>
                <p className="dashboard-weather-location"><MapPin size={13} /> {weather.current.location}</p>
                <div className="dashboard-weather-metrics">
                  <div><Droplets size={15} /><strong>{weather.current.humidity}%</strong><span>Humidity</span></div>
                  <div><Wind size={15} /><strong>{weather.current.wind} km/h</strong><span>Wind</span></div>
                  <div><CloudRain size={15} /><strong>{weather.current.rainChance}%</strong><span>Rain chance</span></div>
                </div>
                {weather.forecast?.length > 0 && <div className="dashboard-forecast"><span>Next days</span><div>{weather.forecast.slice(0, 4).map(day => {
                  const Icon = WEATHER_ICONS[day.icon] || CloudSun;
                  return <div key={day.date || day.day}><small>{day.day.slice(0, 3)}</small><Icon size={16} /><strong>{day.high}°</strong><small>{day.low}°</small></div>;
                })}</div></div>}
              </>
            ) : <p className="dashboard-weather-error">{weatherError ? 'Weather could not be loaded right now.' : 'Weather data is unavailable.'} <button onClick={() => navigate('/weather')}>Open weather</button></p>}
          </section>
          <section className="dashboard-note-card">
            <span className="dashboard-note-icon"><FlaskConical size={18} /></span>
            <div><strong>Recommendations need good inputs</strong><p>Check soil test values and farm details before using crop or fertilizer agents.</p><button onClick={() => navigate('/farms')}>Review farm profile <ArrowRight size={14} /></button></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
