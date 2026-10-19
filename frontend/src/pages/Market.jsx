import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import { TrendingUp, TrendingDown, MapPin, ArrowUpRight } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import FarmPicker from '../components/farms/FarmPicker';
import FarmMarketPrices from '../components/farms/FarmMarketPrices';
import { useFarms, useFarmParam } from '../hooks/useFarms';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// The price model's actual inputs (sample prices bundled with the app, oldest first) and its forecast.
const modelSeries = (c) => ({
  labels: ['Sample t−3', 'Sample t−2', 'Sample t−1', 'Model forecast'],
  datasets: [{
    label: 'Price (₹/q)',
    data: [...[...(c.inputs?.lastPrices || [])].reverse(), c.forecast ?? null],
    borderColor: '#16a34a',
    backgroundColor: 'rgba(22,163,74,0.08)',
    fill: true,
    tension: 0, // straight segments: four discrete prices, nothing in between
    borderWidth: 2,
    pointRadius: 3,
    pointBackgroundColor: '#16a34a',
  }],
});

export default function Market() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('Onion');
  const [marketData, setMarketData] = useState(null);
  const { farms } = useFarms();
  const [farmId, setFarmId] = useFarmParam(farms);
  const farm = farms.find((f) => f.id === farmId);

  useEffect(() => {
    let mounted = true;
    const fetchMarket = async () => {
      try {
        const { data } = await api.get('/market');
        if (mounted) {
          setMarketData(data);
          setLoading(false);
        }
      } catch {
        if (mounted) {
          toast.error('Failed to fetch live market prices');
          setLoading(false);
        }
      }
    };
    fetchMarket();
    return () => { mounted = false; };
  }, []);

  const CROP_PRICES = marketData?.prices || [];
  const NEARBY_MARKETS = marketData?.nearbyMarkets || [];
  const selectedCrop = CROP_PRICES.find(c => c.crop === selected) || CROP_PRICES[0];
  const inr = (v) => (v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);
  const pct = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v}%`);
  const priceOf = (name) => CROP_PRICES.find(c => c.crop === name);

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
      <PageHeader title="Market Intelligence" subtitle="Mandi prices for your farm's crops, plus the price model's sample forecasts" />

      {farms.length > 0 && (
        <div className="mb-5 space-y-3">
          <FarmPicker farms={farms} value={farmId} onChange={setFarmId} testid="mkt-farm-picker" />
          {farm && <FarmMarketPrices key={farm.id} farm={farm} />}
        </div>
      )}

      {marketData?.dataSource && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300" data-testid="mkt-sample-banner">
          <b>Sample data below:</b> {marketData.dataSource.note}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard loading={loading} title="Onion · model forecast" value={inr(priceOf('Onion')?.forecast)} unit="/q" icon={TrendingUp} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-500" trend={priceOf('Onion')?.change > 0 ? 'up' : 'down'} trendValue={Math.abs(priceOf('Onion')?.change ?? 0)} subtitle="vs last sample price" />
        <StatCard loading={loading} title="Wheat · model forecast" value={inr(priceOf('Wheat')?.forecast)} unit="/q" icon={TrendingUp} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-500" trend={priceOf('Wheat')?.change > 0 ? 'up' : 'down'} trendValue={Math.abs(priceOf('Wheat')?.change ?? 0)} subtitle="vs last sample price" />
        <StatCard loading={loading} title="Tomato · model forecast" value={inr(priceOf('Tomato')?.forecast)} unit="/q" icon={TrendingDown} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500" trend={priceOf('Tomato')?.change > 0 ? 'up' : 'down'} trendValue={Math.abs(priceOf('Tomato')?.change ?? 0)} subtitle="vs last sample price" />
        <StatCard loading={loading} title="Top-rated in sample APMC list" value={[...NEARBY_MARKETS].sort((a, b) => b.rating - a.rating)[0]?.name || '—'} icon={MapPin} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-500" subtitle="Nashik-region sample, not your location" />
      </div>

      {/* Price chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-text)]">Model inputs &amp; forecast</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Sample prices bundled with KisanAI → XGBoost price model (not live data)</p>
            </div>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="input py-1.5 text-xs w-32"
            >
              {CROP_PRICES.map(c => <option key={c.crop}>{c.crop}</option>)}
            </select>
          </div>
          {loading || !selectedCrop ? <div className="skeleton h-52 rounded-xl" /> : <div className="h-52"><Line data={modelSeries(selectedCrop)} options={chartOpts} /></div>}
        </div>

        {/* Selected crop detail */}
        <div className="card p-5">
          {selectedCrop && (
            <>
              <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">{selectedCrop.crop} Details</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20">
                  <p className="text-[0.65rem] text-green-600 dark:text-green-400 font-semibold">Model forecast</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{selectedCrop.price === null ? 'Unavailable' : inr(selectedCrop.price)}</p>
                  <p className="text-xs text-green-600">{selectedCrop.unit} · last sample price {inr(selectedCrop.lastPrice)}</p>
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
                {selectedCrop.change !== null && selectedCrop.change !== undefined && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl ${selectedCrop.change > 0 ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'}`} data-testid="mkt-detail-change">
                    {selectedCrop.change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-xs font-semibold">{pct(selectedCrop.change)} {selectedCrop.changeBasis || 'vs last sample price'}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* All prices table */}
      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">Price model forecasts <span className="font-normal text-[var(--color-text-muted)]">— from sample inputs, not today’s mandi prices</span></h3>
        {loading || !marketData ? <div className="skeleton h-40 rounded-xl" /> :
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="pb-2 font-semibold">Crop</th>
                  <th className="pb-2 font-semibold">Forecast</th>
                  <th className="pb-2 font-semibold">Last sample</th>
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
                    <td className="py-2.5 font-bold text-green-600">{inr(c.price)} <span className="text-[0.6rem] text-[var(--color-text-muted)] font-normal">/q</span></td>
                    <td className="py-2.5 text-[var(--color-text-muted)]">{inr(c.lastPrice)}</td>
                    <td className="py-2.5 text-[var(--color-text-muted)]">{c.msp ? `₹${c.msp.toLocaleString()}` : '—'}</td>
                    <td className="py-2.5">
                      {c.change === null || c.change === undefined ? <span className="text-[var(--color-text-muted)]">—</span> : (
                        <span className={`flex items-center gap-1 font-semibold ${c.change > 0 ? 'text-green-600' : 'text-red-500'}`} data-testid="mkt-change">
                          {c.change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {pct(c.change)}
                        </span>
                      )}
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
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">APMC markets</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{marketData?.nearbyMarketsBasis || 'Static sample list'}</p>
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