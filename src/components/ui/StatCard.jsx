export default function StatCard({ label, num, suffix, Icon }) {
  return (
    <div className="stat-card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="stat-label">{label}</span>
        {Icon && <span className="muted-text"><Icon size="sm" /></span>}
      </div>
      <div className="stat-num" style={{ marginTop: '.5rem' }}>
        {num}
        {suffix && (
          <span style={{ color: 'var(--muted-foreground)', fontSize: '1rem', fontWeight: 500 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
