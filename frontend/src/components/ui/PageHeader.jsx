// src/components/ui/PageHeader.jsx
// Consistent page header with title, subtitle, and optional actions

export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text)]">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
