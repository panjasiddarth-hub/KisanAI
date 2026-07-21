// src/components/ui/OfflineCard.jsx — shown when the backend API is unreachable
import { WifiOff, Terminal } from 'lucide-react';

export default function OfflineCard({ onRetry }) {
  return (
    <div className="card p-6 text-center">
      <span className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-3">
        <WifiOff className="w-6 h-6 text-amber-500" />
      </span>
      <h3 className="font-bold text-base text-[var(--color-text)]">Backend not connected</h3>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-4 max-w-md mx-auto">
        This feature runs on the Node.js API. Start it in a second terminal and try again:
      </p>
      <div className="inline-flex items-center gap-2 text-left bg-slate-900 text-green-300 text-xs font-mono rounded-xl px-4 py-3">
        <Terminal className="w-4 h-4 shrink-0" />
        <span>cd backend&nbsp;&nbsp;&&amp;&nbsp;&nbsp;npm install&nbsp;&nbsp;&&amp;&nbsp;&nbsp;npm start</span>
      </div>
      {onRetry && (
        <div className="mt-4">
          <button onClick={onRetry} className="btn-primary text-sm">Retry connection</button>
        </div>
      )}
    </div>
  );
}
