// src/components/ui/EmptyState.jsx
// Empty state placeholder

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-green-400" />
        </div>
      )}
      <h3 className="font-bold text-base text-[var(--color-text)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-text-muted)] max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
