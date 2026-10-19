// src/components/ui/SourceBadge.jsx — says where a piece of information came from, so live data,
// model output, calculations and sample data are never presented the same way.
const KINDS = {
  external_api: { label: 'Live data', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  trained_model: { label: 'Model', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  calculation: { label: 'Calculated', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  rule_engine: { label: 'Rules', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  sample_data: { label: 'Sample data', cls: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-200' },
  fallback: { label: 'Fallback', cls: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
};

export default function SourceBadge({ kind, name, detail }) {
  const k = KINDS[kind] || KINDS.calculation;
  return (
    <span className={`inline-flex items-center gap-1 text-[0.62rem] font-semibold px-1.5 py-0.5 rounded ${k.cls}`} title={detail || name || k.label} data-testid="source-badge" data-kind={kind}>
      {k.label}{name ? <span className="font-normal">· {name}</span> : null}
    </span>
  );
}
