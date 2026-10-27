import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const INDIA_CENTER = [20.5937, 78.9629];
const GEOCODING_URL = import.meta.env.VITE_GEOCODING_URL || 'https://nominatim.openstreetmap.org/search';
const pinIcon = L.divIcon({
  className: 'kisan-map-pin',
  html: '<span aria-hidden="true">📍</span>',
  iconSize: [36, 40],
  iconAnchor: [18, 38],
});

export default function FarmLocationPicker({ coordinates, onChange, searchText = '' }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const marker = useRef(null);
  const initialCoordinates = useRef(coordinates);
  const onChangeRef = useRef(onChange);
  const lastSearchTime = useRef(0);
  const [searching, setSearching] = useState(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return undefined;
    const initial = initialCoordinates.current;
    const hasCoordinates = Number.isFinite(initial?.latitude) && Number.isFinite(initial?.longitude);
    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView(
      hasCoordinates ? [initial.latitude, initial.longitude] : INDIA_CENTER,
      hasCoordinates ? 15 : 5,
    );
    mapInstance.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    }).addTo(map);

    const placePin = (latitude, longitude) => {
      if (marker.current) marker.current.setLatLng([latitude, longitude]);
      else marker.current = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(map);
      marker.current.off('dragend');
      marker.current.on('dragend', () => {
        const point = marker.current.getLatLng();
        onChangeRef.current({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
      });
      onChangeRef.current({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) });
    };

    map.on('click', event => placePin(event.latlng.lat, event.latlng.lng));
    if (hasCoordinates) placePin(initial.latitude, initial.longitude);
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstance.current = null;
      marker.current = null;
    };
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error('This browser does not provide location access.');
    navigator.geolocation.getCurrentPosition(
      ({ coords: point }) => {
        const map = mapInstance.current;
        if (!map) return;
        const latitude = Number(point.latitude.toFixed(6));
        const longitude = Number(point.longitude.toFixed(6));
        map.flyTo([latitude, longitude], 16, { duration: 0.7 });
        if (marker.current) marker.current.setLatLng([latitude, longitude]);
        else marker.current = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(map);
        marker.current.off('dragend');
        marker.current.on('dragend', () => {
          const point = marker.current.getLatLng();
          onChangeRef.current({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
        });
        onChangeRef.current({ latitude, longitude });
      },
      error => toast.error(error.code === 1 ? 'Allow location access in your browser, or tap the map to place a pin.' : 'Could not read your location. Tap the map to place a pin.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const searchFarmArea = async () => {
    const query = searchText.trim();
    if (!query) return toast.error('Enter the farm village or town, district, and state first.');
    if (Date.now() - lastSearchTime.current < 1000) return toast.error('Wait a moment before searching again.');
    lastSearchTime.current = Date.now();
    setSearching(true);
    try {
      const url = new URL(GEOCODING_URL);
      url.search = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'in', q: query }).toString();
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Location search is temporarily unavailable.');
      const results = await response.json();
      if (!Array.isArray(results) || !results[0]) return toast.error('Could not find that place. Try adding the district or state.');
      const latitude = Number(Number(results[0].lat).toFixed(6));
      const longitude = Number(Number(results[0].lon).toFixed(6));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('The map service returned invalid coordinates.');
      const map = mapInstance.current;
      if (!map) return;
      map.flyTo([latitude, longitude], 15, { duration: 0.7 });
      if (marker.current) marker.current.setLatLng([latitude, longitude]);
      else marker.current = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(map);
      marker.current.off('dragend');
      marker.current.on('dragend', () => {
        const point = marker.current.getLatLng();
        onChangeRef.current({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
      });
      onChangeRef.current({ latitude, longitude });
      toast.success('Area found. Drag or tap the map to adjust the pin to your plot.');
    } catch (error) {
      toast.error(error.message || 'Location search is unavailable. Place the pin on the map instead.');
    } finally { setSearching(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[var(--color-text)] inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-green-700" />Farm map pin <span className="text-xs font-normal text-[var(--color-text-muted)]">(optional)</span></div>
        <button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-1.5 rounded-lg border border-green-700/30 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950/30">
          <LocateFixed className="h-3.5 w-3.5" />Use my location
        </button>
      </div>
      <button type="button" onClick={searchFarmArea} disabled={searching || !searchText.trim()} className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text)] disabled:opacity-60">
        {searching ? 'Finding farm area…' : `Find ${searchText.trim() || 'village / town'} on map`}
      </button>
      <p className="text-[0.68rem] text-[var(--color-text-muted)]">Searching sends the village, district, and state text above to OpenStreetMap. You can place a pin directly without searching.</p>
      <p className="text-xs text-[var(--color-text-muted)]">Tap the map to place a pin, or drag it to your field. Location permission is requested only when you press “Use my location.”</p>
      <div ref={mapElement} className="h-64 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-slate-100" aria-label="Interactive map for selecting farm location" />
      {coordinates && <p className="text-xs font-medium text-[var(--color-text-muted)]">Pinned at {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</p>}
    </div>
  );
}
