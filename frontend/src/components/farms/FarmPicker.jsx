// src/components/farms/FarmPicker.jsx — choose which saved farm a page works on.
import { MapPin } from 'lucide-react';

export default function FarmPicker({ farms, value, onChange, testid = 'farm-picker' }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <MapPin className="w-4 h-4 text-green-600 shrink-0" />
      <span className="font-semibold text-[var(--color-text-muted)]">Farm</span>
      <select className="input text-sm !py-2 w-60" value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testid}>
        {farms.map((f) => (
          <option key={f.id} value={f.id}>{f.name}{f.location ? ` · ${f.location}` : ''}</option>
        ))}
      </select>
    </label>
  );
}
