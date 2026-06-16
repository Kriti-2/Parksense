export default function KPICard({ title, value, subtitle, trend, variant = 'default' }) {
  const variants = {
    default: 'border-command-border',
    danger: 'border-command-danger/40 bg-command-danger/5',
    warning: 'border-command-warning/40 bg-command-warning/5',
    success: 'border-command-success/40 bg-command-success/5',
    accent: 'border-command-accent/40 bg-command-accent/5',
  };

  return (
    <div className={`rounded-xl border bg-command-panel p-5 ${variants[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-command-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      {trend && (
        <p className={`mt-2 text-xs font-medium ${trend.positive ? 'text-command-success' : 'text-command-danger'}`}>
          {trend.positive ? '↑' : '↓'} {trend.label}
        </p>
      )}
    </div>
  );
}
