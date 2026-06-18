function Sparkline({ data, color = '#D97706' }) {
  if (!data || data.length < 2) return null;

  const width = 100;
  const height = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(' L ')}`;

  return (
    <div className="h-8 w-24 shrink-0 transition-opacity duration-300">
      <svg className="overflow-visible" viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-20 blur-[1px]"
        />
      </svg>
    </div>
  );
}

export default function KPICard({ title, value, subtitle, trend, sparklineData, variant = 'default' }) {
  const variants = {
    default: 'border-command-border',
    danger: 'border-command-danger/40 bg-command-danger/5',
    warning: 'border-command-warning/40 bg-command-warning/5',
    success: 'border-command-success/40 bg-command-success/5',
    accent: 'border-command-accent/40 bg-command-accent/5',
  };

  const accentColors = {
    default: 'var(--command-muted)',
    danger: 'var(--command-danger)',
    warning: 'var(--command-warning)',
    success: 'var(--command-success)',
    accent: 'var(--command-accent)',
  };

  return (
    <div className={`rounded-xl border bg-command-panel p-5 interactive-card shadow-sm transition-all duration-300 ${variants[variant]}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-command-muted leading-none">{title}</p>
          <p className="text-2xl font-extrabold text-white leading-none pt-1">{value}</p>
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={accentColors[variant]} />
        )}
      </div>
      {(subtitle || trend) && (
        <div className="mt-4 flex items-center justify-between border-t border-command-border/40 pt-3 text-xs leading-none">
          {subtitle && <span className="text-command-muted font-medium truncate pr-2">{subtitle}</span>}
          {trend && (
            <span className={`font-bold shrink-0 ${trend.positive ? 'text-command-success' : 'text-command-danger'}`}>
              {trend.positive ? '↑' : '↓'} {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
