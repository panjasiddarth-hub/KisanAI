import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CloudSun, Droplets, Leaf, ShieldCheck, Sprout, TrendingUp } from 'lucide-react';

const FEATURES = [
  { icon: Sprout, title: 'Crop Intelligence', text: 'Plan sowing, monitor growth, and get AI recommendations for every field.' },
  { icon: CloudSun, title: 'Weather Forecast', text: 'Receive weather-driven irrigation and spray guidance tailored to your region.' },
  { icon: ShieldCheck, title: 'Disease Detection', text: 'Upload crop images and get instant disease diagnosis with treatment steps.' },
  { icon: TrendingUp, title: 'Market Insights', text: 'Track live crop prices, APMC trends, and the best selling windows.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_35%),linear-gradient(135deg,_#f0fdf4_0%,_#ffffff_45%,_#ecfdf5_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_30%),linear-gradient(135deg,_#0f172a_0%,_#111827_45%,_#0f172a_100%)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200 dark:shadow-green-900">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--color-text)]">Sampoorn Kisan</p>
            <p className="text-sm text-[var(--color-text-muted)]">AI Sahayak</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-secondary hidden sm:inline-flex">Sign In</Link>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
              <Bot className="h-4 w-4" />
              Multi-agent farming intelligence for modern Indian agriculture
            </div>
            <h1 className="text-4xl font-black leading-tight text-[var(--color-text)] sm:text-5xl lg:text-6xl">
              Smart farming decisions, made simpler.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--color-text-muted)]">
              Track farms, monitor crops, receive weather advisories, detect diseases, and explore government schemes from one intelligent dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary inline-flex items-center gap-2">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className="btn-secondary">Explore Demo</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {['24/7 AI insights', 'Weather-aware planning', 'Govt. subsidy guidance'].map((item) => (
                <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-6 shadow-2xl">
            <div className="mb-5 rounded-2xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-100">Today’s summary</p>
                  <p className="text-2xl font-bold">3 farms • 5 crops • ₹85K profit</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-3">
                  <Droplets className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Disease alerts', value: '2 pending' },
                { label: 'Weather advisory', value: 'Rain expected' },
                { label: 'Market watch', value: 'Onion +12.5%' },
                { label: 'Active schemes', value: '4 eligible' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[var(--color-border)] bg-gray-50/70 p-3 dark:bg-slate-700/30">
                  <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
                  <p className="mt-1 font-semibold text-[var(--color-text)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
