export default function Stat({ label, value, hint, tone }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'primary' | 'accent' | 'warning' | 'success';
}) {
  return (
    <div className={`stat-card${tone ? ` tone-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
