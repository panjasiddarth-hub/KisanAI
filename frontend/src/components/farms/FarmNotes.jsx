// src/components/farms/FarmNotes.jsx — the "missing information", "limitations" and "sources"
// blocks every farm agent result carries, rendered exactly as the backend returned them.
import { Info, AlertTriangle, ExternalLink } from 'lucide-react';

export function MissingInfo({ missing, testid }) {
  if (!missing?.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-900/40 p-3" data-testid={testid}>
      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Missing information</p>
      <ul className="space-y-1">
        {missing.map((m) => (
          <li key={`${m.field}-${m.label}`} className="text-[0.72rem] text-amber-900 dark:text-amber-200">
            <b>{m.label}</b>{m.fix ? ` — ${m.fix}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Limitations({ limitations, sources, testid }) {
  if (!limitations?.length && !sources?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-2" data-testid={testid}>
      {limitations?.length > 0 && (
        <>
          <p className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Limitations</p>
          <ul className="list-disc pl-5 space-y-0.5 text-[0.7rem] text-[var(--color-text-muted)]">
            {limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </>
      )}
      {sources?.length > 0 && (
        <div className="text-[0.68rem] text-[var(--color-text-muted)]">
          <span className="font-semibold">Sources: </span>
          {sources.map((s, i) => (
            <span key={s.title}>
              {i > 0 && ' · '}
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-green-600 inline-flex items-center gap-0.5">{s.title}<ExternalLink className="w-2.5 h-2.5" /></a> : s.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
