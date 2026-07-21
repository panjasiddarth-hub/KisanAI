// src/pages/Notifications.jsx
// Full notifications list with mark-read and dismiss

import { useNotifications } from '../hooks/useNotifications';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, Leaf, X } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

const TYPE_META = {
  alert: { icon: AlertTriangle, tint: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400', label: 'Alert' },
  warning: { icon: AlertTriangle, tint: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', label: 'Warning' },
  info: { icon: Info, tint: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400', label: 'Info' },
  success: { icon: CheckCircle2, tint: 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400', label: 'Success' },
};

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();

  return (
    <div className="page-content" style={{ maxWidth: '860px' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--color-text)]">Notifications</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''} from your farm agents` : 'You are all caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-400 px-3 py-2 rounded-xl transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Alerts from weather, market and crop agents will appear here." />
      ) : (
        <div className="card overflow-hidden">
          {notifications.map((n, i) => {
            const meta = TYPE_META[n.type] || TYPE_META.info;
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-3.5 px-4 sm:px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors ${i !== notifications.length - 1 ? 'border-b border-[var(--color-border)]' : ''} ${!n.read ? 'bg-green-50/50 dark:bg-green-950/15' : ''}`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}>
                  <meta.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${n.type === 'alert' ? 'badge-red' : n.type === 'warning' ? 'badge-yellow' : n.type === 'success' ? 'badge-green' : 'badge-blue'}`}>{meta.label}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-green-500" />}
                  </div>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed mt-1.5">{n.message}</p>
                  <p className="text-[0.7rem] text-[var(--color-text-muted)] mt-1 flex items-center gap-1"><Leaf className="w-3 h-3" /> {n.time}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-gray-100 dark:hover:bg-slate-700"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
