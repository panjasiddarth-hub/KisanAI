// src/components/farms/FarmLocationField.jsx
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react';
import { api, apiErrorMessage } from '../../api/client';
import { isConfirmedLocation } from '../../hooks/useFarms';

const INDIA_CENTER = [20.5937, 78.9629];
const pinIcon = L.divIcon({
  className: '',
  html: '<svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path fill="#15803d" stroke="white" stroke-width="2" d="M17 1C8.2 1 1 8.2 1 17c0 11 16 24 16 24s16-13 16-24C33 8.2 25.8 1 17 1Z"/><circle cx="17" cy="17" r="5" fill="white"/></svg>',
  iconSize: [34, 42],
  iconAnchor: [17, 41],
});
const fmt = (n) => Number(n).toFixed(5);

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, Math.max(map.getZoom(), 13)); }, [center, map]);
  return null;
}

function ClickToPlacePin({ onSelect }) {
  useMapEvents({ click: (event) => onSelect(event.latlng) });
  return null;
}

export default function FarmLocationField({ value, onChange }) {
  const savedLocation = isConfirmedLocation(value);
  const [selected, setSelected] = useState(() => savedLocation
    ? { ...value, confirmed: true }
    : null);
  const [center, setCenter] = useState(() => savedLocation ? [value.lat, value.lon] : INDIA_CENTER);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(selected);
  const requestRef = useRef(0);
  const selectedLat = selected?.lat;
  const selectedLon = selected?.lon;
  const selectedSource = selected?.source;

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  selectedRef.current = selected;

  useEffect(() => {
    if (!Number.isFinite(selectedLat) || !Number.isFinite(selectedLon) || selectedSource === 'geocoded') return undefined;
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError('');
      try {
        const { data } = await api.get('/weather/reverse-geocode', {
          params: { lat: selectedLat, lon: selectedLon },
        });
        if (requestRef.current !== requestId) return;
        const latest = selectedRef.current;
        if (!latest || latest.lat !== selectedLat || latest.lon !== selectedLon) return;
        const updated = { ...latest, label: data.label || latest.label };
        setSelected(updated);
        onChangeRef.current(updated);
      } catch (err) {
        if (requestRef.current === requestId) {
          setError(apiErrorMessage(err, 'Could not find the nearby place name. Your map pin is still selected.'));
        }
      } finally {
        if (requestRef.current === requestId) setBusy(false);
      }
    }, 1000);
    return () => { window.clearTimeout(timer); requestRef.current += 1; };
  }, [selectedLat, selectedLon, selectedSource]);

  const chooseLocation = (lat, lon, source, label = `Nearby farm (${fmt(lat)}, ${fmt(lon)})`) => {
    const next = { lat, lon, source, label, confirmed: true };
    setSelected(next);
    setResults([]);
    setError('');
    onChangeRef.current(next);
  };

  const useDevice = () => {
    setError('');
    if (!('geolocation' in navigator)) {
      setError('Location is not available on this device. Search for your village or tap the map instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setCenter(coords);
        chooseLocation(coords[0], coords[1], 'device');
      },
      () => { setBusy(false); setError('Could not get your device location. Search for your village or tap the map instead.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const search = async () => {
    setError('');
    if (query.trim().length < 2) { setError('Type your village or town name.'); return; }
    setBusy(true);
    try {
      const { data } = await api.get('/weather/geocode', { params: { q: query.trim() } });
      setResults(data.results);
      if (!data.results.length) setError('No place found. Try your nearest town or district.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Place search is unavailable right now. Tap the map to choose your farm.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-3" data-testid="farm-location-field">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-green-600" /> Where is your farm?
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Tap your field on the map or drag the pin to it. We’ll use this spot for local weather and rainfall.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <input className="input !py-2 text-sm min-w-0" placeholder="Search your village or town" value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} />
          <button type="button" onClick={search} disabled={busy} className="btn-secondary text-xs shrink-0">
            <Search className="w-3.5 h-3.5 inline mr-1" /> Search
          </button>
        </div>
        <button type="button" onClick={useDevice} disabled={busy} className="btn-secondary text-xs shrink-0">
          <Crosshair className="w-3.5 h-3.5 inline mr-1" /> Use my location
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-36 overflow-auto">
          {results.map((result) => (
            <button type="button" key={`${result.lat},${result.lon}`}
              onClick={() => {
                const lat = Number(result.lat);
                const lon = Number(result.lon);
                setCenter([lat, lon]);
                chooseLocation(lat, lon, 'geocoded', result.label);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700/40">
              {result.label}
            </button>
          ))}
        </div>
      )}

      <div className="h-64 sm:h-72 rounded-lg overflow-hidden border border-[var(--color-border)]" data-testid="farm-location-map">
        <MapContainer center={center} zoom={selected ? 13 : 5} scrollWheelZoom className="h-full w-full">
          <RecenterMap center={center} />
          <ClickToPlacePin onSelect={({ lat, lng }) => chooseLocation(lat, lng, 'manual')} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={selected ? [selected.lat, selected.lon] : center}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                chooseLocation(lat, lng, 'manual');
              },
            }}
          />
        </MapContainer>
      </div>

      <div aria-live="polite" className="min-h-5 text-xs">
        {busy && <p className="text-[var(--color-text-muted)] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding your village…</p>}
        {selected && !busy && <p className="text-green-700 dark:text-green-400 font-medium">{selected.label} <span className="font-normal text-[var(--color-text-muted)]">· {fmt(selected.lat)}, {fmt(selected.lon)}</span></p>}
        {error && <p className="text-amber-700 dark:text-amber-400">{error}</p>}
      </div>
      <p className="text-[0.65rem] text-[var(--color-text-muted)]">Map © OpenStreetMap contributors. Your map pin gives nearby place and weather details; it cannot tell us your soil test results.</p>
    </div>
  );
}
