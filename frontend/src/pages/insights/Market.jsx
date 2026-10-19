
import { useState, useEffect } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import {
  Line,
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { api } from '../../api/client';
import toast from 'react-hot-toast';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Only show historical data when it is actually available.
// Do not generate random prices and present them as real history.
function getChartData(crop) {
  const history = crop?.priceHistory;

  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const validHistory = history.filter(
    (item) =>
      item &&
      typeof item.price === 'number' &&
      Number.isFinite(item.price)
  );

  if (validHistory.length === 0) {
    return null;
  }

  return {
    labels: validHistory.map(
      (item) => item.date || item.label || ''
    ),
    datasets: [
      {
        label: 'Price (₹/quintal)',
        data: validHistory.map((item) => item.price),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.08)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#16a34a',
      },
    ],
  };
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') {
    return 'Unavailable';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 'Unavailable';
  }

  return `₹${number.toLocaleString('en-IN')}`;
}

function formatChange(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function Market() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('Onion');
  const [marketData, setMarketData] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchMarket = async () => {
      try {
        const { data } = await api.get('/market');

        if (!mounted) return;

        setMarketData(data || { prices: [], nearbyMarkets: [] });
        setFetchError(false);
      } catch (error) {
        if (!mounted) return;

        console.error('Failed to fetch market data:', error);
        setFetchError(true);
        toast.error('Failed to fetch market prices');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchMarket();

    return () => {
      mounted = false;
    };
  }, []);

  const CROP_PRICES = Array.isArray(marketData?.prices)
    ? marketData.prices
    : [];

  const NEARBY_MARKETS = Array.isArray(marketData?.nearbyMarkets)
    ? marketData.nearbyMarkets
    : [];

  const selectedCrop =
    CROP_PRICES.find((crop) => crop.crop === selected) ||
    CROP_PRICES[0] ||
    null;

  const onion = CROP_PRICES.find((crop) => crop.crop === 'Onion');
  const wheat = CROP_PRICES.find((crop) => crop.crop === 'Wheat');
  const tomato = CROP_PRICES.find((crop) => crop.crop === 'Tomato');

  const chartData = getChartData(selectedCrop);

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(100,116,139,0.08)',
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
          },
          callback: (value) => `₹${value}`,
        },
      },
    },
  };

  return (
    <div className="page-content">
      <PageHeader
        title="Market Intelligence"
        subtitle="Crop prices, market trends, and nearby APMC data"
      />

      {fetchError && (
        <div
          role="alert"
          className="card p-4 mb-5 text-sm text-red-600"
        >
          Market data could not be loaded. Check that the backend is
          running, then refresh this page.
        </div>
      )}

      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard
          loading={loading}
          title="Onion Price"
          value={
            onion?.price != null ? formatPrice(onion.price) : '—'
          }
          unit={onion?.price != null ? '/q' : ''}
          icon={TrendingUp}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-500"
          trend={
            formatChange(onion?.change) == null
              ? undefined
              : onion.change > 0
                ? 'up'
                : 'down'
          }
          trendValue={Math.abs(formatChange(onion?.change) ?? 0)}
          subtitle="Market-reported price"
        />

        <StatCard
          loading={loading}
          title="Wheat Price"
          value={
            wheat?.price != null ? formatPrice(wheat.price) : '—'
          }
          unit={wheat?.price != null ? '/q' : ''}
          icon={TrendingUp}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-500"
          trend={
            formatChange(wheat?.change) == null
              ? undefined
              : wheat.change > 0
                ? 'up'
                : 'down'
          }
          trendValue={Math.abs(formatChange(wheat?.change) ?? 0)}
          subtitle="Market-reported price"
        />

        <StatCard
          loading={loading}
          title="Tomato Price"
          value={
            tomato?.price != null ? formatPrice(tomato.price) : '—'
          }
          unit={tomato?.price != null ? '/q' : ''}
          icon={TrendingDown}
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-500"
          trend={
            formatChange(tomato?.change) == null
              ? undefined
              : tomato.change > 0
                ? 'up'
                : 'down'
          }
          trendValue={Math.abs(formatChange(tomato?.change) ?? 0)}
          subtitle="Market-reported price"
        />

        <StatCard
          loading={loading}
          title="Markets Available"
          value={NEARBY_MARKETS.length}
          icon={MapPin}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-500"
          subtitle="Returned by market API"
        />
      </div>

      {/* Price chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Price Trend
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Historical data, when available
              </p>
            </div>

            <select
              value={selectedCrop?.crop || selected}
              onChange={(event) => setSelected(event.target.value)}
              className="input py-1.5 text-xs w-32"
              disabled={CROP_PRICES.length === 0}
            >
              {CROP_PRICES.map((crop) => (
                <option key={crop.crop} value={crop.crop}>
                  {crop.crop}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="skeleton h-52 rounded-xl" />
          ) : chartData ? (
            <div className="h-52">
              <Line data={chartData} options={chartOpts} />
            </div>
          ) : (
            <div className="h-52 flex flex-col items-center justify-center text-center">
              <TrendingUp className="w-8 h-8 text-[var(--color-text-muted)] mb-2" />
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Historical prices unavailable
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                A historical price series has not been supplied by the API.
              </p>
            </div>
          )}
        </div>

        {/* Selected crop detail */}
        <div className="card p-5">
          {selectedCrop ? (
            <>
              <h3 className="font-bold text-sm text-[var(--color-text)] mb-3">
                {selectedCrop.crop} Details
              </h3>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20">
                  <p className="text-[0.65rem] text-green-600 dark:text-green-400 font-semibold">
                    Current Price
                  </p>

                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatPrice(selectedCrop.price)}
                  </p>

                  <p className="text-xs text-green-600">
                    {selectedCrop.unit || '₹/quintal'}
                  </p>
                </div>

                {selectedCrop.msp != null && (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                    <p className="text-[0.65rem] text-blue-600 dark:text-blue-400 font-semibold">
                      MSP (Government Price)
                    </p>

                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {formatPrice(selectedCrop.msp)}
                    </p>

                    {selectedCrop.price != null && (
                      <p className="text-xs text-blue-500">
                        {Number(selectedCrop.price) >
                        Number(selectedCrop.msp)
                          ? `${formatPrice(
                              Number(selectedCrop.price) -
                                Number(selectedCrop.msp)
                            )} above MSP`
                          : 'At or below MSP'}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">
                      Market
                    </p>
                    <p className="text-xs font-semibold text-[var(--color-text)]">
                      {selectedCrop.market || 'Not specified'}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/30">
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">
                      Quality
                    </p>
                    <p className="text-xs font-semibold text-[var(--color-text)]">
                      {selectedCrop.quality || 'Not specified'}
                    </p>
                  </div>
                </div>

                {formatChange(selectedCrop.change) != null && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl ${
                      selectedCrop.change > 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                        : selectedCrop.change < 0
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                          : 'bg-gray-50 text-gray-700 dark:bg-slate-700/30 dark:text-gray-300'
                    }`}
                  >
                    {selectedCrop.change > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}

                    <span className="text-xs font-semibold">
                      {selectedCrop.change > 0 ? '+' : ''}
                      {selectedCrop.change}% vs previous period
                    </span>
                  </div>
                )}

                {selectedCrop.modelSource && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Data source: {selectedCrop.modelSource}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold">
                No crop data available
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Check the market API and try again.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* All crop prices */}
      <div className="card p-5 mb-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">
          Crop Prices
        </h3>

        {loading ? (
          <div className="skeleton h-40 rounded-xl" />
        ) : CROP_PRICES.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            No crop prices are available at the moment.
          </p>
        ) : (
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
                {CROP_PRICES.map((crop) => {
                  const change = formatChange(crop.change);

                  return (
                    <tr
                      key={crop.crop}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => setSelected(crop.crop)}
                    >
                      <td className="py-2.5 font-semibold text-[var(--color-text)]">
                        {crop.crop || 'Unknown'}
                      </td>

                      <td className="py-2.5 font-bold text-green-600">
                        {formatPrice(crop.price)}
                        {crop.price != null && (
                          <span className="text-[0.6rem] text-[var(--color-text-muted)] font-normal">
                            {' '}/q
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 text-[var(--color-text-muted)]">
                        {crop.msp != null
                          ? formatPrice(crop.msp)
                          : '—'}
                      </td>

                      <td className="py-2.5">
                        {change == null ? (
                          <span className="text-[var(--color-text-muted)]">
                            —
                          </span>
                        ) : (
                          <span
                            className={`flex items-center gap-1 font-semibold ${
                              change > 0
                                ? 'text-green-600'
                                : change < 0
                                  ? 'text-red-500'
                                  : 'text-[var(--color-text-muted)]'
                            }`}
                          >
                            {change > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : change < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}

                            {change > 0 ? '+' : ''}
                            {change}%
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 text-[var(--color-text)]">
                        {crop.market || 'Not specified'}
                      </td>

                      <td className="py-2.5">
                        <span className="badge badge-blue">
                          {crop.quality || 'Not specified'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nearby markets */}
      <div className="card p-5">
        <h3 className="font-bold text-sm text-[var(--color-text)] mb-4">
          Nearby APMC Markets
        </h3>

        {loading ? (
          <div className="skeleton h-32 rounded-xl" />
        ) : NEARBY_MARKETS.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            No nearby market information is available.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {NEARBY_MARKETS.map((market) => (
              <div
                key={market.name}
                className="p-4 rounded-xl border border-[var(--color-border)] hover:border-green-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--color-text)]">
                      {market.name}
                    </h4>

                    <div className="flex items-center gap-1 text-[var(--color-text-muted)] mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs">
                        {market.distance || 'Distance unavailable'}
                      </span>
                    </div>
                  </div>

                  {market.rating != null && (
                    <div className="flex items-center gap-1 text-amber-500">
                      <span className="text-sm">⭐</span>
                      <span className="text-xs font-bold">
                        {market.rating}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                  🌾 {market.speciality || 'Commodities not specified'}
                </p>

                {(market.timing || market.days) && (
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                    {market.timing && <span>🕐 {market.timing}</span>}
                    {market.days && <span>· {market.days}</span>}
                  </div>
                )}

                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-green-600 font-semibold mt-2 hover:underline"
                  onClick={() => {
                    toast(
                      'Detailed market information is not available yet.'
                    );
                  }}
                >
                  View Details <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
