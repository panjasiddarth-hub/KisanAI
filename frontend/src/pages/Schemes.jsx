// src/pages/Schemes.jsx
// Government schemes eligibility and information

import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { BookOpen, CheckCircle, ExternalLink, Search, ChevronDown, ChevronUp } from 'lucide-react';

const SCHEMES = [
  {
    id: 1,
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefit: '₹6,000/year in 3 installments of ₹2,000',
    eligible: true,
    status: 'Active',
    nextInstallment: 'October 2026',
    category: 'Income Support',
    description: 'Direct income support to small and marginal farmers with landholding up to 2 hectares.',
    eligibility: ['Land holding ≤ 2 hectares', 'Indian citizen farmer', 'Valid Aadhaar card', 'Bank account linked to Aadhaar'],
    documents: ['Aadhaar Card', 'Land Records (7/12)', 'Bank Passbook', 'Mobile Number'],
    link: 'https://pmkisan.gov.in',
  },
  {
    id: 2,
    name: 'PM Fasal Bima Yojana (Crop Insurance)',
    ministry: 'Ministry of Agriculture',
    benefit: 'Up to ₹50,000 per hectare crop insurance',
    eligible: true,
    status: 'Apply Now',
    nextInstallment: 'Kharif Season',
    category: 'Insurance',
    description: 'Provides comprehensive crop insurance coverage and financial support to farmers in case of crop failure.',
    eligibility: ['All farmers growing notified crops', 'Both loanee and non-loanee farmers', 'Enrolled before cut-off date'],
    documents: ['Aadhaar Card', 'Land Records', 'Bank Account', 'Crop Sowing Certificate'],
    link: 'https://pmfby.gov.in',
  },
  {
    id: 3,
    name: 'Kisan Credit Card (KCC)',
    ministry: 'Ministry of Finance',
    benefit: 'Crop loan up to ₹3 lakh at 4% interest (with subsidy)',
    eligible: true,
    status: 'Active',
    nextInstallment: null,
    category: 'Credit',
    description: 'Provides adequate credit support to farmers for cultivation expenses, post-harvest expenses, and allied activities.',
    eligibility: ['Farmers, tenant farmers', 'SHGs or Joint Liability Groups', 'Minimum 1 year farming experience'],
    documents: ['Aadhaar Card', 'PAN Card', 'Land Records', 'Passport Photos'],
    link: 'https://agri.maharashtra.gov.in',
  },
  {
    id: 4,
    name: 'Soil Health Card Scheme',
    ministry: 'Department of Agriculture',
    benefit: 'Free soil testing + fertilizer recommendations',
    eligible: true,
    status: 'Pending',
    nextInstallment: null,
    category: 'Advisory',
    description: 'Provides soil health cards to farmers with crop-wise recommendations for nutrients and fertilizers.',
    eligibility: ['All farmers with agricultural land', 'Apply at local Agriculture office'],
    documents: ['Aadhaar Card', 'Land Records'],
    link: 'https://soilhealth.dac.gov.in',
  },
  {
    id: 5,
    name: 'PM Kusum Yojana (Solar Pump)',
    ministry: 'Ministry of New & Renewable Energy',
    benefit: '90% subsidy on solar irrigation pumps',
    eligible: false,
    status: 'Not Eligible',
    nextInstallment: null,
    category: 'Infrastructure',
    description: 'Provides solarization of agriculture pumps and grid-connected solar power plants.',
    eligibility: ['Individual farmer', 'Pump capacity ≤ 7.5 HP', 'No solar plant on land already'],
    documents: ['Aadhaar Card', 'Land Records', 'Bank Account', 'Electricity Bill'],
    link: 'https://mnre.gov.in/solar',
  },
];

const CATEGORY_COLORS = {
  'Income Support': 'badge-green',
  'Insurance': 'badge-blue',
  'Credit': 'badge-purple',
  'Advisory': 'badge-yellow',
  'Infrastructure': 'badge-red',
};

function SchemeCard({ scheme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`card p-5 fade-in border-l-4 ${scheme.eligible ? 'border-l-green-500' : 'border-l-gray-300 dark:border-l-slate-600'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">{scheme.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{scheme.ministry}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`badge ${scheme.eligible ? 'badge-green' : 'badge-red'}`}>
            {scheme.eligible ? '✅ Eligible' : '❌ Not Eligible'}
          </span>
          <span className={`badge ${CATEGORY_COLORS[scheme.category] || 'badge-blue'}`}>{scheme.category}</span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 mb-3">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400">💰 Benefit</p>
        <p className="text-sm font-bold text-green-800 dark:text-green-300 mt-0.5">{scheme.benefit}</p>
      </div>

      {scheme.nextInstallment && (
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          📅 Next: <span className="font-semibold text-[var(--color-text)]">{scheme.nextInstallment}</span>
        </p>
      )}

      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 mb-3"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Show Less' : 'View Details & Requirements'}
      </button>

      {expanded && (
        <div className="space-y-3 fade-in">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{scheme.description}</p>

          <div>
            <p className="text-xs font-bold text-[var(--color-text)] mb-2">✓ Eligibility Criteria</p>
            <ul className="space-y-1">
              {scheme.eligibility.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  {e}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold text-[var(--color-text)] mb-2">📄 Required Documents</p>
            <div className="flex flex-wrap gap-1.5">
              {scheme.documents.map(d => <span key={d} className="badge badge-blue">{d}</span>)}
            </div>
          </div>

          <a
            href={scheme.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            Apply Online <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function Schemes() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const filtered = SCHEMES.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'eligible' && s.eligible) || (filter === 'category' && s.category === filter);
    return matchSearch && matchFilter;
  });

  const eligibleCount = SCHEMES.filter(s => s.eligible).length;

  return (
    <div className="page-content">
      <PageHeader title="Government Schemes" subtitle="Eligible schemes and subsidies for your farm" />

      {/* Summary banner */}
      <div className="mb-5 p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-blue-100 text-sm">Based on your farm profile</p>
            <p className="text-2xl font-bold mt-1">You are eligible for {eligibleCount} schemes!</p>
            <p className="text-blue-200 text-sm mt-1">Estimated annual benefit: <strong>₹12,500+</strong></p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ v: eligibleCount, l: 'Eligible' }, { v: '₹6K', l: 'PM-KISAN' }, { v: '4%', l: 'KCC Rate' }].map(s => (
              <div key={s.l} className="text-center p-3 rounded-xl bg-white/15 backdrop-blur-sm">
                <p className="text-xl font-bold">{s.v}</p>
                <p className="text-blue-200 text-xs">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search schemes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[['all', 'All Schemes'], ['eligible', 'Eligible Only']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filter === val ? 'bg-green-500 text-white border-green-500' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-5 space-y-3"><div className="skeleton h-6 w-3/4 rounded" /><div className="skeleton h-4 w-1/2 rounded" /><div className="skeleton h-14 rounded-xl" /></div>)}
        </div>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(s => <SchemeCard key={s.id} scheme={s} />)}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-12 text-[var(--color-text-muted)]">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No schemes found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      }
    </div>
  );
}
