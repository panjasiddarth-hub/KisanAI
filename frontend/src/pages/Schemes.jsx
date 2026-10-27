// Government scheme directory. Eligibility and application windows are checked on official portals.

import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { BookOpen, ExternalLink, Search, ChevronDown, ChevronUp } from 'lucide-react';

const SCHEMES = [
  {
    id: 'pm-kisan',
    name: 'PM-KISAN',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    category: 'Income support',
    summary: 'Central income-support scheme for eligible landholding farmer families.',
    link: 'https://pmkisan.gov.in/',
  },
  {
    id: 'pmfby',
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    category: 'Crop insurance',
    summary: 'Crop insurance scheme. Notified crops, areas, enrollment windows, and terms can vary by season and state.',
    link: 'https://pmfby.gov.in/',
  },
  {
    id: 'kcc',
    name: 'Kisan Credit Card (KCC)',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    category: 'Credit',
    summary: 'Farm and allied-activity credit through participating banks; the bank assesses the application and credit limit.',
    link: 'https://fasalrin.gov.in/',
  },
  {
    id: 'soil-health-card',
    name: 'Soil Health Card Scheme',
    ministry: 'Department of Agriculture & Farmers Welfare',
    category: 'Soil advisory',
    summary: 'Soil testing and nutrient-management information through the Soil Health Card programme.',
    link: 'https://soilhealth.dac.gov.in/',
  },
  {
    id: 'pm-kusum',
    name: 'PM-KUSUM',
    ministry: 'Ministry of New and Renewable Energy',
    category: 'Solar irrigation',
    summary: 'Solar-energy components for agriculture, implemented through designated state agencies and subject to current guidelines.',
    link: 'https://pmkusum.mnre.gov.in/',
  },
];

const CATEGORY_COLORS = {
  'Income support': 'badge-green',
  'Crop insurance': 'badge-blue',
  Credit: 'badge-purple',
  'Soil advisory': 'badge-yellow',
  'Solar irrigation': 'badge-red',
};

function SchemeCard({ scheme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="card fade-in border-l-4 border-l-sky-500 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-sm font-bold text-[var(--color-text)]">{scheme.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{scheme.ministry}</p>
        </div>
        <span className={`badge shrink-0 ${CATEGORY_COLORS[scheme.category] || 'badge-blue'}`}>{scheme.category}</span>
      </div>

      <p className="rounded-xl bg-[var(--color-bg)] p-3 text-sm leading-relaxed text-[var(--color-text)]">{scheme.summary}</p>

      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        className="mb-3 mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? 'Hide what to check' : 'What should I check?'}
      </button>

      {expanded && <div className="mb-3 rounded-xl border border-[var(--color-border)] p-3 fade-in">
        <p className="text-xs font-bold text-[var(--color-text)]">Confirm directly with the official portal or local implementing office:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--color-text-muted)]">
          <li>Whether the scheme is open in your state or district and the current deadline.</li>
          <li>Eligibility rules, notified crops or components, and required documents.</li>
          <li>Current benefit, loan, premium, subsidy, or fee terms that apply to your case.</li>
        </ul>
      </div>}

      <a href={scheme.link} target="_blank" rel="noopener noreferrer" className="btn-primary flex w-full items-center justify-center gap-2 text-sm">
        Check official scheme information <ExternalLink className="h-4 w-4" />
      </a>
    </article>
  );
}

export default function Schemes() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const categories = [...new Set(SCHEMES.map(scheme => scheme.category))];
  const filtered = SCHEMES.filter(scheme => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${scheme.name} ${scheme.category} ${scheme.summary}`.toLowerCase().includes(query);
    return matchesSearch && (category === 'all' || scheme.category === category);
  });

  return (
    <div className="page-content">
      <PageHeader title="Government Scheme Directory" subtitle="General scheme summaries with links to official information. KisanAI does not determine eligibility." />

      <div role="note" className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <p className="text-sm font-bold text-amber-950 dark:text-amber-200">Verify current details before applying</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-300">This directory is not a live eligibility check. KisanAI does not confirm that you qualify, calculate a benefit, or track application dates. Rules, amounts, documents, and open windows can change; use the official portal or your local implementing office.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input type="search" aria-label="Search government schemes" placeholder="Search schemes..." value={search} onChange={event => setSearch(event.target.value)} className="input pl-9" />
        </div>
        <label className="sr-only" htmlFor="scheme-category">Filter by category</label>
        <select id="scheme-category" value={category} onChange={event => setCategory(event.target.value)} className="input w-auto min-w-44">
          <option value="all">All categories</option>
          {categories.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {filtered.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} />)}
      </div> : <div className="card col-span-2 py-12 text-center text-[var(--color-text-muted)]">
        <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
        <p className="font-semibold">No schemes found</p>
        <p className="mt-1 text-sm">Try another search or category.</p>
      </div>}
    </div>
  );
}
