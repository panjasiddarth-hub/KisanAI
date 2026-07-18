// src/pages/Market.jsx
// Market intelligence with crop prices, trends, and nearby markets

import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { TrendingUp, TrendingDown, MapPin, ArrowUpRight } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const CROP_PRICES = [
  { crop: 'Wheat', price: 2350, msp: 2275, unit: '₹/quintal', change: +3.2, market: 'Nashik APMC', quality: 'A Grade' },
  { crop: 'Onion', price: 1850, msp: 1200, unit: '₹/quintal', change: +12.5, market: 'Lasalgaon APMC', quality: 'Medium' },
  { crop: 'Tomato', price: 2100, msp: null, unit: '₹/quintal', change: -8.3, market: 'Pune APMC', quality: 'Fresh' },
  { crop: 'Sugarcane', price: 3200, msp: 3150, unit: '₹/tonne', change: +1.6, market: 'Ahmednagar', quality: 'Standard' },
  { crop: 'Soybean', price: 4800, msp: 4600, unit: '₹/quintal', change: +5.4, market: 'Akola APMC', quality: 'A Grade' },
  { crop: 'Cotton', price: 7200, msp: 6950, unit: '₹/quintal', change: -2.1, market: 'Nagpur APMC', quality: 'Medium Staple' },
];

const NEARBY_MARKETS = [
  { name: 'Nashik APMC', distance: '12 km', rating: 4.5, speciality: 'Grapes, Onion, Tomato', timing: '6 AM – 2 PM', days: 'Mon–Sat' },
  { name: 'Lasalgaon APMC', distance: '28 km', rating: 4.8, speciality: "Asia's largest onion market", timing: '5 AM – 12 PM', days: 'All days' },
  { name: 'Pune APMC (Gultekdi)', distance: '75 km', rating: 4.3, speciality: 'Vegetables, Fruits, Grains', timing: '4 AM – 10 AM', days: 'All days' },
  { name: 'Ahmednagar APMC', distance: '95 km', rating: 4.1, speciality: 'Sugarcane, Soybean', timing: '7 AM – 3 PM', days: 'Mon–Fri' },
];

const generatePriceHistory = (base) => ({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  datasets: [{
    label: 'Price (₹/q)',
    data: Array.from({ length: 7 }, (_, i) => Math.round(base * (0.85 + Math.random() * 0.3 + i * 0.02))),
    borderColor: '#16a34a',
    backgroundColor: 'rgba(22,163,74,0.08)',
    fill: true,
    tension: 0.4,
    borderWidth: 2,
    pointRadius: 3,
    pointBackgroundColor: '#16a34a',
  }],
});

export default function Market() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('Onion');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const selectedCrop = CROP_PRICES.find(c => c.crop === selected);
  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(100,116,139,0.08)' }, ticks: { color: '#64748b', font: { size: 11 }, callback: v => `₹${v}` } }
    }
  };

  return (
    <div className="page-content">
      <PageHeader title="Market Intelligence" subtitle="Live crop prices, market trends, and nearby APMC data" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Onion Price" value="₹1,850" unit="/q" icon={TrendingUp} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-500" trend="up" trendValue={12.5} subtitle="Above MSP" />
        <StatCard loading={loading} title="Wheat Price" value="₹2,350" unit="/q" icon={TrendingUp} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-500" trend="up" trendValue={3.2} subtitle="₹75 above MSP" />
        <StatCard loading={loading} title="Tomato Price" value="₹2,100" unit="/q" icon={TrendingDown} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500" trend="down" trendValue={8.3} subtitle="Falling trend" />
        <StatCard loading={loading} title="Best Market" value="Lasalgaon" icon={MapPin} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Onion · 28 km away" />
      </div>

      {/* Price chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-text)]">Price Trend (2026)</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Historical prices at nearby APMC</p>
            </div>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="input py-1.5 text-xs w-32"
            >
              {CROP_PRICES.map(c => <option key={c.crop}>{c.crop}</option>)}
            </select>
          </div>
          {loading ? <div className="skeleton h-52 rounded-xl" /> : <div className="h-52"><Line data={generatePriceHistory(selectedCrop?.price || 2000)} options={chartOpts} /></div>}
        </div>

        {/* Selected crop detail */}
        <div className="card p-5">
          {selectedCrop && (
            <>
              <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">{selectedCrop.crop} Details</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20">
                  <p className="text-[0.65rem] text-green-600 dark:text-green-400 font-semibold">Current Price</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">₹{selectedCrop.price.toLocaleString()}</p>
                  <p className="text-xs text-green-600">{selectedCrop.unit}</p>
                </div>
                {selectedCrop.msp && (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-[0.65rem] text-blue-600 dark:text-blue-400 font-semibold">MSP (Govt. Price)</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">₹{selectedCrop.msp.toLocaleString()}</p>
                    <p className="text-xs text-blue-500">
                      {selectedCrop.price > selectedCrop.msp ? `+₹${(selectedCrop.price - selectedCrop.msp).toLocaleString()} above MSP ✅` : 'Below MSP ⚠️'}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Market</p>
                    <p className="text-xs font-semibold text-[var(--color-text)]">{selectedCrop.market}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">Quality</p>
                    <p className="text-xs font-semibold text-[var(--color-text)]">{selectedCrop.quality}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 p-3 rounded-xl ${selectedCrop.change > 0 ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`}>
                  {selectedCrop.change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-xs font-semibold">{selectedCrop.change > 0 ? '+' : ''}{selectedCrop.change}% vs last week</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* All prices table */}
      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Live Crop Prices — Today</h3>
        {loading ? <div className="skeleton h-40 rounded-xl" /> :
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="pb-2 font-semibold">Crop</th>
                  <th className="pb-2 font-semibold">Price</th>
                  <th className="pb-2 font-semibold">MSP</th>
                  <th className="pb-2 font-semibold">Change</th>
                  <th className="pb-2 font-semibold">Market</th>
                  <th className="pb-2 font-semibold">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {CROP_PRICES.map(c => (
                  <tr key={c.crop} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors" onClick={() => setSelected(c.crop)}>
                    <td className="py-2.5 font-semibold text-[var(--color-text)]">{c.crop}</td>
                    <td className="py-2.5 font-bold text-green-600">₹{c.price.toLocaleString()} <span className="text-[0.6rem] text-[var(--color-text-muted)] font-normal">/q</span></td>
                    <td className="py-2.5 text-[var(--color-text-muted)]">{c.msp ? `₹${c.msp.toLocaleString()}` : '—'}</td>
                    <td className="py-2.5">
                      <span className={`flex items-center gap-1 font-semibold ${c.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {c.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {c.change > 0 ? '+' : ''}{c.change}%
                      </span>
                    </td>
                    <td className="py-2.5 text-[var(--color-text)]">{c.market}</td>
                    <td className="py-2.5"><span className="badge badge-blue">{c.quality}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>

      {/* Nearby Markets */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Nearby APMC Markets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NEARBY_MARKETS.map(m => (
            <div key={m.name} className="p-4 rounded-xl border border-[var(--color-border)] hover:border-green-300 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text)]">{m.name}</h4>
                  <div className="flex items-center gap-1 text-[var(--color-text-muted)] mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs">{m.distance}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-500">
                  <span className="text-sm">⭐</span>
                  <span className="text-xs font-bold">{m.rating}</span>
                </div>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">🌾 {m.speciality}</p>
              <div className="flex gap-2 text-xs text-[var(--color-text-muted)]">
                <span>🕐 {m.timing}</span>
                <span>· {m.days}</span>
              </div>
              <button className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-2 hover:underline">
                View Details <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
