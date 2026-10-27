import { useEffect, useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { api } from '../api/client';
import { Loader2, MapPin, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const formatRupees = (value) => Number.isFinite(value)
  ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  : 'Unavailable';

export default function Market() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('Onion');
  const [marketData, setMarketData] = useState(null);

  useEffect(() => {
    let mounted = true;
    api.get('/market')
      .then(({ data }) => { if (mounted) setMarketData(data); })
      .catch(() => { if (mounted) toast.error('Could not load market model forecasts'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const reportedForecasts = marketData?.prices || [];
  const forecasts = reportedForecasts.filter((item) =>
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0,
  );
  const rejectedCount = reportedForecasts.length - forecasts.length;
  const selectedForecast = forecasts.find((item) => item.crop === selected) || forecasts[0] || null;

  return (
    <div className="page-content">
      <PageHeader title="Market Model Forecasts" subtitle="Model estimates from sample historical inputs; these are not live mandi quotes" />

      <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 mb-5">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Use these as model outputs for demonstration only.</p>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">{marketData?.inputNotice || 'The forecast service supplies sample historical prices. Confirm current rates with your local mandi before making a selling decision.'}</p>
      </div>

      {loading ? (
        <div className="card p-10 flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="w-4 h-4 animate-spin" />Loading model forecasts…</div>
      ) : forecasts.length === 0 ? (
        <div className="card p-8 text-center">
          <h2 className="font-bold text-[var(--color-text)]">Market model unavailable</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">The model did not return a valid positive price for the sample inputs, so KisanAI is withholding the estimates. Check current prices with your local mandi; do not use this model for a selling decision.</p>
          {reportedForecasts.length > 0 && <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">Rejected {reportedForecasts.length} invalid sample result{reportedForecasts.length === 1 ? '' : 's'}.</p>}
        </div>
      ) : (
        <>
          {rejectedCount > 0 && <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">{rejectedCount} invalid model result{rejectedCount === 1 ? ' was' : 's were'} withheld. Remaining prices are sample-based demonstration outputs, not live mandi quotes.</div>}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <div className="lg:col-span-2 card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-bold text-base text-[var(--color-text)]">Forecast estimate</h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">One-step model output for the supplied sample features</p>
                </div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Crop
                  <select value={selectedForecast?.crop || selected} onChange={(event) => setSelected(event.target.value)} className="input py-1.5 text-xs ml-2">
                    {forecasts.map((item) => <option key={item.crop} value={item.crop}>{item.crop}</option>)}
                  </select>
                </label>
              </div>
              {selectedForecast && (
                <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-green-800 dark:text-green-300"><TrendingUp className="w-4 h-4" />{selectedForecast.crop} · <MapPin className="w-3.5 h-3.5" />{selectedForecast.market}</div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-green-800 dark:text-green-200 mt-3">{formatRupees(selectedForecast.price)}</p>
                  <p className="text-xs text-green-800 dark:text-green-300 mt-1">{selectedForecast.unit || '₹/quintal'}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-4">Model: {selectedForecast.modelSource || 'market ML service'} · Input: sample historical prices</p>
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="font-bold text-sm text-[var(--color-text)]">How to use this estimate</h3>
              <ol className="list-decimal pl-5 mt-3 space-y-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                <li>It is a model output, not a current market quote.</li>
                <li>Its historical inputs are examples, not your selected mandi’s verified recent prices.</li>
                <li>Check today’s rate, quality deductions, transport costs, and local buyer offers before selling.</li>
              </ol>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">Available model forecasts</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Forecasts are run through the shared ML agent dispatcher.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]"><th className="pb-2 font-semibold">Crop</th><th className="pb-2 font-semibold">Model estimate</th><th className="pb-2 font-semibold">Market feature</th><th className="pb-2 font-semibold">Input source</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {forecasts.map((item) => (
                    <tr key={`${item.crop}-${item.market}`} onClick={() => setSelected(item.crop)} className={`cursor-pointer ${selectedForecast?.crop === item.crop ? 'bg-green-50/70 dark:bg-green-950/10' : ''}`}>
                      <td className="py-3 font-semibold text-[var(--color-text)]">{item.crop}</td>
                      <td className="py-3 font-bold text-[var(--color-text)]">{formatRupees(item.price)} <span className="font-normal text-[var(--color-text-muted)]">/{item.unit?.split('/')[1] || 'quintal'}</span></td>
                      <td className="py-3 text-[var(--color-text-muted)]">{item.market}</td>
                      <td className="py-3 text-amber-700 dark:text-amber-400">Sample historical inputs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
