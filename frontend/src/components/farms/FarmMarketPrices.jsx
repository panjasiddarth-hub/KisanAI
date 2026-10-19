// src/components/farms/FarmMarketPrices.jsx — mandi prices for one farm's crops (its selected crop
// and latest recommendation shortlist). Live prices appear only when the backend has real records;
// otherwise the reason is shown. The price model's coverage is shown, but no forecast is invented.
import { useEffect, useState } from 'react';
import { Loader2, Store, Radio, Bot } from 'lucide-react';
import { farmApi } from '../../hooks/useFarms';
import { apiErrorMessage } from '../../api/client';
import { MissingInfo, Limitations } from './FarmNotes';

const LIVE_BANNER = {
  ok: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-300',
  not_configured: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300',
  unavailable: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-300',
  skipped: 'bg-gray-50 border-[var(--color-border)] text-[var(--color-text-muted)] dark:bg-slate-800/40',
};
const rupees = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

export default function FarmMarketPrices({ farm }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    farmApi.market(farm.id)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) { setData(null); setError(apiErrorMessage(e)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [farm.id]);

  if (loading) return <div className="card p-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Looking up prices for {farm.name}…</div>;
  if (error) return <div className="card p-4 text-sm text-red-600" data-testid="mkt-farm-error">{error}</div>;

  return (
    <div className="card p-5 space-y-3" data-testid="mkt-farm" data-status={data.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-[var(--color-text)] flex items-center gap-2"><Store className="w-4 h-4 text-green-600" /> Mandi prices for {farm.name}’s crops{data.state ? ` · ${data.state}` : ''}</h3>
      </div>
      <div className={`rounded-xl border px-3 py-2 text-[0.72rem] flex items-start gap-2 ${LIVE_BANNER[data.live.status] || LIVE_BANNER.skipped}`} data-testid="mkt-live-status" data-live={data.live.status}>
        <Radio className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          {data.live.status === 'ok'
            ? `Live Agmarknet prices (data.gov.in)${data.live.updated ? `, dataset updated ${data.live.updated}` : ''}.`
            : data.live.message}
        </span>
      </div>

      <MissingInfo missing={data.missing} testid="mkt-missing" />

      {data.crops.length > 0 && (
        <div className="space-y-2">
          {data.crops.map((c) => (
            <div key={c.crop} className="rounded-xl border border-[var(--color-border)] p-3" data-testid="mkt-crop">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-bold text-sm text-[var(--color-text)]">{c.crop}</span>
                {c.sources.map((s) => <span key={s} className={`badge ${s === 'selected' ? 'badge-green' : 'badge-blue'}`}>{s === 'selected' ? 'Selected crop' : 'Recommended'}</span>)}
                <span className={`badge ${c.model.supported ? 'badge-purple' : 'badge-yellow'} ml-auto`} data-testid="mkt-model-badge">
                  <Bot className="w-3 h-3 inline -mt-0.5 mr-0.5" />{c.model.supported === null ? 'Model coverage unknown' : c.model.supported ? `Price model covers ${c.model.commodity}` : 'No price model for this crop'}
                </span>
              </div>
              {c.live.status === 'ok' ? (
                <>
                  <p className="text-[0.72rem] text-[var(--color-text)]">
                    Modal price {rupees(c.live.modalMin)}{c.live.modalMax !== c.live.modalMin ? ` – ${rupees(c.live.modalMax)}` : ''} /quintal across {c.live.markets} market record(s){c.live.latestArrivalDate ? `, latest ${c.live.latestArrivalDate}` : ''}.
                  </p>
                  <div className="overflow-x-auto mt-1.5">
                    <table className="w-full text-[0.68rem]">
                      <thead><tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]"><th className="py-1">Market</th><th>District</th><th>Commodity / variety</th><th>Date</th><th>Min</th><th>Max</th><th>Modal</th></tr></thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {c.live.records.map((r) => (
                          <tr key={`${r.market}-${r.variety}-${r.arrivalDate}`} className={r.nearFarm ? 'font-semibold' : ''}>
                            <td className="py-1">{r.market}{r.nearFarm ? ' (near you)' : ''}</td><td>{r.district}</td><td>{r.commodity}{r.variety ? ` / ${r.variety}` : ''}</td><td>{r.arrivalDate || '–'}</td>
                            <td>{r.minPrice === null ? '–' : rupees(r.minPrice)}</td><td>{r.maxPrice === null ? '–' : rupees(r.maxPrice)}</td><td className="text-green-700 dark:text-green-400">{rupees(r.modalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : data.live.status === 'ok' ? (
                <p className="text-[0.72rem] text-[var(--color-text-muted)]" data-testid="mkt-crop-live">Live price: {c.live.message}</p>
              ) : null /* the banner above already explains why there are no live prices */}
              <p className="text-[0.65rem] text-[var(--color-text-muted)] mt-1">{c.model.note}</p>
            </div>
          ))}
        </div>
      )}

      <Limitations limitations={data.limitations} sources={data.sources} testid="mkt-limitations" />
    </div>
  );
}
